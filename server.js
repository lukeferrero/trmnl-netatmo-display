const express = require('express');
const path = require('path');
const config = require('./src/config');
const trmnlRoutes = require('./src/routes/trmnl');

const app = express();

// Hostinger mette l'app dietro un reverse proxy che gestisce l'HTTPS verso
// l'esterno e parla in HTTP semplice con questa app internamente. Senza
// "trust proxy", req.protocol risulterebbe sempre "http" anche se il device
// si è collegato in https — e l'image_url che costruiamo (vedi routes/trmnl.js)
// verrebbe generato con lo schema sbagliato, facendo fallire il secondo
// passaggio (il device scarica l'immagine con una richiesta separata dalla
// prima: /api/display gli dice DOVE prenderla, poi lui la va a scaricare).
// Impostare PUBLIC_BASE_URL nelle variabili d'ambiente resta comunque il modo
// più affidabile di evitare del tutto questo problema.
app.set('trust proxy', true);

app.use(express.json());

// Immagini generate, servite come file statici (il device le scarica via HTTP)
app.use('/generated', express.static(path.join(__dirname, 'generated')));

app.use('/api', trmnlRoutes);

app.get('/', (req, res) => {
  res.type('text/plain').send('TRMNL Netatmo display server — vedi README per la configurazione.');
});

app.listen(config.port, () => {
  console.log(`Server in ascolto sulla porta ${config.port}`);
  console.log(`Endpoint TRMNL: /api/setup, /api/display, /api/log`);

  // Riepilogo di avvio: utile per controllare al volo, dai log di Hostinger,
  // se le variabili d'ambiente sono state lette correttamente — senza dover
  // aspettare che il device faccia una richiesta. I valori sensibili non
  // vengono stampati per intero.
  const mask = (v) => (v ? `impostata (${v.length} caratteri)` : 'NON impostata');
  console.log('--- Configurazione letta all\'avvio ---');
  console.log(`PUBLIC_BASE_URL: ${config.publicBaseUrl || 'NON impostata (verrà dedotta dalla richiesta)'}`);
  console.log(`NETATMO_CLIENT_ID: ${mask(config.netatmo.clientId)}`);
  console.log(`NETATMO_CLIENT_SECRET: ${mask(config.netatmo.clientSecret)}`);
  console.log(`NETATMO_REFRESH_TOKEN (bootstrap): ${mask(config.netatmo.initialRefreshToken)}`);
  console.log(`INVERT_DISPLAY (valore grezzo dall'ambiente): ${JSON.stringify(config.invertDisplayRaw)}`);
  console.log(`INVERT_DISPLAY (interpretato): ${config.invertColors}`);
  console.log(`REFRESH_RATE_SECONDS: ${config.refreshRateSeconds}`);
  console.log('----------------------------------------');
});
