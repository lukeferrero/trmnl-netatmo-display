// Endpoint richiesti dal firmware TRMNL quando il device punta a un server
// "Custom" (BYOS) invece che a usetrmnl.com. Contratto ricostruito dalla
// documentazione ufficiale (docs.trmnl.com) e dal codice del firmware
// open-source (github.com/usetrmnl/firmware).
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const deviceStore = require('../utils/deviceStore');
const netatmoService = require('../services/netatmoService');
const weatherService = require('../services/weatherService');
const renderService = require('../services/renderService');

const router = express.Router();

const GENERATED_DIR = path.join(__dirname, '..', '..', 'generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

function publicBaseUrl(req) {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// Genera l'immagine PNG corrente (Netatmo + meteo Torino, con fallback se una
// delle due fonti fallisce), la salva in generated/ e ne ritorna l'URL pubblico
// più il nome file. Usata sia da /api/setup (il device scarica subito questa
// immagine come "logo" di benvenuto) sia da /api/display.
async function generateAndSaveImage(req) {
  const [netatmoResult, weatherResult] = await Promise.allSettled([
    netatmoService.getStationData(),
    weatherService.getTorinoForecast(),
  ]);

  if (netatmoResult.status === 'rejected') {
    console.error('[display] errore Netatmo:', netatmoResult.reason.message);
  }
  if (weatherResult.status === 'rejected') {
    console.error('[display] errore meteo:', weatherResult.reason.message);
  }

  const netatmo = netatmoResult.status === 'fulfilled' ? netatmoResult.value : null;
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

  const png = await renderService.renderDisplay({ netatmo, weather });

  const filename = `display-${Date.now()}.png`;
  fs.writeFileSync(path.join(GENERATED_DIR, filename), png);

  // Pulizia: teniamo solo le ultime immagini generate per non riempire il disco.
  const files = fs
    .readdirSync(GENERATED_DIR)
    .filter((f) => f.endsWith('.png'))
    .sort();
  for (const old of files.slice(0, -5)) {
    fs.unlinkSync(path.join(GENERATED_DIR, old));
  }

  const url = `${publicBaseUrl(req)}/generated/${filename}`;
  console.log(`[display] image_url generato: ${url} (req.protocol=${req.protocol}, PUBLIC_BASE_URL=${config.publicBaseUrl || '(non impostata)'})`);
  return { filename, url };
}

// --- GET /api/setup ---
// Chiamato dal device la primissima volta che si accoppia con questo server
// (dopo aver inserito l'URL in "Custom Server" nel portale WiFi).
//
// IMPORTANTE: dopo aver ricevuto una risposta con status 200, il firmware
// scarica SUBITO l'immagine indicata in image_url e la mostra come schermata
// di benvenuto — se image_url è vuota o non risponde con un'immagine valida,
// il setup fallisce anche se api_key/friendly_id erano corretti. Per questo
// generiamo e serviamo un'immagine vera anche qui, non solo su /api/display.
router.get('/setup', async (req, res) => {
  const mac = req.header('ID');
  if (!mac) {
    return res.status(400).json({ status: 400, message: 'Header "ID" mancante' });
  }

  const device = deviceStore.getOrCreateDevice(mac);
  console.log(`[setup] device registrato: mac=${mac} friendly_id=${device.friendlyId}`);

  try {
    const { url } = await generateAndSaveImage(req);
    return res.json({
      status: 200,
      api_key: device.apiKey,
      friendly_id: device.friendlyId,
      image_url: url,
      message: 'Benvenuto! Display Netatmo + meteo Torino configurato.',
    });
  } catch (err) {
    console.error('[setup] errore generazione immagine iniziale:', err);
    return res.status(500).json({ status: 500, message: 'Errore nella generazione dell\'immagine iniziale' });
  }
});

// --- GET /api/display ---
// Chiamato periodicamente dal device per sapere quale immagine mostrare.
//
// Non serviamo più un registro dei device su file (vedi utils/deviceStore.js):
// l'api_key è deterministica dal MAC, quindi qui non c'è nulla da "cercare" —
// basta verificare che il device stia mandando un Access-Token non vuoto.
// Non è un controllo di sicurezza vero e proprio, ma per questo caso d'uso
// (un display meteo personale, nessun dato sensibile in gioco) va bene così,
// ed elimina alla radice il problema del redeploy che cancella data/devices.json.
router.get('/display', async (req, res) => {
  const apiKey = req.header('Access-Token');

  if (!apiKey) {
    return res.status(401).json({ status: 401, error_detail: 'Access-Token non valido' });
  }

  try {
    const { url, filename } = await generateAndSaveImage(req);
    return res.json({
      status: 0,
      image_url: url,
      filename,
      refresh_rate: config.refreshRateSeconds,
      update_firmware: false,
      reset_firmware: false,
    });
  } catch (err) {
    console.error('[display] errore generazione immagine:', err);
    return res.status(500).json({ status: 500, error_detail: err.message });
  }
});

// --- POST /api/log ---
// Il device manda qui i propri log diagnostici; li stampiamo e basta.
router.post('/log', (req, res) => {
  console.log('[device log]', JSON.stringify(req.body));
  res.status(200).json({ status: 200 });
});

// --- GET /api/preview ---
// Non fa parte del contratto TRMNL: comodo solo per te, per vedere subito
// nel browser l'immagine generata in questo momento (bianco/nero, come la
// vedrebbe il display), senza dover aspettare il prossimo refresh del device
// o passare per Access-Token. Utile soprattutto per verificare al volo se
// serve INVERT_DISPLAY=true.
router.get('/preview', async (req, res) => {
  try {
    const [netatmoResult, weatherResult] = await Promise.allSettled([
      netatmoService.getStationData(),
      weatherService.getTorinoForecast(),
    ]);
    const netatmo = netatmoResult.status === 'fulfilled' ? netatmoResult.value : null;
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

    const png = await renderService.renderDisplay({ netatmo, weather });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    return res.send(png);
  } catch (err) {
    console.error('[preview] errore:', err);
    return res.status(500).send('Errore nella generazione dell\'anteprima');
  }
});

module.exports = router;
