// Finto backend per l'anteprima dell'app (pannello Artifact di Claude).
// Imita le RPC di Supabase (login_people, login, get_state, act, get_doc) sui dati
// di una fotografia del database, tenuti in memoria o nel localStorage del browser.
// NON contiene dati: la fotografia viene inserita da scripts/build_preview.py.
(function () {
  const SNAP = window.UNVY_SNAPSHOT;
  const KEY = 'unvy-preview-db';
  let DB;
  try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
  if (!DB || DB.snapAt !== SNAP.snapAt) DB = { ...JSON.parse(JSON.stringify(SNAP)), sess: {} };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* anteprima senza memoria */ } };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ALL = ['x', 'partite', 'pizza', 'rosa', 'gestione'];
  const person = id => DB.people.find(p => p.id === id);
  const perms = p => (p.admin ? ALL : p.perms || []);
  class E extends Error {}
  const fail = m => { throw new E(m); };

  // Accesso automatico come Admin, così l'anteprima si apre già dentro l'app.
  const admin = DB.people.find(p => p.admin) || DB.people[0];
  try { if (!localStorage.getItem('unvy-tok')) { localStorage.setItem('unvy-tok', 'preview'); } } catch (e) { /* ok */ }
  DB.sess.preview = DB.sess.preview || admin.id;

  const fns = {
    login_people() {
      return DB.people.map(p => ({ id: p.id, nome: p.nome, cognome: p.cognome, num: p.num, ruolo: p.ruolo, staff: p.staff, foto: p.foto, has_pin: true }))
        .sort((a, b) => (a.staff - b.staff) || a.cognome.localeCompare(b.cognome));
    },
    login({ pid }) { const t = uid(); DB.sess[t] = pid; save(); return { token: t, first: false }; },
    get_state({ tok }) {
      const meId = DB.sess[tok]; const me = meId && person(meId); if (!me) fail('SESSIONE');
      const ges = perms(me).includes('gestione');
      return {
        me: me.id, valX: DB.valX, quota: DB.quota, season: DB.season, inizio: DB.inizio, code: ges ? 'ANTEPRIMA' : null,
        people: DB.people.map(p => ({ ...p, sopr: p.sopr || (p.nome + ' ' + p.cognome), perms: perms(p), has_pin: true }))
          .sort((a, b) => (a.staff - b.staff) || a.cognome.localeCompare(b.cognome)),
        cats: DB.cats.filter(c => c.attiva !== false).sort((a, b) => (b.t.localeCompare(a.t)) || a.ord - b.ord),
        entries: [...DB.entries].sort((a, b) => b.d.localeCompare(a.d) || String(b.ts).localeCompare(String(a.ts))),
        gyms: DB.gyms, matches: DB.matches, training: DB.training, push: [], pizza: DB.pizza,
      };
    },
    get_doc({ tok }) { if (!DB.sess[tok]) fail('SESSIONE'); return window.UNVY_DOC || null; },
    act({ tok, a, x }) {
      const me = person(DB.sess[tok]); if (!me) fail('SESSIONE');
      const can = k => perms(me).includes(k);
      const need = k => { if (!can(k)) fail('PERMESSO'); };
      const cat = id => DB.cats.find(c => c.id === id);
      switch (a) {
        case 'entries_add': need('x'); if (!cat(x.c)) fail('DATI');
          x.p.forEach(p => DB.entries.push({ id: uid(), t: x.t, p, c: x.c, q: Math.max(1, x.q || 1), d: x.d || today(), n: x.n || '', by: me.id, st: 'ok', ts: new Date().toISOString() }));
          break;
        case 'entry_del': need('x'); DB.entries = DB.entries.filter(e => e.id !== x.id); break;
        case 'entry_edit': { need('x'); const e = DB.entries.find(y => y.id === x.id); if (!e || !cat(x.c)) fail('DATI');
          Object.assign(e, { p: x.p, c: x.c, t: cat(x.c).t, q: Math.max(1, x.q || 1), d: x.d || e.d, n: x.n || '' }); break; }
        case 'cat_add': { need('x'); const nome = (x.nome || '').trim(); if (!nome) fail('DATI');
          const old = DB.cats.find(c => c.t === x.t && c.nome.toLowerCase() === nome.toLowerCase());
          if (old) { old.attiva = true; save(); return { id: old.id }; }
          const id = x.t + 'Nu' + uid().slice(0, 6);
          DB.cats.push({ id, t: x.t, g: x.t === 'X' ? 'Altre X' : 'Jolly', nome, u: 1, q: false, ord: 999, attiva: true }); save(); return { id }; }
        case 'perm_set': { need('gestione'); const p = person(x.p); if (!p) fail('DATI'); if (p.admin) fail('ADMIN');
          p.perms = x.on ? [...new Set([...(p.perms || []), x.k])] : (p.perms || []).filter(k => k !== x.k); break; }
        case 'stato_set': if (!(can('gestione') || can('rosa'))) fail('PERMESSO'); person(x.p).stato = x.stato; break;
        case 'pin_reset': need('gestione'); break;
        case 'profile': Object.assign(me, Object.fromEntries(Object.entries({ nome: x.nome, cognome: x.cognome, sopr: x.sopr, ruolo: x.ruolo, foto: x.foto }).filter(([, v]) => v !== undefined && v !== '')));
          if ('num' in x) me.num = x.num === '' ? null : Number(x.num); break;
        case 'person_add': { need('rosa'); const id = 'p' + uid().slice(0, 8);
          DB.people.push({ id, nome: x.nome.trim(), cognome: x.cognome.trim(), sopr: '', num: x.num === '' ? null : Number(x.num), ruolo: x.ruolo, staff: !!x.staff, stato: x.staff ? 'fuori' : 'gioca', min: [], perms: [], admin: false, foto: '' });
          const b = DB.cats.find(c => /^X di benvenuto/i.test(c.nome));
          if (!x.staff && x.benvenuto !== false && b) DB.entries.push({ id: uid(), t: 'X', p: id, c: b.id, q: 1, d: today(), n: 'Benvenuto in squadra!', by: me.id, st: 'ok', ts: new Date().toISOString() });
          save(); return { id }; }
        case 'person_edit': { need('rosa'); const p = person(x.p);
          Object.assign(p, { nome: x.nome || p.nome, cognome: x.cognome || p.cognome, ruolo: x.ruolo || p.ruolo }); if ('num' in x) p.num = x.num === '' ? null : Number(x.num); break; }
        case 'person_del': { need('rosa'); const id = x.p;
          if (DB.entries.some(e => e.p === id || e.by === id) || DB.pizza.due.some(z => z.p === id) || DB.pizza.hist.some(z => z.p === id)) fail('STORIA');
          DB.people = DB.people.filter(p => p.id !== id); break; }
        case 'match_save': { need('partite'); let gym = x.gym;
          if (x.newgym) { gym = 'g' + uid().slice(0, 8); DB.gyms.push({ id: gym, ...x.newgym }); }
          const m = { id: x.id || 'm' + uid().slice(0, 8), avv: x.avv, casa: x.casa, gym, d: x.d, ora: x.ora };
          const i = DB.matches.findIndex(y => y.id === m.id); i < 0 ? DB.matches.push(m) : (DB.matches[i] = m); break; }
        case 'match_del': need('partite'); DB.matches = DB.matches.filter(m => m.id !== x.id); break;
        case 'training_set': need('partite'); DB.training[x.d] = { annullato: !!x.annullato, ini: x.ini, fine: x.fine, nota: x.nota || '' }; break;
        case 'training_del': need('partite'); delete DB.training[x.d]; break;
        case 'pizza_add': need('pizza'); DB.pizza.due.push({ id: uid(), p: x.p, mot: x.mot }); break;
        case 'pizza_del': need('pizza'); DB.pizza.due = DB.pizza.due.filter(z => z.id !== x.id); break;
        case 'pizza_paid': { need('pizza'); const z = DB.pizza.due.find(y => y.id === x.id);
          if (z) { DB.pizza.due = DB.pizza.due.filter(y => y.id !== x.id); DB.pizza.hist.push({ id: uid(), p: z.p, mot: z.mot, d: x.d < today() ? x.d : today() }); } break; }
        case 'pizza_skip': need('pizza'); DB.pizza.skip[x.d] ? delete DB.pizza.skip[x.d] : (DB.pizza.skip[x.d] = true); break;
        case 'push_sub': case 'push_prefs': case 'push_unsub': case 'push_test': break;
        case 'logout': delete DB.sess[tok]; break;
        default: fail('AZIONE');
      }
      save(); return { ok: true };
    },
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith(window.UNVY_CONFIG.url)) {
      if (u.includes('/functions/v1/')) return new Response('{}', { status: 200 });
      const fn = u.split('/rpc/')[1];
      try { const out = fns[fn](JSON.parse((opt && opt.body) || '{}')); return new Response(JSON.stringify(out ?? null), { status: 200 }); }
      catch (e) { return new Response(JSON.stringify({ message: e instanceof E ? e.message : String(e) }), { status: 400 }); }
    }
    if (u.includes('fipav.json')) return new Response(JSON.stringify(window.UNVY_FIPAV), { status: 200 });
    return realFetch(url, opt);
  };
  // niente tempo reale nell'anteprima
  window.WebSocket = class { constructor() { this.readyState = 3; } send() {} close() {} };
})();
