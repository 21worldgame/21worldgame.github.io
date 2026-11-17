-- 21 World: painel administrativo. Rode DEPOIS do schema.sql, no SQL Editor do Supabase (pode rodar de novo).
-- Quem é administrador fica na tabela public.admins (só dá para mudar pelo SQL Editor; o site não consegue).
-- Para virar administrador:  insert into public.admins (email) values ('seu-email@exemplo.com') on conflict do nothing;

create table if not exists public.admins (email text primary key check (email = lower(email)));
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')))
     and coalesce((auth.jwt() ->> 'email_verified')::boolean, (auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, true);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select to authenticated using (public.is_admin());

-- ---------- suspensões ----------
create table if not exists public.bans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  reason     text check (char_length(reason) <= 200),
  until      timestamptz,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
drop policy if exists bans_select on public.bans;
drop policy if exists bans_admin_all on public.bans;
create policy bans_select on public.bans for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy bans_admin_all on public.bans for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_banned(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bans b where b.user_id = uid and (b.until is null or b.until > now()));
$$;
grant execute on function public.is_banned(uuid) to authenticated;

-- suspenso não grava save nem aparece no ranking; administrador lê e apaga tudo
drop policy if exists saves_insert_own on public.saves;
drop policy if exists saves_update_own on public.saves;
drop policy if exists saves_admin_select on public.saves;
drop policy if exists saves_admin_delete on public.saves;
create policy saves_insert_own on public.saves for insert to authenticated with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy saves_update_own on public.saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy saves_admin_select on public.saves for select to authenticated using (public.is_admin());
create policy saves_admin_delete on public.saves for delete to authenticated using (public.is_admin());

drop policy if exists profiles_insert_own on public.public_profiles;
drop policy if exists profiles_update_own on public.public_profiles;
drop policy if exists profiles_admin_update on public.public_profiles;
drop policy if exists profiles_admin_delete on public.public_profiles;
create policy profiles_insert_own on public.public_profiles for insert to authenticated with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy profiles_update_own on public.public_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy profiles_admin_update on public.public_profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.public_profiles for delete to authenticated using (public.is_admin());

-- ---------- ordens do administrador (o jogo do jogador aplica e marca como aplicada) ----------
create table if not exists public.admin_grants (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('money', 'chips', 'xp', 'reset', 'message')),
  amount     numeric not null default 0 check (amount between -1e12 and 1e12),
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists admin_grants_pending on public.admin_grants (user_id) where applied_at is null;
alter table public.admin_grants enable row level security;
drop policy if exists grants_select on public.admin_grants;
drop policy if exists grants_admin_insert on public.admin_grants;
drop policy if exists grants_admin_delete on public.admin_grants;
drop policy if exists grants_mark_applied on public.admin_grants;
create policy grants_select on public.admin_grants for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy grants_admin_insert on public.admin_grants for insert to authenticated with check (public.is_admin());
create policy grants_admin_delete on public.admin_grants for delete to authenticated using (public.is_admin());
create policy grants_mark_applied on public.admin_grants for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- o jogador só pode mexer na coluna applied_at (não consegue mudar o valor da ordem)
revoke update on public.admin_grants from authenticated;
grant update (applied_at) on public.admin_grants to authenticated;

-- ---------- configuração do jogo (uma linha) e avisos ----------
create table if not exists public.game_config (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 20000),
  updated_at timestamptz not null default now()
);
insert into public.game_config (id) values (1) on conflict do nothing;
alter table public.game_config enable row level security;
drop policy if exists config_read on public.game_config;
drop policy if exists config_admin_update on public.game_config;
create policy config_read on public.game_config for select to anon, authenticated using (true);
create policy config_admin_update on public.game_config for update to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  text       text not null check (char_length(text) between 1 and 280),
  kind       text not null default 'info' check (kind in ('info', 'evento', 'alerta')),
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists ann_read on public.announcements;
drop policy if exists ann_admin_all on public.announcements;
create policy ann_read on public.announcements for select to anon, authenticated using (ends_at is null or ends_at > now() or public.is_admin());
create policy ann_admin_all on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- registro das ações do administrador ----------
create table if not exists public.admin_log (
  id         bigint generated always as identity primary key,
  admin      text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  action     text not null check (char_length(action) <= 40),
  target     uuid,
  details    jsonb check (pg_column_size(details) < 4000),
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
drop policy if exists log_admin_read on public.admin_log;
drop policy if exists log_admin_insert on public.admin_log;
create policy log_admin_read on public.admin_log for select to authenticated using (public.is_admin());
create policy log_admin_insert on public.admin_log for insert to authenticated with check (public.is_admin());

-- ---------- consultas do painel (precisam ler auth.users, por isso security definer + checagem de admin) ----------
create or replace function public.admin_users(q text default '', lim int default 200)
returns table (user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean,
               name text, level int, worth numeric, banned boolean, ban_reason text, save_updated timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           p.name, p.level, p.worth, public.is_banned(u.id), b.reason, s.updated_at
      from auth.users u
      left join public.public_profiles p on p.user_id = u.id
      left join public.bans b on b.user_id = u.id
      left join public.saves s on s.user_id = u.id
     where q = '' or u.email ilike '%' || q || '%' or p.name ilike '%' || q || '%'
     order by u.created_at desc
     limit least(greatest(lim, 1), 1000);
end $$;
revoke all on function public.admin_users(text, int) from public;
grant execute on function public.admin_users(text, int) to authenticated;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users',        (select count(*) from auth.users),
    'confirmed',    (select count(*) from auth.users where email_confirmed_at is not null),
    'new_24h',      (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'new_7d',       (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_24h',   (select count(*) from public.saves where updated_at > now() - interval '24 hours'),
    'banned',       (select count(*) from public.bans where until is null or until > now()),
    'total_worth',  (select coalesce(sum(worth), 0) from public.public_profiles),
    'pending',      (select count(*) from public.admin_grants where applied_at is null)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;
