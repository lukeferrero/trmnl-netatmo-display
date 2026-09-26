// Configurazione centralizzata, letta dalle variabili d'ambiente (.env in locale,
// pannello "Node.js" di Hostinger in produzione).
require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  timezone: process.env.TZ || 'Europe/Rome',

  netatmo: {
    clientId: required('NETATMO_CLIENT_ID', ''),
    clientSecret: required('NETATMO_CLIENT_SECRET', ''),
    initialRefreshToken: required('NETATMO_REFRESH_TOKEN', ''),
  },

  refreshRateSeconds: parseInt(process.env.REFRESH_RATE_SECONDS || '1800', 10),

  // URL pubblico con cui il TRMNL raggiunge questo server (es. https://display.tuodominio.it).
  // Se non impostato, viene ricostruito dalla richiesta HTTP in arrivo: su Hostinger,
  // se il traffico passa da un reverse proxy che "nasconde" https, è più sicuro
  // impostarlo esplicitamente.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',

  weather: {
    lat: parseFloat(process.env.WEATHER_LAT || '45.0703'),
    lon: parseFloat(process.env.WEATHER_LON || '7.6869'),
  },

  // Dimensioni pannello TRMNL 7.5" (OG) DIY Kit
  display: {
    width: 800,
    height: 480,
  },
};
