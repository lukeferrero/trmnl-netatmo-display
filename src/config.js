// Configurazione centralizzata, letta dalle variabili d'ambiente (.env in locale,
// pannello "Node.js" di Hostinger in produzione).
require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  return value;
}

// Alcuni pannelli di hosting salvano le variabili d'ambiente con spazi,
// virgolette o maiuscole diverse da quello che l'utente digita (es. "true "
// con uno spazio finale, o "True", o addirittura '"true"' con le virgolette
// incluse come caratteri letterali). Un confronto rigido con === 'true'
// fallisce silenziosamente in questi casi, facendo sembrare che la variabile
// sia sempre "false" anche quando è stata impostata correttamente lato
// pannello. Qui puliamo il valore prima di confrontarlo.
function envBool(name) {
  const raw = String(process.env[name] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
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

  // Alcuni pannelli e-ink (a seconda del driver/firmware) interpretano il
  // bianco/nero al contrario rispetto a una normale immagine: se sul display
  // vedi sfondo scuro e testo illeggibile invece di sfondo bianco e testo
  // nero, imposta INVERT_DISPLAY=true tra le variabili d'ambiente.
  invertColors: envBool('INVERT_DISPLAY'),

  // Solo per diagnostica nel log di avvio (vedi server.js): il valore così
  // come arriva dall'ambiente, senza alcuna elaborazione, per capire cosa
  // sta effettivamente ricevendo il processo.
  invertDisplayRaw: process.env.INVERT_DISPLAY,
};
