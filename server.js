const express = require('express');
const path = require('path');
const config = require('./src/config');
const trmnlRoutes = require('./src/routes/trmnl');

const app = express();
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
});
