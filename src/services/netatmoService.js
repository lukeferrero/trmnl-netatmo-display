// Integrazione con l'API Netatmo (Weather Station).
//
// Netatmo usa OAuth2 con refresh token "rotanti": ogni volta che lo usi per
// ottenere un nuovo access_token, la risposta contiene ANCHE un nuovo
// refresh_token che sostituisce il precedente (quello vecchio smette di
// funzionare). Per questo il refresh_token corrente viene salvato su file
// (data/netatmo-token.json) e non solo nel .env: il .env serve solo per il
// primo bootstrap.
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'netatmo-token.json');

const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const STATION_DATA_URL = 'https://api.netatmo.com/api/getstationsdata';

let cachedAccessToken = null;
let accessTokenExpiresAt = 0; // epoch ms

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStoredRefreshToken() {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(raw).refresh_token;
  } catch {
    return null;
  }
}

function saveRefreshToken(refreshToken) {
  ensureDataDir();
  fs.writeFileSync(
    TOKEN_FILE,
    JSON.stringify({ refresh_token: refreshToken, updated_at: new Date().toISOString() }, null, 2)
  );
}

function getCurrentRefreshToken() {
  return loadStoredRefreshToken() || config.netatmo.initialRefreshToken;
}

async function refreshAccessToken() {
  const refreshToken = getCurrentRefreshToken();
  if (!refreshToken) {
    throw new Error(
      'Nessun refresh token Netatmo disponibile. Esegui "npm run get-netatmo-token" per ottenerne uno (vedi README).'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.netatmo.clientId,
    client_secret: config.netatmo.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Netatmo token refresh fallito (HTTP ${res.status}): ${text}`);
  }

  const json = await res.json();
  // Il refresh_token cambia ad ogni chiamata: va sempre risalvato.
  saveRefreshToken(json.refresh_token);

  cachedAccessToken = json.access_token;
  // Rinnoviamo un minuto prima della scadenza reale, per margine di sicurezza.
  accessTokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return cachedAccessToken;
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < accessTokenExpiresAt) {
    return cachedAccessToken;
  }
  return refreshAccessToken();
}

// Tipi di modulo Netatmo: NAMain = stazione base (indoor), NAModule1 = outdoor,
// NAModule2 = anemometro, NAModule3 = pluviometro, NAModule4 = modulo indoor aggiuntivo.
const MODULE_TYPE_LABELS = {
  NAMain: 'Interno',
  NAModule1: 'Esterno',
  NAModule2: 'Vento',
  NAModule3: 'Pioggia',
  NAModule4: 'Interno (extra)',
};

function normalizeStationData(rawBody) {
  const device = rawBody?.devices?.[0];
  if (!device) return null;

  const readings = [];

  // Modulo principale (sempre indoor)
  readings.push({
    type: 'NAMain',
    label: MODULE_TYPE_LABELS.NAMain,
    moduleName: device.module_name || device.station_name,
    temperature: device.dashboard_data?.Temperature,
    humidity: device.dashboard_data?.Humidity,
    co2: device.dashboard_data?.CO2,
    pressure: device.dashboard_data?.Pressure,
    noise: device.dashboard_data?.Noise,
  });

  for (const mod of device.modules || []) {
    readings.push({
      type: mod.type,
      label: MODULE_TYPE_LABELS[mod.type] || mod.type,
      moduleName: mod.module_name,
      temperature: mod.dashboard_data?.Temperature,
      humidity: mod.dashboard_data?.Humidity,
      co2: mod.dashboard_data?.CO2,
      rain: mod.dashboard_data?.Rain,
      rain24h: mod.dashboard_data?.sum_rain_24,
      windStrength: mod.dashboard_data?.WindStrength,
      gustStrength: mod.dashboard_data?.GustStrength,
      battery: mod.battery_percent,
    });
  }

  return {
    stationName: device.station_name,
    lastUpdated: device.dashboard_data?.time_utc
      ? new Date(device.dashboard_data.time_utc * 1000)
      : new Date(),
    readings,
  };
}

async function getStationData() {
  const accessToken = await getAccessToken();
  const res = await fetch(STATION_DATA_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Netatmo getstationsdata fallito (HTTP ${res.status}): ${text}`);
  }

  const json = await res.json();
  return normalizeStationData(json.body);
}

module.exports = { getStationData };
