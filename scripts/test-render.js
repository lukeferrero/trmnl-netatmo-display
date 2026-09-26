// Script di sviluppo (non serve in produzione): genera un'immagine di
// esempio con dati finti, per controllare il layout senza dover configurare
// davvero Netatmo o avere accesso a internet.
const fs = require('fs');
const renderService = require('../src/services/renderService');

const netatmo = {
  stationName: 'Casa',
  lastUpdated: new Date(),
  readings: [
    { type: 'NAMain', label: 'Interno', temperature: 22.4, humidity: 48, co2: 612 },
    { type: 'NAModule1', label: 'Esterno', temperature: 17.8, humidity: 71, battery: 82 },
  ],
};

const weather = {
  current: { temperature: 18.2, humidity: 65, category: 'partly-cloudy', label: 'Parz. nuvoloso' },
  days: [
    { weekday: 'Sabato', tempMax: 21, tempMin: 14, precipProbability: 10, category: 'partly-cloudy', label: 'Parz. nuvoloso' },
    { weekday: 'Domenica', tempMax: 19, tempMin: 13, precipProbability: 60, category: 'rain', label: 'Pioggia' },
    { weekday: 'Lunedì', tempMax: 23, tempMin: 15, precipProbability: 0, category: 'clear', label: 'Sereno' },
  ],
};

renderService.renderDisplay({ netatmo, weather }).then((png) => {
  fs.writeFileSync('/tmp/preview-mock.png', png);
  console.log('Scritto /tmp/preview-mock.png');
});
