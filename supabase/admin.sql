-- 21 World: painel administrativo. Rode DEPOIS do schema.sql, no SQL Editor do Supabase (pode rodar de novo).
-- Quem é administrador fica na tabela public.admins, presa ao ID da conta (não ao e-mail), e só muda pelo SQL Editor.
-- Assim, mesmo sem confirmação de e-mail, ninguém vira administrador criando uma conta com o seu e-mail.
-- Para virar administrador, DEPOIS de criar a conta no jogo:
--   insert into public.admins (user_id) select id from auth.users where email = 'seu-email@exemplo.com' on conflict do nothing;

create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
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

-- ---------- conta entra na hora, sem e-mail de confirmação ----------
-- (Desligue também "Confirm email" em Authentication > Sign In / Providers > Email, para o Supabase não mandar e-mail nenhum.)
create or replace function public.autoconfirm_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end $$;
drop trigger if exists autoconfirm_user on auth.users;
create trigger autoconfirm_user before insert on auth.users for each row execute function public.autoconfirm_user();
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- ---------- recuperação de senha sem e-mail: pedido vai para análise no painel ----------
-- A senha nova é guardada só como hash (bcrypt, igual ao login). Ninguém, nem o painel, vê a senha.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.password_requests (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) <= 254),
  name       text check (char_length(name) <= 30),
  details    text check (char_length(details) <= 300),
  pw_hash    text not null,
  status     text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists password_requests_one_pending on public.password_requests (email) where status = 'pendente';
alter table public.password_requests enable row level security;
revoke all on public.password_requests from anon, authenticated;

-- qualquer pessoa pode pedir (a resposta é sempre igual, não revela se o e-mail existe)
create or replace function public.request_password_reset(p_email text, p_name text, p_details text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if char_length(coalesce(p_password, '')) not between 8 and 72 or position('@' in e) < 2 or char_length(e) > 254 then return; end if;
  if (select count(*) from public.password_requests where status = 'pendente') >= 500 then return; end if;   -- trava contra enxurrada
  delete from public.password_requests where email = e and status = 'pendente';                               -- o pedido novo substitui o anterior
  insert into public.password_requests (email, name, details, pw_hash)
  values (e, left(p_name, 30), left(p_details, 300), extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
end $$;
revoke all on function public.request_password_reset(text, text, text, text) from public;
grant execute on function public.request_password_reset(text, text, text, text) to anon, authenticated;

-- painel: lista os pedidos com os dados reais da conta ao lado, para comparar
create or replace function public.admin_password_requests() returns table (
  id bigint, email text, name text, details text, status text, created_at timestamptz,
  account_exists boolean, real_name text, real_level int, real_worth numeric, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  return query
    select r.id, r.email, r.name, r.details, r.status, r.created_at, u.id is not null, p.name, p.level, p.worth, u.last_sign_in_at
      from public.password_requests r
      left join auth.users u on lower(u.email) = r.email
      left join public.public_profiles p on p.user_id = u.id
     order by (r.status = 'pendente') desc, r.created_at desc
     limit 200;
end $$;
revoke all on function public.admin_password_requests() from public;
grant execute on function public.admin_password_requests() to authenticated;

create or replace function public.admin_decide_password(p_id bigint, p_approve boolean) returns text
language plpgsql security definer set search_path = public, auth as $$
declare r public.password_requests; n int;
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  select * into r from public.password_requests where id = p_id and status = 'pendente' for update;
  if not found then return 'pedido não está mais pendente'; end if;
  if p_approve then
    update auth.users set encrypted_password = r.pw_hash, updated_at = now() where lower(email) = r.email;
    get diagnostics n = row_count;
    if n = 0 then return 'não existe conta com esse e-mail'; end if;
  end if;
  update public.password_requests set status = case when p_approve then 'aprovado' else 'recusado' end, decided_at = now(), pw_hash = '-' where id = p_id;
  insert into public.admin_log (action, details) values (case when p_approve then 'senha aprovada' else 'senha recusada' end, jsonb_build_object('email', r.email));
  return 'ok';
end $$;
revoke all on function public.admin_decide_password(bigint, boolean) from public;
grant execute on function public.admin_decide_password(bigint, boolean) to authenticated;

-- ---------- ranking em tempo real ----------
do $$ begin alter publication supabase_realtime add table public.public_profiles; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.admin_grants; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_config; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcements; exception when others then null; end $$;
