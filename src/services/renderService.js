// Genera l'immagine PNG (bianco/nero, adatta a un pannello e-ink) da mostrare
// sul TRMNL: costruisce un layout come SVG e lo rasterizza con "sharp".
//
// TESTO: invece di usare <text> con un font incorporato via @font-face,
// convertiamo ogni stringa direttamente in contorni vettoriali (<path>) con
// "opentype.js". Su Hostinger il motore che sharp usa per rasterizzare l'SVG
// non caricava il font incorporato (mostrava un carattere "mancante" identico
// per ogni lettera, tipo una sequenza di riquadri) — probabilmente perché
// quella build non supporta @font-face con font in base64. Disegnando noi
// stessi i contorni delle lettere come forme vettoriali, il risultato non
// dipende più dal supporto font del rasterizzatore: sono solo poligoni, come
// le icone meteo qui sotto.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const opentype = require('opentype.js');
const config = require('../config');

const fontRegular = opentype.parse(
  fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf')),
  { lowMemory: false }
);
const fontBold = opentype.parse(
  fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf')),
  { lowMemory: false }
);

const { width: W, height: H } = config.display;

function pickFont(bold) {
  return bold ? fontBold : fontRegular;
}

// NOTA: costruiamo i glifi carattere per carattere con charToGlyph()/advanceWidth
// invece di usare il metodo "alto livello" font.getPath(stringa, ...): quel
// metodo passa dal motore di shaping completo di opentype.js (GSUB/legature/
// bidi), che su alcune tabelle di DejaVu Sans genera un lookup OpenType non
// supportato dalla libreria e lancia un'eccezione. Per testo semplice
// italiano/latino non ci servono legature: il percorso "a basso livello" è
// sufficiente ed evita il problema.
function textWidth(str, size, bold = false) {
  const font = pickFont(bold);
  const scale = size / font.unitsPerEm;
  let width = 0;
  for (const ch of String(str ?? '')) {
    const glyph = font.charToGlyph(ch);
    width += (glyph.advanceWidth || font.unitsPerEm * 0.6) * scale;
  }
  return width;
}

// Disegna una stringa come <path> agli angoli (x, y = baseline), con
// allineamento start/middle/end simile a text-anchor in SVG.
function textPath(str, x, y, size, { bold = false, anchor = 'start' } = {}) {
  const s = String(str ?? '');
  if (!s) return '';
  const font = pickFont(bold);
  const scale = size / font.unitsPerEm;
  const width = textWidth(s, size, bold);
  let cursorX = x;
  if (anchor === 'middle') cursorX = x - width / 2;
  else if (anchor === 'end') cursorX = x - width;

  let d = '';
  for (const ch of s) {
    const glyph = font.charToGlyph(ch);
    d += glyph.getPath(cursorX, y, size).toPathData(1);
    cursorX += (glyph.advanceWidth || font.unitsPerEm * 0.6) * scale;
  }
  return `<path d="${d}" fill="#000000"/>`;
}

// --- Icone meteo, disegnate come semplici forme vettoriali (nessuna dipendenza
// da set di emoji, che su e-ink spesso non renderizzano bene). ---
function weatherIcon(category, cx, cy, scale = 1) {
  const s = scale;
  switch (category) {
    case 'clear':
      return `
        <g stroke="#000" stroke-width="${3 * s}" fill="none">
          <circle cx="${cx}" cy="${cy}" r="${14 * s}" fill="#000"/>
          ${[0, 45, 90, 135, 180, 225, 270, 315]
            .map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = cx + Math.cos(rad) * 20 * s;
              const y1 = cy + Math.sin(rad) * 20 * s;
              const x2 = cx + Math.cos(rad) * 28 * s;
              const y2 = cy + Math.sin(rad) * 28 * s;
              return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
            })
            .join('')}
        </g>`;
    case 'partly-cloudy':
      return `
        <g>
          <circle cx="${cx - 10 * s}" cy="${cy - 10 * s}" r="${12 * s}" fill="#000"/>
          ${cloudPath(cx + 6 * s, cy + 8 * s, s)}
        </g>`;
    case 'fog':
      return `
        <g stroke="#000" stroke-width="${3 * s}" fill="none">
          ${cloudPath(cx, cy - 6 * s, s * 0.85)}
          <line x1="${cx - 24 * s}" y1="${cy + 16 * s}" x2="${cx + 24 * s}" y2="${cy + 16 * s}"/>
          <line x1="${cx - 20 * s}" y1="${cy + 24 * s}" x2="${cx + 20 * s}" y2="${cy + 24 * s}"/>
        </g>`;
    case 'drizzle':
    case 'rain':
      return `
        <g>
          ${cloudPath(cx, cy - 10 * s, s)}
          <g stroke="#000" stroke-width="${3 * s}">
            <line x1="${cx - 14 * s}" y1="${cy + 14 * s}" x2="${cx - 20 * s}" y2="${cy + 26 * s}"/>
            <line x1="${cx}" y1="${cy + 14 * s}" x2="${cx - 6 * s}" y2="${cy + 26 * s}"/>
            <line x1="${cx + 14 * s}" y1="${cy + 14 * s}" x2="${cx + 8 * s}" y2="${cy + 26 * s}"/>
          </g>
        </g>`;
    case 'snow':
      return `
        <g>
          ${cloudPath(cx, cy - 10 * s, s)}
          <g fill="#000">
            <circle cx="${cx - 14 * s}" cy="${cy + 20 * s}" r="${2.5 * s}"/>
            <circle cx="${cx}" cy="${cy + 20 * s}" r="${2.5 * s}"/>
            <circle cx="${cx + 14 * s}" cy="${cy + 20 * s}" r="${2.5 * s}"/>
          </g>
        </g>`;
    case 'storm':
      return `
        <g>
          ${cloudPath(cx, cy - 12 * s, s)}
          <polygon points="${cx - 4 * s},${cy + 10 * s} ${cx + 8 * s},${cy + 10 * s} ${cx - 2 * s},${cy + 28 * s} ${cx + 2 * s},${cy + 16 * s} ${cx - 8 * s},${cy + 16 * s}" fill="#000"/>
        </g>`;
    case 'cloudy':
    default:
      return cloudPath(cx, cy, s * 1.1);
  }
}

function cloudPath(cx, cy, s = 1) {
  return `
    <g fill="#000">
      <circle cx="${cx - 14 * s}" cy="${cy}" r="${11 * s}"/>
      <circle cx="${cx + 2 * s}" cy="${cy - 6 * s}" r="${14 * s}"/>
      <circle cx="${cx + 16 * s}" cy="${cy}" r="${10 * s}"/>
      <rect x="${cx - 14 * s}" y="${cy}" width="${30 * s}" height="${11 * s}" />
    </g>`;
}

function round(n, digits = 0) {
  if (n === undefined || n === null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function fmtTemp(n) {
  const r = round(n, 1);
  return r === null ? '—' : `${r}°`;
}

function findModule(readings, type) {
  return readings.find((r) => r.type === type);
}

// Word-wrap basato sulla larghezza REALE del testo (misurata con opentype.js
// sullo stesso font che useremo per disegnarlo), non più su una stima.
function wrapText(text, maxWidth, fontSize, bold = false) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, fontSize, bold) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * @param {object} netatmo  Risultato di netatmoService.getStationData() (può essere null se non ancora configurato)
 * @param {object} weather  Risultato di weatherService.getTorinoForecast()
 * @returns {Promise<Buffer>} PNG pronto per essere servito al TRMNL
 */
async function renderDisplay({ netatmo, weather }) {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: config.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeFormatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateLabel = dateFormatter.format(now);
  const dateLabelCapitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const timeLabel = timeFormatter.format(now);

  const indoor = netatmo ? findModule(netatmo.readings, 'NAMain') : null;
  const outdoor = netatmo ? findModule(netatmo.readings, 'NAModule1') : null;

  const margin = 28;
  const colWidth = (W - margin * 2) / 3;

  const bodyTop = 108;
  const bodyBottom = 340;

  const colInnerWidth = colWidth - 24; // margine interno per non toccare i divisori

  function column(index, title, lines, icon) {
    const x = margin + colWidth * index;
    const cx = x + colWidth / 2;
    let svg = textPath(title, cx, bodyTop, 22, { bold: true, anchor: 'middle' });
    if (icon) svg += icon(cx, bodyTop + 55);

    let y = bodyTop + 90;
    for (const line of lines) {
      const size = line.size || 26;
      const bold = !!line.bold;
      const wrapped = wrapText(line.text, colInnerWidth, size, bold);
      for (const singleLine of wrapped) {
        svg += textPath(singleLine, cx, y, size, { bold, anchor: 'middle' });
        y += size * 1.25;
      }
      y += 8; // spazio extra tra un "blocco" di dato e il successivo
    }
    return svg;
  }

  const indoorLines = indoor
    ? [
        { text: `${fmtTemp(indoor.temperature)}C`, size: 44, bold: true },
        { text: `${round(indoor.humidity)}%`, size: 28, bold: true },
        { text: indoor.co2 ? `CO2 ${round(indoor.co2)} ppm` : '', size: 20 },
      ].filter((l) => l.text)
    : [{ text: 'Non ancora configurato', size: 20 }];

  const outdoorLines = outdoor
    ? [
        { text: `${fmtTemp(outdoor.temperature)}C`, size: 44, bold: true },
        { text: `${round(outdoor.humidity)}%`, size: 28, bold: true },
        {
          text:
            outdoor.battery !== undefined
              ? `Batteria modulo est.: ${outdoor.battery}%`
              : '',
          size: 18,
        },
      ].filter((l) => l.text)
    : [{ text: 'Modulo esterno non trovato', size: 20 }];

  const todayLines = weather
    ? [
        { text: weather.current.label, size: 22, bold: true },
        {
          text: `Ora ${fmtTemp(weather.current.temperature)}C · ${round(weather.current.humidity)}%`,
          size: 18,
        },
      ]
    : [{ text: 'Meteo non disponibile', size: 20 }];

  const bodySvg = [
    column(0, 'Interno', indoorLines, null),
    column(1, 'Esterno', outdoorLines, null),
    column(
      2,
      'Meteo Torino',
      todayLines,
      weather ? (cx, cy) => weatherIcon(weather.current.category, cx, cy, 1) : null
    ),
  ].join('\n');

  // Striscia di previsioni per i prossimi giorni (esclude oggi, che è già mostrato sopra)
  const upcoming = (weather?.days || []).slice(1, 3);
  const forecastY = 400;
  const forecastSvg = upcoming
    .map((day, i) => {
      const cx = margin + colWidth * 1.5 + (i === 0 ? -160 : 160);
      return `
        <g>
          ${weatherIcon(day.category, cx - 60, forecastY, 0.6)}
          ${textPath(day.weekday, cx - 20, forecastY - 10, 18, { bold: true })}
          ${textPath(`${fmtTemp(day.tempMax)} / ${fmtTemp(day.tempMin)}`, cx - 20, forecastY + 16, 18)}
          ${textPath(`Pioggia ${day.precipProbability ?? '—'}%`, cx - 20, forecastY + 38, 15)}
        </g>`;
    })
    .join('\n');

  const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>

      ${textPath(dateLabelCapitalized, margin, 52, 34, { bold: true })}
      ${textPath(`Aggiornato ${timeLabel}`, W - margin, 52, 22, { anchor: 'end' })}
      <line x1="${margin}" y1="70" x2="${W - margin}" y2="70" stroke="#000" stroke-width="2"/>

      <line x1="${margin + colWidth}" y1="${bodyTop - 30}" x2="${margin + colWidth}" y2="${bodyBottom}" stroke="#000" stroke-width="1"/>
      <line x1="${margin + colWidth * 2}" y1="${bodyTop - 30}" x2="${margin + colWidth * 2}" y2="${bodyBottom}" stroke="#000" stroke-width="1"/>

      ${bodySvg}

      <line x1="${margin}" y1="${bodyBottom}" x2="${W - margin}" y2="${bodyBottom}" stroke="#000" stroke-width="2"/>
      ${forecastSvg}
    </svg>
  `;

  let pipeline = sharp(Buffer.from(svg)).resize(W, H).grayscale();
  if (config.invertColors) pipeline = pipeline.negate({ alpha: false });

  // IMPORTANTE per la leggibilità su e-ink: niente dithering. Una palette a 2
  // colori generata "al volo" da sharp applica di default un dithering
  // (sparge il grigio dell'antialiasing dei bordi in un rumore di puntini),
  // che su un monitor normale si vede appena ma su un pannello e-ink a bassa
  // risoluzione rende il testo un impasto illeggibile. Con .threshold() ogni
  // pixel diventa o bianco o nero in modo netto, senza puntinatura: i bordi
  // dei caratteri restano puliti.
  pipeline = pipeline.threshold(128);

  const png = await pipeline
    .png({ palette: true, colors: 2, dither: 0 })
    .toBuffer();

  return png;
}

module.exports = { renderDisplay };
