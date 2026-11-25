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

do $$ declare t text; begin
  foreach t in array array['team','people','cats','entries','gyms','matches','pizza_due','pizza_hist','pizza_skip','sessions'] loop
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
        'perms', case when admin then '["x","partite","pizza","gestione"]'::jsonb else to_jsonb(perms) end,
        'admin', admin, 'foto', foto, 'has_pin', pin_hash is not null) order by staff, cognome) from people),
    'cats', coalesce((select jsonb_agg(jsonb_build_object('id', id, 't', t, 'g', g, 'nome', nome, 'u', u, 'q', q) order by t desc, ord)
        from cats where attiva), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', id, 't', t, 'p', p, 'c', c, 'q', q, 'd', d, 'n', n, 'by', da, 'st', st)
        order by d desc, created_at desc) from entries), '[]'::jsonb),
    'gyms', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'addr', addr)) from gyms), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'avv', avv, 'casa', casa, 'gym', gym, 'd', d, 'ora', ora)) from matches), '[]'::jsonb),
    'pizza', jsonb_build_object(
      'due', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'p', p, 'mot', mot) order by ord) from pizza_due), '[]'::jsonb),
      'hist', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'p', p, 'mot', mot, 'd', d) order by d) from pizza_hist), '[]'::jsonb),
      'skip', coalesce((select jsonb_object_agg(d::text, true) from pizza_skip), '{}'::jsonb))
  );
end $$;

-- ---------------------------------------------------------------- scrittura

create or replace function public.act(tok uuid, a text, x jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me people; tgt people; e entries;
  can_x boolean; can_par boolean; can_pz boolean; can_ges boolean;
  stt text; pid text; gid text; r record;
begin
  select p.* into me from sessions s join people p on p.id = s.p where s.token = tok;
  if me.id is null then raise exception 'SESSIONE'; end if;
  can_x   := me.admin or 'x' = any(me.perms);
  can_par := me.admin or 'partite' = any(me.perms);
  can_pz  := me.admin or 'pizza' = any(me.perms);
  can_ges := me.admin or 'gestione' = any(me.perms);

  if a = 'entries_add' then
    if not exists (select 1 from cats where id = x->>'c' and t = x->>'t' and attiva) then raise exception 'DATI'; end if;
    stt := case when can_x then 'ok' else 'prop' end;
    for pid in select jsonb_array_elements_text(x->'p') loop
      if not exists (select 1 from people where id = pid and stato <> 'fuori') then raise exception 'DATI'; end if;
      insert into entries(t, p, c, q, d, n, da, st)
      values (x->>'t', pid, x->>'c', greatest(1, least(200, coalesce((x->>'q')::int, 1))),
              coalesce((x->>'d')::date, current_date), left(coalesce(x->>'n', ''), 300), me.id, stt);
    end loop;
    return jsonb_build_object('st', stt);

  elsif a in ('entry_del', 'entry_appr', 'entry_rej', 'entry_absurd') then
    if not can_x then raise exception 'PERMESSO'; end if;
    select * into e from entries where id = (x->>'id')::uuid;
    if e.id is null then raise exception 'DATI'; end if;
    if a = 'entry_del' then delete from entries where id = e.id;
    elsif a = 'entry_appr' then update entries set st = 'ok', da = me.id where id = e.id and st = 'prop';
    elsif a = 'entry_rej' then delete from entries where id = e.id and st = 'prop';
    else
      delete from entries where id = e.id and st = 'prop';
      insert into entries(t, p, c, q, d, n, da, st)
      select 'X', e.da, c.id, 1, current_date,
             'Proposta respinta: ' || (select nome from cats where id = e.c) || ' a ' || (select nome || ' ' || cognome from people where id = e.p),
             me.id, 'ok'
      from cats c where c.nome ilike 'Proposta di X%' limit 1;
    end if;

  elsif a = 'perm_set' then
    if not can_ges then raise exception 'PERMESSO'; end if;
    if x->>'k' not in ('x', 'partite', 'pizza', 'gestione') then raise exception 'DATI'; end if;
    select * into tgt from people where id = x->>'p';
    if tgt.id is null then raise exception 'DATI'; end if;
    if tgt.admin then raise exception 'ADMIN'; end if;
    update people set perms = case when (x->>'on')::boolean
        then array(select distinct unnest(perms || array[x->>'k']))
        else array_remove(perms, x->>'k') end
    where id = tgt.id;

  elsif a = 'stato_set' then
    if not can_ges then raise exception 'PERMESSO'; end if;
    update people set stato = x->>'stato' where id = x->>'p';

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
    insert into matches(id, avv, casa, gym, d, ora)
    values (coalesce(nullif(x->>'id', ''), 'm' || substr(md5(random()::text), 1, 8)), left(x->>'avv', 80),
            coalesce((x->>'casa')::boolean, true), gid, (x->>'d')::date, left(x->>'ora', 5))
    on conflict (id) do update set avv = excluded.avv, casa = excluded.casa, gym = excluded.gym, d = excluded.d, ora = excluded.ora;

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

  elsif a = 'logout' then
    delete from sessions where token = tok;

  else
    raise exception 'AZIONE';
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.login_people(text) to anon, authenticated;
grant execute on function public.login(text, text, text) to anon, authenticated;
grant execute on function public.get_state(uuid) to anon, authenticated;
grant execute on function public.act(uuid, text, jsonb) to anon, authenticated;
