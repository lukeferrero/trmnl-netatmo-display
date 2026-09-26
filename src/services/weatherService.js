// Previsioni meteo per Torino tramite Open-Meteo (https://open-meteo.com):
// API pubblica, gratuita, senza registrazione né API key.
const config = require('../config');

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Mappa dei WMO weather code (usati da Open-Meteo) in categorie semplici,
// usate poi da renderService per scegliere una piccola icona vettoriale e
// una descrizione breve in italiano.
const WMO_CATEGORIES = {
  0: { category: 'clear', label: 'Sereno' },
  1: { category: 'partly-cloudy', label: 'Poco nuvoloso' },
  2: { category: 'partly-cloudy', label: 'Parz. nuvoloso' },
  3: { category: 'cloudy', label: 'Nuvoloso' },
  45: { category: 'fog', label: 'Nebbia' },
  48: { category: 'fog', label: 'Nebbia (brina)' },
  51: { category: 'drizzle', label: 'Pioviggine leggera' },
  53: { category: 'drizzle', label: 'Pioviggine' },
  55: { category: 'drizzle', label: 'Pioviggine fitta' },
  56: { category: 'drizzle', label: 'Pioviggine gelata' },
  57: { category: 'drizzle', label: 'Pioviggine gelata' },
  61: { category: 'rain', label: 'Pioggia leggera' },
  63: { category: 'rain', label: 'Pioggia' },
  65: { category: 'rain', label: 'Pioggia forte' },
  66: { category: 'rain', label: 'Pioggia gelata' },
  67: { category: 'rain', label: 'Pioggia gelata forte' },
  71: { category: 'snow', label: 'Neve leggera' },
  73: { category: 'snow', label: 'Neve' },
  75: { category: 'snow', label: 'Neve forte' },
  77: { category: 'snow', label: 'Neve granulare' },
  80: { category: 'rain', label: 'Rovesci leggeri' },
  81: { category: 'rain', label: 'Rovesci' },
  82: { category: 'rain', label: 'Rovesci forti' },
  85: { category: 'snow', label: 'Rovesci di neve' },
  86: { category: 'snow', label: 'Rovesci di neve forti' },
  95: { category: 'storm', label: 'Temporale' },
  96: { category: 'storm', label: 'Temporale con grandine' },
  99: { category: 'storm', label: 'Temporale con grandine forte' },
};

function describeWeatherCode(code) {
  return WMO_CATEGORIES[code] || { category: 'cloudy', label: 'N/D' };
}

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

async function getTorinoForecast() {
  const params = new URLSearchParams({
    latitude: String(config.weather.lat),
    longitude: String(config.weather.lon),
    current: 'temperature_2m,relative_humidity_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Europe/Rome',
    forecast_days: '3',
  });

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Open-Meteo fallito (HTTP ${res.status}): ${text}`);
  }
  const json = await res.json();

  const current = {
    temperature: json.current?.temperature_2m,
    humidity: json.current?.relative_humidity_2m,
    ...describeWeatherCode(json.current?.weather_code),
  };

  const days = (json.daily?.time || []).map((isoDate, i) => {
    const date = new Date(`${isoDate}T12:00:00`);
    return {
      date,
      weekday: GIORNI[date.getDay()],
      tempMax: json.daily.temperature_2m_max?.[i],
      tempMin: json.daily.temperature_2m_min?.[i],
      precipProbability: json.daily.precipitation_probability_max?.[i],
      ...describeWeatherCode(json.daily.weather_code?.[i]),
    };
  });

  return { current, days };
}

module.exports = { getTorinoForecast };
