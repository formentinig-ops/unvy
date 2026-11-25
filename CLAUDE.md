# UNVY — istruzioni per Claude

App della squadra di pallavolo Serie C Univolley (Carpi). Sostituisce Paynalty e aggiunge calendario,
pizze, campionato FIPAV e notifiche. L'utente è l'Admin della squadra, non è un programmatore:
**rispondi sempre in italiano**, spiega i passaggi in modo semplice, chiedi conferma prima di cambi
che toccano i dati reali.

## Regola d'oro: niente dati della squadra nel repository
Il repository è **pubblico** (serve per GitHub Pages e Actions gratuiti). Nomi, X, pizze, PIN,
codice squadra e la chiave privata VAPID stanno **solo su Supabase**. Non committare mai seed SQL con
dati reali, screenshot dei giocatori o il codice squadra. Prima di ogni push questo comando non deve
stampare nulla: `git grep -nE "UNVY-[A-Z0-9]{5}|\"d\":\"[A-Za-z0-9_-]{40,}\"" | grep -v XXXXX`

## Architettura
| Parte | Dove | Note |
|---|---|---|
| App (PWA) | `index.html`, `styles.css`, `app.js`, `config.js`, `sw.js`, `manifest.webmanifest`, `icons/` | servita da GitHub Pages: https://formentinig-ops.github.io/unvy/ (deploy automatico da `main`, 1–2 min) |
| Database | Supabase, progetto `cpkfuumzklekimmqccnn` (eu-west-1) | schema in `supabase/schema.sql` |
| Notifiche push | Edge Function `supabase/functions/push/` (`index.ts` + `webpush.js`, WebCrypto puro) | `verify_jwt: false`; segreti `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`, `VAPID_SUBJECT` |
| Controllo ogni 10 min | `supabase/cron.sql` (pg_cron + pg_net → funzione `push` con `{"mode":"tick"}`) | FIPAV diff + promemoria serali + invio coda |
| Dati FIPAV | `data/fipav.json`, generato da `scripts/fipav_sync.py` | workflow `.github/workflows/fipav.yml`: ogni ora, ogni 15 min nei giorni di gara |

App senza framework: `app.js` è un unico blocco `{ … }` con stato `S` (da `get_state`), viste `V.*`,
fogli (`sheet()`), azioni in `A` (click su `data-a`), `change`/`submit` delegati. HTML generato con
template string: **ogni valore che viene dai dati passa da `esc()`**.

## Sicurezza (non indebolirla)
- Tutte le tabelle hanno RLS attiva e **nessuna policy**: la chiave publishable non legge né scrive tabelle.
- Il client usa solo 4 RPC: `login_people(code)`, `login(code,pid,pin)`, `get_state(tok)`, `act(tok,a,x)`.
  `act` controlla la sessione e i permessi (`x`, `partite`, `pizza`, `gestione`; `admin` = tutti e intoccabile).
- PIN: bcrypt (`crypt`), blocco 15 minuti dopo 5 errori. Primo accesso = il PIN lo sceglie l'utente.
- Funzioni `push_queue`, `push_done`, `push_fip`, `push_reminders` eseguibili **solo da service_role**.
- Il tempo reale è un broadcast Supabase senza dati (`realtime:unvy-squadra`, evento `changed`): dice solo "ricarica".

## Come si lavora
### Modifiche all'app
Modifica i file, prova in locale (vedi sotto), commit su `main`, push. Il service worker è network-first;
se cambi la lista dei file in cache aumenta `CACHE` in `sw.js`.

### Modifiche al database
`supabase/schema.sql` è **rieseguibile** (`create table if not exists`, `create or replace function`, grant in fondo).
Se cambi la firma di una funzione, aggiungi prima un `drop function` della vecchia firma.
Si applica con la Management API (il token è iniettato dal proxy dell'ambiente cloud "unvy"; non serve conoscerlo):
```bash
python3 -c "import json;print(json.dumps({'query':open('supabase/schema.sql').read()}))" > /tmp/q.json
curl -s -X POST https://api.supabase.com/v1/projects/cpkfuumzklekimmqccnn/database/query \
  -H "Authorization: Bearer proxy-injected" -H 'Content-Type: application/json' --data @/tmp/q.json
```
Per interrogare i dati reali usa la stessa chiamata con una `select`. Non stampare in chat dati personali che non servono.

### Deploy della funzione push
```bash
cd supabase/functions/push && curl -s -X POST "https://api.supabase.com/v1/projects/cpkfuumzklekimmqccnn/functions/deploy?slug=push" \
  -H "Authorization: Bearer proxy-injected" \
  -F 'metadata={"entrypoint_path":"index.ts","name":"push","verify_jwt":false};type=application/json' \
  -F "file=@index.ts;type=application/typescript" -F "file=@webpush.js;type=application/javascript"
```

### Prove in locale
- Postgres 16 è installato: crea un cluster in `/tmp` (utente `postgres`), crea i ruoli `anon`, `authenticated`,
  `service_role` e lo schema `extensions`, poi applica `supabase/schema.sql` e un seed **di prova** (dati inventati).
- Un piccolo server Python può imitare PostgREST (`/rest/v1/rpc/<fn>` → `select fn(...)` come `anon`) e servire i file statici;
  Playwright + Chromium sono preinstallati. In config di test si può passare `rt:` per puntare a un finto server realtime.
- Il proxy della sessione non fa passare le WebSocket: il realtime vero si verifica solo dai telefoni.
- Chromium headless non può iscriversi alle push: per provare il flusso si simula `PushManager`.

## Regole della squadra (dal regolamento interno)
- **X** = multa da 3 € (valore in `team.val_x`). Categorie in tabella `cats` (Tecnici, Comportamentali, Vari);
  "Cartellino rosso" vale 2 X; "Ritardo ++ (ogni 3 minuti)" e "Materiale dimenticato in palestra" si danno a quantità.
  Più X uguali nello stesso giorno sono normali.
- **Jolly** = X al contrario (−3 €). Totale giocatore = (X − Jolly) × 3 €; se negativo la cassa gli deve la differenza.
- **Niente proposte** nell'app: le X si discutono a voce e le assegna solo chi ha il permesso `x` (decisione dell'Admin).
- Il pulsante "Assegna" gestisce X, Jolly e Pizze (le pizze con il permesso `pizza`).
- Stato partecipazione: `gioca`, `esonerato` (quota 150 €, resta in classifica), `fuori` (staff). Le multe si pagano a fine anno, fuori dall'app.
- **Pizza**: il martedì dopo l'allenamento, 75 €. Solo per motivi del regolamento (compleanno, laurea, esordio, assenza a partita…),
  coda in ordine di inserimento, un martedì per pizza; martedì saltabili. Nessuna rotazione.
- Allenamenti: lun 20:30–22:30, mar 20:45–22:45, gio 20:30–22:30, nella palestra di casa (la prima in `fipav.json`, campo `home`).

## Scelte di interfaccia già decise (non cambiarle senza chiedere)
- Colori: nero, bianco, verde acqua (liberi) come accento; rosso solo per le X. Font Archivo.
- Intestazione: logo a sinistra, maglia del giocatore al centro (apre la Rosa), "Serie C / 26/27" a destra.
- Barra in basso solo icone: Campionato, X, **Home** (tondo verde acqua più grande), Calendario, Impostazioni.
- Calendario: griglia settimanale predefinita (anche Mese ed Elenco), righe "Oggi" e "Prossima" **sotto** la griglia.
- Campionato: dalla domenica mostra la giornata successiva.
- Niente soprannomi per ora; niente note esplicative in fondo alle schede; niente "quote esonero" in Home.
