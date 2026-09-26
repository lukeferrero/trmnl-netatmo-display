// Identità del device TRMNL: niente più file su disco. In origine salvavamo
// qui l'api_key generata al primo /api/setup, ma su Hostinger ogni redeploy
// ricrea la cartella dell'app da zero (giustamente: data/ non è versionata),
// quindi quella chiave "casuale" spariva ad ogni deploy — il device restava
// con una chiave che il server, ripartito, non riconosceva più (401 su
// /api/display, visibile nei log del device come "HTTP Client failed with
// error: (401)").
//
// Soluzione: api_key e friendly_id sono ora derivati in modo DETERMINISTICO
// dal MAC address, con una funzione di hash. Stesso MAC = sempre la stessa
// chiave, ad ogni riavvio o redeploy, senza dover salvare nulla da nessuna
// parte. Non è pensato per proteggere dati sensibili (non ce ne sono: è solo
// un display meteo), quindi va benissimo così anche senza un "segreto"
// server-side.
const crypto = require('crypto');

function getOrCreateDevice(macAddress) {
  const mac = String(macAddress).toUpperCase();
  const apiKey = crypto.createHash('sha256').update(`trmnl-netatmo-display:${mac}`).digest('hex').slice(0, 32);
  const friendlyId = mac.replace(/:/g, '').slice(-6);
  return { mac, apiKey, friendlyId };
}

module.exports = { getOrCreateDevice };
