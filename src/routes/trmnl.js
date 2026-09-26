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

// --- GET /api/setup ---
// Chiamato dal device la primissima volta che si accoppia con questo server
// (dopo aver inserito l'URL in "Custom Server" nel portale WiFi).
router.get('/setup', (req, res) => {
  const mac = req.header('ID');
  if (!mac) {
    return res.status(400).json({ status: 400, message: 'Header "ID" mancante' });
  }

  const device = deviceStore.getOrCreateDevice(mac);
  console.log(`[setup] device registrato: mac=${mac} friendly_id=${device.friendlyId}`);

  return res.json({
    status: 200,
    api_key: device.apiKey,
    friendly_id: device.friendlyId,
    image_url: '',
    message: 'Benvenuto! Display Netatmo + meteo Torino configurato.',
  });
});

// --- GET /api/display ---
// Chiamato periodicamente dal device per sapere quale immagine mostrare.
router.get('/display', async (req, res) => {
  const apiKey = req.header('Access-Token');
  const device = apiKey ? deviceStore.findByApiKey(apiKey) : null;

  if (!device) {
    return res.status(401).json({ status: 401, error_detail: 'Access-Token non valido' });
  }

  try {
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

    return res.json({
      status: 0,
      image_url: `${publicBaseUrl(req)}/generated/${filename}`,
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

module.exports = router;
