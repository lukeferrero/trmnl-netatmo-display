#!/usr/bin/env node
// Script "usa e getta" per ottenere il PRIMO refresh_token Netatmo.
// Va eseguito una sola volta, in locale (sul tuo PC), non su Hostinger:
// apre un mini server temporaneo su http://localhost:3005/callback per
// ricevere il redirect di Netatmo dopo il login.
//
// Uso:
//   1. npm run get-netatmo-token
//   2. Apri nel browser l'URL stampato in console, fai login su Netatmo e autorizza l'app
//   3. Il refresh_token verrà stampato in console: copialo in NETATMO_REFRESH_TOKEN nel tuo .env
require('dotenv').config();
const http = require('http');
const crypto = require('crypto');

const CLIENT_ID = process.env.NETATMO_CLIENT_ID;
const CLIENT_SECRET = process.env.NETATMO_CLIENT_SECRET;
const CALLBACK_PORT = 3005;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '\nManca NETATMO_CLIENT_ID e/o NETATMO_CLIENT_SECRET nel file .env.\n' +
      'Crea prima un file .env (puoi copiare .env.example) e valorizza queste due variabili\n' +
      'con i dati della tua app creata su https://dev.netatmo.com/apps.\n'
  );
  process.exit(1);
}

const state = crypto.randomBytes(8).toString('hex');

const authorizeUrl =
  'https://api.netatmo.com/oauth2/authorize?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read_station',
    state,
  }).toString();

console.log('\n--- Netatmo: ottieni il primo refresh token ---\n');
console.log('IMPORTANTE: nella configurazione della tua app su dev.netatmo.com,');
console.log(`assicurati che tra i "Redirect URI" sia presente esattamente:\n  ${REDIRECT_URI}\n`);
console.log('Apri questo URL nel browser, fai login e autorizza l\'app:\n');
console.log(authorizeUrl + '\n');
console.log(`In attesa del redirect su ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404);
    return res.end();
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end(`Netatmo ha risposto con un errore: ${error}`);
    console.error(`\nErrore restituito da Netatmo: ${error}`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('State non corrispondente, richiesta rifiutata per sicurezza.');
    console.error('\nLo "state" ricevuto non corrisponde: possibile richiesta non genuina, interrompo.');
    server.close();
    process.exit(1);
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'read_station',
    });

    const tokenRes = await fetch('https://api.netatmo.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(JSON.stringify(json));
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Fatto! Puoi chiudere questa finestra e tornare al terminale.');

    console.log('\n✅ Autorizzazione riuscita.\n');
    console.log('Copia questo valore in NETATMO_REFRESH_TOKEN nel tuo file .env:\n');
    console.log(json.refresh_token);
    console.log('\n(l\'access_token non serve salvarlo: il server lo rigenera da solo dal refresh_token)\n');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Errore nello scambio del code con Netatmo, guarda il terminale.');
    console.error('\nErrore nello scambio del code:', err.message);
  } finally {
    server.close();
  }
});

server.listen(CALLBACK_PORT);
