// Registro (molto semplice, su file JSON) dei device TRMNL che si sono registrati
// tramite /api/setup. Per un progetto personale con un solo display è più che
// sufficiente: evita di dover configurare un database solo per questo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'devices.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2));
}

function readAll() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (err) {
    console.error('[deviceStore] file corrotto, lo reinizializzo:', err.message);
    return {};
  }
}

function writeAll(data) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Registra (o ritrova) un device a partire dal suo MAC address (header "ID"
 * inviato dal firmware su /api/setup). Ritorna sempre lo stesso api_key/friendly_id
 * per lo stesso MAC, così un reset del device non lo fa "riapparire" come nuovo.
 */
function getOrCreateDevice(macAddress) {
  const all = readAll();
  if (all[macAddress]) return all[macAddress];

  const device = {
    mac: macAddress,
    apiKey: crypto.randomBytes(16).toString('hex'),
    friendlyId: macAddress.replace(/:/g, '').slice(-6).toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  all[macAddress] = device;
  writeAll(all);
  return device;
}

function findByApiKey(apiKey) {
  const all = readAll();
  return Object.values(all).find((d) => d.apiKey === apiKey) || null;
}

module.exports = { getOrCreateDevice, findByApiKey };
