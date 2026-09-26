# TRMNL Netatmo Display

Server self-hosted (BYOS, "Bring Your Own Server") per mostrare sul tuo **TRMNL 7.5" (OG) DIY Kit**:

- dati della tua stazione meteo **Netatmo** (interno + esterno);
- **data e ora** correnti;
- **previsioni meteo di Torino** (oggi + 2 giorni), tramite [Open-Meteo](https://open-meteo.com) (gratuito, nessuna API key).

Il device non passa mai dal cloud a pagamento di TRMNL: una volta configurato, parla solo con questo server.

## 1. Come funziona

Il firmware del TRMNL, quando è impostato su "Custom Server", chiama periodicamente questo server per sapere quale immagine mostrare. Questo server:

1. recupera i dati dalla tua stazione Netatmo (API Netatmo);
2. recupera le previsioni meteo di Torino (API Open-Meteo);
3. genera un'immagine PNG 800×480 (bianco/nero) con tutti i dati;
4. la restituisce al device, insieme a "torna a chiedermi tra X minuti".

## 2. Setup in locale

```bash
npm install
cp .env.example .env
```

Per ora lascia vuote le variabili `NETATMO_*`: le compiliamo al passo successivo.

## 3. Ottenere le credenziali Netatmo

### 3.1 Crea un'app su Netatmo

1. Vai su <https://dev.netatmo.com/apps> e accedi con il tuo account Netatmo (lo stesso a cui è associata la tua stazione meteo).
2. Crea una nuova app (nome e descrizione sono a piacere, es. "TRMNL Display").
3. Copia **Client ID** e **Client Secret** e mettili in `.env`:
   ```
   NETATMO_CLIENT_ID=...
   NETATMO_CLIENT_SECRET=...
   ```

### 3.2 Ottieni il primo refresh token

Questo passaggio si fa **una sola volta, in locale sul tuo PC** (non su Hostinger):

```bash
npm run get-netatmo-token
```

Lo script ti stamperà un URL: aprilo nel browser, fai login su Netatmo e autorizza l'app. Al termine, il terminale stamperà un `refresh_token`: copialo in `.env`:

```
NETATMO_REFRESH_TOKEN=...
```

> Nota tecnica: Netatmo usa refresh token "rotanti" — ad ogni rinnovo ne genera uno nuovo. Il server lo salva da solo in `data/netatmo-token.json` dopo il primo avvio, quindi questo valore nel `.env` serve solo per il bootstrap iniziale.

### 3.3 Prova in locale

```bash
npm start
```

In un altro terminale:

```bash
curl -H "ID: AA:BB:CC:DD:EE:FF" http://localhost:3000/api/setup
curl -H "Access-Token: <api_key ricevuta sopra>" http://localhost:3000/api/display
```

Se tutto è configurato correttamente, in `generated/` troverai un PNG con i tuoi dati Netatmo reali e le previsioni di Torino. Se vuoi solo controllare il layout senza aver ancora configurato Netatmo, usa:

```bash
node scripts/test-render.js
```

genera `/tmp/preview-mock.png` con dati di esempio.

## 4. Deploy su Hostinger

Lo stesso flusso già usato per Tailwinds (Node.js + GitHub):

1. Crea un repository GitHub (es. `trmnl-netatmo-display`) e pusha questo progetto:
   ```bash
   git init
   git add .
   git commit -m "Setup iniziale server TRMNL/Netatmo"
   git branch -M main
   git remote add origin https://github.com/lukeferrero/trmnl-netatmo-display.git
   git push -u origin main
   ```
   (`.env` e `data/` non vengono pushati: sono nel `.gitignore` apposta, perché contengono segreti/stato locale)

2. In **hPanel → Sito web → [il tuo sito o sottodominio] → Node.js**, crea una nuova applicazione:
   - **Repository**: collega il repo GitHub appena creato;
   - **Application root**: la cartella del progetto;
   - **Application startup file**: `server.js`;
   - **Node.js version**: 18 o superiore (va bene la stessa che usi per Tailwinds).

3. Nella sezione variabili d'ambiente dell'app Node su Hostinger, inserisci **manualmente** (Hostinger non legge il file `.env`):
   ```
   NETATMO_CLIENT_ID=...
   NETATMO_CLIENT_SECRET=...
   NETATMO_REFRESH_TOKEN=...   (il valore ottenuto al passo 3.2)
   TZ=Europe/Rome
   REFRESH_RATE_SECONDS=1800
   PUBLIC_BASE_URL=https://<il-dominio-o-sottodominio-che-userai>
   ```

4. Fai "Install dependencies" / restart dell'app dal pannello.

5. Verifica che il dominio risponda: apri `https://<il-tuo-dominio>/` nel browser, dovresti vedere il messaggio di stato del server.

> Consiglio: usa un sottodominio dedicato (es. `display.tuodominio.it`) invece del dominio principale di Importami Auto, per tenere i due progetti separati.

## 5. Collegare il TRMNL

Segui la procedura "Custom Server" già vista:

1. Metti il device in pairing (reset/re-pairing dal pulsante posteriore, o "Soft Reset" da Advanced se è già online).
2. Connettiti alla rete WiFi del device, si apre il portale di setup.
3. **Advanced → Custom Server → Yes**, inserisci `https://<il-tuo-dominio>` (senza slash finale).
4. Torna alla schermata WiFi, connetti il device alla tua rete di casa.

Il device chiamerà `/api/setup` la prima volta e poi `/api/display` ogni `REFRESH_RATE_SECONDS` secondi (default 30 minuti).

## 6. Personalizzazioni comuni

- **Cambiare la frequenza di aggiornamento**: variabile `REFRESH_RATE_SECONDS` (in secondi). Non conviene scendere sotto i 900 (15 minuti): Netatmo e Open-Meteo non aggiornano i dati più spesso di così, e su un DIY kit alimentato a batteria un refresh troppo frequente consuma di più.
- **Altri moduli Netatmo** (pioggia, vento, moduli indoor aggiuntivi): sono già letti da `netatmoService.js` (vedi array `readings`), ma non ancora mostrati nel layout — `renderService.js` è il punto in cui aggiungerli se vuoi visualizzarli.
- **Layout/grafica**: tutto il disegno dell'immagine è in `src/services/renderService.js` (è un template SVG), facile da modificare senza toccare il resto del codice.

## 7. Struttura del progetto

```
server.js                        entrypoint Express
src/config.js                    lettura variabili d'ambiente
src/routes/trmnl.js               endpoint /api/setup, /api/display, /api/log
src/services/netatmoService.js    OAuth2 + lettura dati stazione Netatmo
src/services/weatherService.js    previsioni meteo Torino (Open-Meteo)
src/services/renderService.js     generazione immagine PNG (SVG -> sharp)
src/utils/deviceStore.js          registro device TRMNL (file JSON)
scripts/get-netatmo-token.js      helper una-tantum per il primo refresh token
scripts/test-render.js            genera un'immagine di prova con dati finti
```

## 8. Troubleshooting

- **`/api/display` risponde ma l'immagine mostra "Non ancora configurato"**: le credenziali Netatmo non sono valide o mancano — controlla i log del server e le variabili d'ambiente su Hostinger.
- **Il device non si aggiorna mai**: verifica che `PUBLIC_BASE_URL` sia raggiungibile pubblicamente in HTTPS (il device deve poter scaricare l'immagine da internet, non solo dalla tua rete locale).
- **Refresh token Netatmo "scaduto"**: capita se il server resta spento per molte settimane senza mai rinnovarlo. Rilancia `npm run get-netatmo-token` in locale e aggiorna `NETATMO_REFRESH_TOKEN` su Hostinger.
