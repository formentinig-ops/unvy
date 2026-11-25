-- Ogni 10 minuti Supabase chiama la funzione "push" in modalità "tick":
-- controlla i dati FIPAV (risultati, partite spostate), prepara i promemoria
-- della sera e invia le notifiche in coda.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'unvy-push-tick';

select cron.schedule(
  'unvy-push-tick',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://cpkfuumzklekimmqccnn.supabase.co/functions/v1/push',
    body := '{"mode":"tick"}'::jsonb,
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_F7r02szd0o7Ikyq9tt5Sjw_CSQOr-Cw"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
