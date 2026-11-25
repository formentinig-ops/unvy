// Edge Function "push": invia le notifiche in coda.
//  - { "mode": "flush" } → invia quello che è in coda (chiamata dall'app dopo ogni modifica)
//  - { "mode": "tick" }  → confronta i dati FIPAV, prepara i promemoria della sera, poi invia
//                          (chiamata ogni 10 minuti da pg_cron)
// Segreti richiesti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_JWK (e opzionale VAPID_SUBJECT).
import { sendPush } from './webpush.js';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  (() => { try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; } catch { return ''; } })();
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') || '',
  privateJwk: Deno.env.get('VAPID_PRIVATE_JWK') || '',
  subject: Deno.env.get('VAPID_SUBJECT') || 'https://formentinig-ops.github.io/unvy/',
};
const FIPAV_URL = 'https://raw.githubusercontent.com/formentinig-ops/unvy/main/data/fipav.json';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function rpc(fn: string, args: unknown = {}) {
  const headers: Record<string, string> = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (!SB_KEY.startsWith('sb_')) headers.Authorization = `Bearer ${SB_KEY}`;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

async function flush() {
  let sent = 0, failed = 0;
  for (let round = 0; round < 5; round++) {
    const queue = await rpc('push_queue');
    if (!queue || !queue.length) break;
    const ids: number[] = [], dead: string[] = [];
    for (const item of queue) {
      await Promise.all(item.subs.map(async (sub: { endpoint: string }) => {
        try {
          const status = await sendPush(sub, JSON.stringify(item.payload), VAPID);
          if (status === 404 || status === 410) dead.push(sub.endpoint);
          else if (status < 300) sent++;
          else { failed++; console.error('push', status, new URL(sub.endpoint).host); }
        } catch (e) { failed++; console.error('push error', e); }
      }));
      ids.push(item.id);
    }
    await rpc('push_done', { ids, dead });
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let mode = 'flush';
  try { mode = (await req.json()).mode || mode; } catch { /* corpo vuoto */ }
  const out: Record<string, unknown> = { mode };
  try {
    if (mode === 'tick') {
      try {
        const r = await fetch(`${FIPAV_URL}?t=${Date.now()}`);
        if (r.ok) out.fipav = await rpc('push_fip', { d: await r.json() });
      } catch (e) { out.fipavError = String(e); }
      out.reminders = await rpc('push_reminders', {});
    }
    Object.assign(out, await flush());
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify(out), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
