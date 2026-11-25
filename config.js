// Configurazione pubblica dell'app.
// La chiave "publishable" di Supabase è fatta per stare nel browser:
// da sola non permette di leggere o modificare nulla senza codice squadra + PIN.
window.UNVY_CONFIG = {
  url: 'https://cpkfuumzklekimmqccnn.supabase.co',
  key: 'sb_publishable_F7r02szd0o7Ikyq9tt5Sjw_CSQOr-Cw',
  fipav: 'https://raw.githubusercontent.com/formentinig-ops/unvy/main/data/fipav.json',
  // chiave pubblica VAPID per le notifiche push (la privata sta solo nei segreti di Supabase)
  vapid: 'BGqqz17M1tBe_feMgqFfrn3HpUGnAP6d-yZxUzzb6kOwrYkyKoeO7w_D-Mm0ljyojzjXBS1IDpTVXaRFYPLVN7g'
};
