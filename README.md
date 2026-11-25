# UNVY

L'app della Serie C Univolley: X e Jolly, pizze, calendario, campionato FIPAV e rosa.

- **App**: https://formentinig-ops.github.io/unvy/ (si installa dal browser: "Aggiungi alla schermata Home").
- **Dati della squadra**: stanno su Supabase, non in questo repository. Si leggono solo entrando con codice squadra + PIN.
- **Dati FIPAV** (`data/fipav.json`): aggiornati ogni 3 ore da `.github/workflows/fipav.yml`, che esegue `scripts/fipav_sync.py`.
- **Database**: lo schema è in `supabase/schema.sql`.

## File
| File | A cosa serve |
|---|---|
| `index.html`, `styles.css`, `app.js` | l'app |
| `config.js` | indirizzo e chiave pubblica di Supabase |
| `sw.js`, `manifest.webmanifest`, `icons/` | installazione sul telefono |
| `scripts/fipav_sync.py` | lettura del portale FIPAV |
| `supabase/schema.sql` | tabelle e funzioni del database |
