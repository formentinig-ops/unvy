-- UNVY: schema del database (Supabase / Postgres)
-- Nessun dato della squadra qui: i dati si caricano a parte.
-- Sicurezza: tutte le tabelle hanno RLS attiva e nessuna policy, quindi la
-- chiave pubblica dell'app NON può leggerle né scriverle direttamente.
-- Si passa solo dalle funzioni qui sotto, che controllano sessione e permessi.

create extension if not exists pgcrypto with schema extensions;

create table if not exists team (
  id int primary key default 1 check (id = 1),
  code text not null,
  val_x int not null default 3,
  quota int not null default 150,
  season text not null default 'Serie C 26/27',
  inizio date not null default '2026-09-07'
);

create table if not exists people (
  id text primary key,
  nome text not null,
  cognome text not null,
  sopr text not null default '',
  num int,
  ruolo text not null default '',
  staff boolean not null default false,
  stato text not null default 'gioca' check (stato in ('gioca','esonerato','fuori')),
  min text[] not null default '{}',
  perms text[] not null default '{}',
  admin boolean not null default false,
  foto text not null default '',
  pin_hash text,
  fails int not null default 0,
  locked_until timestamptz
);

create table if not exists cats (
  id text primary key,
  t text not null check (t in ('X','J')),
  g text not null,
  nome text not null,
  u int not null default 1,
  q boolean not null default false,
  ord int not null default 0,
  attiva boolean not null default true
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  t text not null check (t in ('X','J')),
  p text not null references people(id) on delete cascade,
  c text not null references cats(id),
  q int not null default 1 check (q between 1 and 200),
  d date not null default current_date,
  n text not null default '',
  da text references people(id) on delete set null,
  st text not null default 'ok' check (st in ('ok','prop')),
  created_at timestamptz not null default now()
);
create index if not exists entries_p on entries(p);

create table if not exists gyms (id text primary key, nome text not null, addr text not null);

create table if not exists matches (
  id text primary key,
  avv text not null,
  casa boolean not null default true,
  gym text,
  d date not null,
  ora text not null
);

create table if not exists pizza_due (
  id uuid primary key default gen_random_uuid(),
  ord bigint generated always as identity,
  p text not null references people(id) on delete cascade,
  mot text not null
);

create table if not exists pizza_hist (
  id uuid primary key default gen_random_uuid(),
  p text not null references people(id) on delete cascade,
  mot text not null,
  d date not null
);

create table if not exists pizza_skip (d date primary key);

create table if not exists sessions (
  token uuid primary key default gen_random_uuid(),
  p text not null references people(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- notifiche push
create table if not exists push_subs (
  endpoint text primary key,
  p text not null references people(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists push_outbox (
  id bigint generated always as identity primary key,
  kind text not null,
  target text references people(id) on delete cascade,
  title text not null,
  body text not null default '',
  url text not null default './',
  status text not null default 'pending',
  picked_at timestamptz,
  created_at timestamptz not null default now()
);
-- eccezioni agli allenamenti: annullati, orario diverso, allenamenti extra
create table if not exists training_ex (
  d date primary key,
  annullato boolean not null default false,
  ini text,
  fine text,
  nota text not null default ''
);
create table if not exists docs (
  id text primary key,
  nome text not null,
  mime text not null default 'application/pdf',
  data bytea not null,
  updated_at timestamptz not null default now()
);
create table if not exists fip_snap (id int primary key default 1 check (id = 1), data jsonb not null);
create table if not exists sent_marks (k text primary key, at timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['team','people','cats','entries','gyms','matches','pizza_due','pizza_hist','pizza_skip','sessions','push_subs','push_outbox','fip_snap','sent_marks','docs','training_ex'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- accesso

create or replace function public.login_people(code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from team where upper(trim(team.code)) = upper(trim(login_people.code))) then
    raise exception 'CODICE';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'nome', nome, 'cognome', cognome, 'num', num, 'ruolo', ruolo,
      'staff', staff, 'foto', foto, 'has_pin', pin_hash is not null) order by staff, cognome, nome)
    from people), '[]'::jsonb);
end $$;

create or replace function public.login(code text, pid text, pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare me people; tok uuid; first boolean := false;
begin
  if not exists (select 1 from team where upper(trim(team.code)) = upper(trim(login.code))) then
    raise exception 'CODICE';
  end if;
  if pin is null or pin !~ '^[0-9]{4}$' then raise exception 'PIN'; end if;
  select * into me from people where id = pid for update;
  if me.id is null then raise exception 'PERSONA'; end if;
  if me.locked_until is not null and me.locked_until > now() then raise exception 'BLOCCATO'; end if;
  if me.pin_hash is null then
    update people set pin_hash = crypt(pin, gen_salt('bf')), fails = 0, locked_until = null where id = pid;
    first := true;
  elsif crypt(pin, me.pin_hash) = me.pin_hash then
    update people set fails = 0, locked_until = null where id = pid;
  else
    update people set fails = fails + 1,
      locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' else null end
    where id = pid;
    return jsonb_build_object('error', case when me.fails + 1 >= 5 then 'BLOCCATO' else 'PIN' end);
  end if;
  insert into sessions(p) values (pid) returning token into tok;
  return jsonb_build_object('token', tok, 'first', first);
end $$;

-- ---------------------------------------------------------------- lettura

create or replace function public.get_state(tok uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare me people; ges boolean;
begin
  select p.* into me from sessions s join people p on p.id = s.p where s.token = tok;
  if me.id is null then raise exception 'SESSIONE'; end if;
  update sessions set last_seen = now() where token = tok;
  ges := me.admin or 'gestione' = any(me.perms);
  return jsonb_build_object(
    'me', me.id,
    'valX', (select val_x from team), 'quota', (select quota from team),
    'season', (select season from team), 'inizio', (select inizio from team),
    'code', case when ges then (select team.code from team) end,
    'people', (select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'cognome', cognome, 'sopr', case when sopr = '' then nome || ' ' || cognome else sopr end,
        'num', num, 'ruolo', ruolo, 'staff', staff, 'stato', stato, 'min', to_jsonb(min),
        'perms', case when admin then '["x","partite","pizza","rosa","gestione"]'::jsonb else to_jsonb(perms) end,
        'admin', admin, 'foto', foto, 'has_pin', pin_hash is not null) order by staff, cognome) from people),
    'cats', coalesce((select jsonb_agg(jsonb_build_object('id', id, 't', t, 'g', g, 'nome', nome, 'u', u, 'q', q) order by t desc, ord)
        from cats where attiva), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', id, 't', t, 'p', p, 'c', c, 'q', q, 'd', d, 'n', n, 'by', da, 'st', st)
        order by d desc, created_at desc) from entries), '[]'::jsonb),
    'gyms', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'addr', addr)) from gyms), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'avv', avv, 'casa', casa, 'gym', gym, 'd', d, 'ora', ora)) from matches), '[]'::jsonb),
    'training', coalesce((select jsonb_object_agg(d::text, jsonb_build_object('annullato', annullato, 'ini', ini, 'fine', fine, 'nota', nota)) from training_ex), '{}'::jsonb),
    'push', coalesce((select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'prefs', prefs)) from push_subs where p = me.id), '[]'::jsonb),
    'pizza', jsonb_build_object(
      'due', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'p', p, 'mot', mot) order by ord) from pizza_due), '[]'::jsonb),
      'hist', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'p', p, 'mot', mot, 'd', d) order by d) from pizza_hist), '[]'::jsonb),
      'skip', coalesce((select jsonb_object_agg(d::text, true) from pizza_skip), '{}'::jsonb))
  );
end $$;

-- documenti (es. regolamento): solo con sessione valida
create or replace function public.get_doc(tok uuid, did text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sessions where token = tok) then raise exception 'SESSIONE'; end if;
  return (select jsonb_build_object('nome', nome, 'mime', mime, 'b64', encode(data, 'base64')) from docs where id = did);
end $$;

-- ---------------------------------------------------------------- notifiche: aiuti

create or replace function public._enqueue(k text, tgt text, ttl text, bdy text)
returns void language sql security definer set search_path = public as $$
  insert into push_outbox(kind, target, title, body) values (k, tgt, left(ttl, 120), left(coalesce(bdy, ''), 300));
$$;

create or replace function public._mark(key text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into sent_marks(k) values (key);
  return true;
exception when unique_violation then
  return false;
end $$;

create or replace function public._mtitle(avv text, casa boolean)
returns text language sql immutable as $$
  select case when casa then 'UNVY – ' || avv else avv || ' – UNVY' end;
$$;

create or replace function public._mwhen(d date, ora text)
returns text language sql immutable as $$
  select (array['dom','lun','mar','mer','gio','ven','sab'])[extract(dow from d)::int + 1] || ' ' ||
         extract(day from d)::int || '/' || extract(month from d)::int || ' ore ' || ora;
$$;

create or replace function public._mday(d date)
returns text language sql immutable as $$
  select (array['dom','lun','mar','mer','gio','ven','sab'])[extract(dow from d)::int + 1] || ' ' ||
         extract(day from d)::int || '/' || extract(month from d)::int;
$$;

create or replace function public._gymname(gid text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select x->>'nome' from fip_snap, jsonb_array_elements(data->'gyms') x where x->>'id' = gid limit 1),
    (select nome from gyms where id = gid));
$$;

-- ---------------------------------------------------------------- scrittura

create or replace function public.act(tok uuid, a text, x jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me people; tgt people; e entries;
  can_x boolean; can_par boolean; can_pz boolean; can_ges boolean; can_rosa boolean;
  stt text; pid text; gid text; r record; nid text;
begin
  select p.* into me from sessions s join people p on p.id = s.p where s.token = tok;
  if me.id is null then raise exception 'SESSIONE'; end if;
  can_x   := me.admin or 'x' = any(me.perms);
  can_par := me.admin or 'partite' = any(me.perms);
  can_pz  := me.admin or 'pizza' = any(me.perms);
  can_ges := me.admin or 'gestione' = any(me.perms);
  can_rosa := me.admin or 'rosa' = any(me.perms);

  if a = 'entries_add' then
    if not exists (select 1 from cats where id = x->>'c' and t = x->>'t' and attiva) then raise exception 'DATI'; end if;
    if not can_x then raise exception 'PERMESSO'; end if;
    stt := 'ok';
    for pid in select jsonb_array_elements_text(x->'p') loop
      if not exists (select 1 from people where id = pid and stato <> 'fuori') then raise exception 'DATI'; end if;
      insert into entries(t, p, c, q, d, n, da, st)
      values (x->>'t', pid, x->>'c', greatest(1, least(200, coalesce((x->>'q')::int, 1))),
              coalesce((x->>'d')::date, current_date), left(coalesce(x->>'n', ''), 300), me.id, stt)
      returning * into e;
      if stt = 'ok' then
        perform _enqueue('x', pid, case when e.t = 'X' then 'Nuova X' else 'Nuovo Jolly! 🎉' end,
          (select nome from cats where id = e.c) || case when e.q > 1 then ' ×' || e.q else '' end ||
          ' · ' || ((select u from cats where id = e.c) * e.q * (select val_x from team)) || ' €' ||
          case when e.n <> '' then ' · ' || e.n else '' end);
      end if;
    end loop;
    return jsonb_build_object('st', stt);

  elsif a in ('entry_del', 'entry_appr', 'entry_rej', 'entry_absurd') then
    if not can_x then raise exception 'PERMESSO'; end if;
    select * into e from entries where id = (x->>'id')::uuid;
    if e.id is null then raise exception 'DATI'; end if;
    if a = 'entry_del' then delete from entries where id = e.id;
    elsif a = 'entry_appr' then
      update entries set st = 'ok', da = me.id where id = e.id and st = 'prop';
      if found then
        perform _enqueue('x', e.p, case when e.t = 'X' then 'Nuova X' else 'Nuovo Jolly! 🎉' end,
          (select nome from cats where id = e.c) || ' · ' || ((select u from cats where id = e.c) * e.q * (select val_x from team)) || ' €');
      end if;
    elsif a = 'entry_rej' then delete from entries where id = e.id and st = 'prop';
    else
      delete from entries where id = e.id and st = 'prop';
      insert into entries(t, p, c, q, d, n, da, st)
      select 'X', e.da, c.id, 1, current_date,
             'Proposta respinta: ' || (select nome from cats where id = e.c) || ' a ' || (select nome || ' ' || cognome from people where id = e.p),
             me.id, 'ok'
      from cats c where c.nome ilike 'Proposta di X%' limit 1;
      if e.da is not null then
        perform _enqueue('x', e.da, 'Nuova X', 'Proposta di X palesemente assurda · ' || (select val_x from team) || ' €');
      end if;
    end if;

  elsif a = 'perm_set' then
    if not can_ges then raise exception 'PERMESSO'; end if;
    if x->>'k' not in ('x', 'partite', 'pizza', 'rosa', 'gestione') then raise exception 'DATI'; end if;
    select * into tgt from people where id = x->>'p';
    if tgt.id is null then raise exception 'DATI'; end if;
    if tgt.admin then raise exception 'ADMIN'; end if;
    update people set perms = case when (x->>'on')::boolean
        then array(select distinct unnest(perms || array[x->>'k']))
        else array_remove(perms, x->>'k') end
    where id = tgt.id;

  elsif a = 'stato_set' then
    if not (can_ges or can_rosa) then raise exception 'PERMESSO'; end if;
    update people set stato = x->>'stato' where id = x->>'p';

  -- rosa
  elsif a = 'person_add' then
    if not can_rosa then raise exception 'PERMESSO'; end if;
    if coalesce(trim(x->>'nome'), '') = '' or coalesce(trim(x->>'cognome'), '') = '' then raise exception 'DATI'; end if;
    nid := 'p' || substr(md5(random()::text), 1, 8);
    insert into people(id, nome, cognome, num, ruolo, staff, stato)
    values (nid, left(trim(x->>'nome'), 40), left(trim(x->>'cognome'), 40), nullif(x->>'num', '')::int,
            coalesce(nullif(x->>'ruolo', ''), ''), coalesce((x->>'staff')::boolean, false),
            case when coalesce((x->>'staff')::boolean, false) then 'fuori' else 'gioca' end);
    if not coalesce((x->>'staff')::boolean, false) and coalesce((x->>'benvenuto')::boolean, true) then
      insert into entries(t, p, c, q, d, n, da, st)
      select 'X', nid, c.id, 1, current_date, 'Benvenuto in squadra!', me.id, 'ok' from cats c where c.nome ilike 'X di benvenuto%' limit 1;
    end if;
    return jsonb_build_object('id', nid);

  elsif a = 'person_edit' then
    if not can_rosa then raise exception 'PERMESSO'; end if;
    update people set
      nome = coalesce(nullif(trim(x->>'nome'), ''), nome),
      cognome = coalesce(nullif(trim(x->>'cognome'), ''), cognome),
      num = case when x ? 'num' then nullif(x->>'num', '')::int else num end,
      ruolo = coalesce(nullif(x->>'ruolo', ''), ruolo)
    where id = x->>'p';

  elsif a = 'person_del' then
    if not can_rosa then raise exception 'PERMESSO'; end if;
    select * into tgt from people where id = x->>'p';
    if tgt.id is null or tgt.admin or tgt.id = me.id then raise exception 'DATI'; end if;
    if exists (select 1 from entries where p = tgt.id or da = tgt.id)
       or exists (select 1 from pizza_due where p = tgt.id) or exists (select 1 from pizza_hist where p = tgt.id) then
      raise exception 'STORIA';
    end if;
    delete from people where id = tgt.id;

  -- nuove voci di X o Jolly (da "Assegna")
  elsif a = 'cat_add' then
    if not can_x then raise exception 'PERMESSO'; end if;
    if coalesce(trim(x->>'nome'), '') = '' or x->>'t' not in ('X', 'J') then raise exception 'DATI'; end if;
    select id into nid from cats where t = x->>'t' and lower(nome) = lower(trim(x->>'nome')) limit 1;
    if nid is not null then
      update cats set attiva = true where id = nid;
      return jsonb_build_object('id', nid);
    end if;
    nid := x->>'t' || 'Nu' || substr(md5(random()::text), 1, 6);
    insert into cats(id, t, g, nome, u, q, ord)
    values (nid, x->>'t', case when x->>'t' = 'X' then 'Altre X' else 'Jolly' end, left(trim(x->>'nome'), 80),
            greatest(1, least(5, coalesce((x->>'u')::int, 1))), false, (select coalesce(max(ord), 0) + 1 from cats));
    return jsonb_build_object('id', nid);

  -- correggere una X o un Jolly
  elsif a = 'entry_edit' then
    if not can_x then raise exception 'PERMESSO'; end if;
    if not exists (select 1 from cats where id = x->>'c') or not exists (select 1 from people where id = x->>'p') then raise exception 'DATI'; end if;
    update entries set p = x->>'p', c = x->>'c', t = (select t from cats where id = x->>'c'),
      q = greatest(1, least(200, coalesce((x->>'q')::int, 1))), d = coalesce((x->>'d')::date, d), n = left(coalesce(x->>'n', ''), 300)
    where id = (x->>'id')::uuid;

  -- eccezioni agli allenamenti
  elsif a = 'training_set' then
    if not can_par then raise exception 'PERMESSO'; end if;
    insert into training_ex(d, annullato, ini, fine, nota)
    values ((x->>'d')::date, coalesce((x->>'annullato')::boolean, false), left(x->>'ini', 5), left(x->>'fine', 5), left(coalesce(x->>'nota', ''), 120))
    on conflict (d) do update set annullato = excluded.annullato, ini = excluded.ini, fine = excluded.fine, nota = excluded.nota;
    perform _enqueue('cambi', null,
      case when coalesce((x->>'annullato')::boolean, false) then 'Allenamento annullato' else 'Allenamento: orario aggiornato' end,
      case when coalesce((x->>'annullato')::boolean, false) then _mday((x->>'d')::date)
           else _mwhen((x->>'d')::date, coalesce(x->>'ini', '')) || ' – ' || coalesce(x->>'fine', '') end ||
      case when coalesce(x->>'nota', '') <> '' then ' · ' || (x->>'nota') else '' end);

  elsif a = 'training_del' then
    if not can_par then raise exception 'PERMESSO'; end if;
    delete from training_ex where d = (x->>'d')::date;
    if found then
      perform _enqueue('cambi', null, 'Allenamento: orario normale', _mday((x->>'d')::date) || ': si torna all''orario di sempre');
    end if;

  elsif a = 'pin_reset' then
    if not can_ges then raise exception 'PERMESSO'; end if;
    update people set pin_hash = null, fails = 0, locked_until = null where id = x->>'p' and not admin;
    delete from sessions where p = x->>'p' and p <> me.id;

  elsif a = 'profile' then
    update people set
      nome = coalesce(nullif(trim(x->>'nome'), ''), nome),
      cognome = coalesce(nullif(trim(x->>'cognome'), ''), cognome),
      sopr = case when x ? 'sopr' then left(trim(x->>'sopr'), 40) else sopr end,
      num = case when x ? 'num' then nullif(x->>'num', '')::int else num end,
      ruolo = coalesce(nullif(x->>'ruolo', ''), ruolo),
      foto = case when x ? 'foto' then left(x->>'foto', 120000) else foto end
    where id = me.id;

  elsif a = 'match_save' then
    if not can_par then raise exception 'PERMESSO'; end if;
    gid := x->>'gym';
    if x ? 'newgym' then
      gid := 'g' || substr(md5(random()::text), 1, 8);
      insert into gyms(id, nome, addr) values (gid, left(x->'newgym'->>'nome', 80), left(x->'newgym'->>'addr', 160));
    end if;
    stt := case when exists (select 1 from matches where id = x->>'id') then 'cambi' else 'partita' end;
    insert into matches(id, avv, casa, gym, d, ora)
    values (coalesce(nullif(x->>'id', ''), 'm' || substr(md5(random()::text), 1, 8)), left(x->>'avv', 80),
            coalesce((x->>'casa')::boolean, true), gid, (x->>'d')::date, left(x->>'ora', 5))
    on conflict (id) do update set avv = excluded.avv, casa = excluded.casa, gym = excluded.gym, d = excluded.d, ora = excluded.ora;
    perform _enqueue(stt, null, case when stt = 'partita' then 'Nuova partita in calendario' else 'Partita modificata' end,
      _mtitle(x->>'avv', coalesce((x->>'casa')::boolean, true)) || ' · ' || _mwhen((x->>'d')::date, left(x->>'ora', 5)) ||
      coalesce(' · ' || _gymname(gid), ''));

  elsif a = 'match_del' then
    if not can_par then raise exception 'PERMESSO'; end if;
    delete from matches where id = x->>'id';

  elsif a = 'pizza_add' then
    if not can_pz then raise exception 'PERMESSO'; end if;
    if not exists (select 1 from people where id = x->>'p') then raise exception 'DATI'; end if;
    insert into pizza_due(p, mot) values (x->>'p', left(x->>'mot', 80));

  elsif a = 'pizza_del' then
    if not can_pz then raise exception 'PERMESSO'; end if;
    delete from pizza_due where id = (x->>'id')::uuid;

  elsif a = 'pizza_paid' then
    if not can_pz then raise exception 'PERMESSO'; end if;
    delete from pizza_due where id = (x->>'id')::uuid returning p, mot into r;
    if r.p is not null then
      insert into pizza_hist(p, mot, d) values (r.p, r.mot, least(coalesce((x->>'d')::date, current_date), current_date));
    end if;

  elsif a = 'pizza_skip' then
    if not can_pz then raise exception 'PERMESSO'; end if;
    if exists (select 1 from pizza_skip where d = (x->>'d')::date) then
      delete from pizza_skip where d = (x->>'d')::date;
    else
      insert into pizza_skip(d) values ((x->>'d')::date);
    end if;

  elsif a = 'push_sub' then
    if coalesce(x->>'endpoint', '') !~ '^https://' or coalesce(x->>'p256dh', '') = '' or coalesce(x->>'auth', '') = '' then
      raise exception 'DATI';
    end if;
    insert into push_subs(endpoint, p, p256dh, auth, prefs)
    values (x->>'endpoint', me.id, x->>'p256dh', x->>'auth', coalesce(x->'prefs', '{}'::jsonb))
    on conflict (endpoint) do update set p = excluded.p, p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs;

  elsif a = 'push_prefs' then
    update push_subs set prefs = coalesce(x->'prefs', '{}'::jsonb) where endpoint = x->>'endpoint' and p = me.id;

  elsif a = 'push_unsub' then
    delete from push_subs where endpoint = x->>'endpoint';

  elsif a = 'push_test' then
    if not exists (select 1 from push_subs where p = me.id) then raise exception 'DATI'; end if;
    perform _enqueue('test', me.id, 'Notifiche attive ✅', 'Da ora UNVY ti avvisa anche con l''app chiusa.');

  elsif a = 'logout' then
    delete from sessions where token = tok;

  else
    raise exception 'AZIONE';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- notifiche: funzioni del server (solo service_role)

create or replace function public.push_queue()
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  update push_outbox set status = 'old' where status = 'pending' and created_at < now() - interval '1 day';
  with picked as (
    update push_outbox set status = 'sending', picked_at = now()
    where id in (select id from push_outbox
                 where status = 'pending' or (status = 'sending' and picked_at < now() - interval '10 minutes')
                 order by id limit 40 for update skip locked)
    returning *)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'payload', jsonb_build_object('title', o.title, 'body', o.body, 'url', o.url, 'tag', o.kind || '-' || o.id),
      'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
                        from push_subs s
                        where (o.target is null or s.p = o.target)
                          and (o.kind = 'test' or coalesce((s.prefs->>o.kind)::boolean, true))), '[]'::jsonb))), '[]'::jsonb)
  into res from picked o;
  return res;
end $$;

create or replace function public.push_done(ids bigint[], dead text[])
returns void language sql security definer set search_path = public as $$
  update push_outbox set status = 'sent' where id = any(ids);
  delete from push_subs where endpoint = any(dead);
$$;

-- Confronta i dati FIPAV nuovi con l'ultima copia e mette in coda le notifiche.
create or replace function public.push_fip(d jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare old jsonb; g jsonb; o jsonb; r jsonb; ro jsonb; n int := 0; won boolean;
begin
  if d is null or jsonb_array_length(coalesce(d->'gare', '[]'::jsonb)) < 10 then return -1; end if;
  select data into old from fip_snap where id = 1;
  insert into fip_snap(id, data) values (1, d) on conflict (id) do update set data = excluded.data;
  if old is null then return 0; end if;
  for g in select * from jsonb_array_elements(d->'gare') loop
    select x into o from jsonb_array_elements(old->'gare') x where x->>'id' = g->>'id';
    if o is null then
      perform _enqueue('partita', null, 'Nuova partita in calendario',
        _mtitle(g->>'avv', (g->>'casa')::boolean) || ' · ' || _mwhen((g->>'d')::date, g->>'ora')); n := n + 1;
    elsif coalesce(o->>'ris', '') = '' and coalesce(g->>'ris', '') <> '' then
      won := case when (g->>'casa')::boolean then split_part(g->>'ris', '-', 1)::int > split_part(g->>'ris', '-', 2)::int
                  else split_part(g->>'ris', '-', 2)::int > split_part(g->>'ris', '-', 1)::int end;
      perform _enqueue('ris', null, case when won then 'Vinta! ' else 'Persa ' end || (g->>'ris'),
        _mtitle(g->>'avv', (g->>'casa')::boolean) || coalesce(' · ' || nullif(g->>'parz', ''), '')); n := n + 1;
    elsif coalesce(g->>'ris', '') = '' and (o->>'d', o->>'ora', o->>'gym') is distinct from (g->>'d', g->>'ora', g->>'gym') then
      perform _enqueue('cambi', null, 'Partita spostata',
        _mtitle(g->>'avv', (g->>'casa')::boolean) || ' · ora ' || _mwhen((g->>'d')::date, g->>'ora') ||
        coalesce(' · ' || (select x->>'nome' from jsonb_array_elements(d->'gyms') x where x->>'id' = g->>'gym'), '')); n := n + 1;
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(d->'all', '[]'::jsonb)) loop
    continue when coalesce(r->>5, '') = '' or r->>3 like 'Univolley%' or r->>4 like 'Univolley%';
    select x into ro from jsonb_array_elements(old->'all') x where x->>0 = r->>0 and x->>3 = r->>3 and x->>4 = r->>4;
    if ro is not null and coalesce(ro->>5, '') = '' then
      perform _enqueue('risAll', null, (r->>0) || 'ª giornata', (r->>3) || ' ' || (r->>5) || ' ' || (r->>4)); n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Promemoria della sera prima (partite e pizza), una volta sola.
create or replace function public.push_reminders(at_time timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare loc timestamp := at_time at time zone 'Europe/Rome'; tom date; g jsonb; m matches; dz record; n int := 0;
begin
  -- il giorno della partita, 3 ore prima dell'inizio (finestra di 30 minuti, una volta sola)
  for g in select x from fip_snap, jsonb_array_elements(data->'gare') x
           where fip_snap.id = 1 and (x->>'d')::date = loc::date and coalesce(x->>'ris', '') = '' loop
    if loc >= ((g->>'d')::date + (g->>'ora')::time) - interval '3 hours'
       and loc < ((g->>'d')::date + (g->>'ora')::time) - interval '2 hours 30 minutes'
       and _mark('pre:' || (g->>'id') || ':' || loc::date) then
      perform _enqueue('pre', null, 'Tra 3 ore si gioca 🏐',
        _mtitle(g->>'avv', (g->>'casa')::boolean) || ' · ore ' || (g->>'ora') || coalesce(' · ' || _gymname(g->>'gym'), '') ||
        '. Inizia a prepararti!'); n := n + 1;
    end if;
  end loop;
  for m in select * from matches where matches.d = loc::date loop
    if loc >= (m.d + m.ora::time) - interval '3 hours' and loc < (m.d + m.ora::time) - interval '2 hours 30 minutes'
       and _mark('pre:' || m.id || ':' || m.d) then
      perform _enqueue('pre', null, 'Tra 3 ore si gioca 🏐',
        _mtitle(m.avv, m.casa) || ' · ore ' || m.ora || coalesce(' · ' || _gymname(m.gym), '') || '. Inizia a prepararti!'); n := n + 1;
    end if;
  end loop;

  -- la sera prima: promemoria partite di domani e pizza
  if extract(hour from loc) < 18 or extract(hour from loc) >= 23 then return n; end if;
  tom := loc::date + 1;
  for g in select x from fip_snap, jsonb_array_elements(data->'gare') x where fip_snap.id = 1 and (x->>'d')::date = tom loop
    if _mark('prom:' || (g->>'id') || ':' || tom) then
      perform _enqueue('prom', null, 'Domani si gioca',
        _mtitle(g->>'avv', (g->>'casa')::boolean) || ' · ore ' || (g->>'ora') || coalesce(' · ' || _gymname(g->>'gym'), '')); n := n + 1;
    end if;
  end loop;
  for m in select * from matches where matches.d = tom loop
    if _mark('prom:' || m.id || ':' || tom) then
      perform _enqueue('prom', null, 'Domani si gioca', _mtitle(m.avv, m.casa) || ' · ore ' || m.ora || coalesce(' · ' || _gymname(m.gym), '')); n := n + 1;
    end if;
  end loop;
  if extract(isodow from tom) = 2 and not exists (select 1 from pizza_skip where pizza_skip.d = tom)
     and not exists (select 1 from training_ex where training_ex.d = tom and annullato) then
    select pd.p, pd.mot, pe.nome || ' ' || pe.cognome as chi into dz
    from pizza_due pd join people pe on pe.id = pd.p order by pd.ord limit 1;
    if dz.p is not null and _mark('pizza:' || tom) then
      perform _enqueue('pizza', null, 'Domani pizza! 🍕', 'Paga ' || dz.chi || ' (' || dz.mot || ')'); n := n + 1;
    end if;
  end if;
  return n;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.login_people(text) to anon, authenticated;
grant execute on function public.login(text, text, text) to anon, authenticated;
grant execute on function public.get_state(uuid) to anon, authenticated;
grant execute on function public.act(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.get_doc(uuid, text) to anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.push_queue(), public.push_done(bigint[], text[]), public.push_fip(jsonb), public.push_reminders(timestamptz) to service_role;
  end if;
end $$;
