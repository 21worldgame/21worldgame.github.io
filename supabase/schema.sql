-- 21 World: tabelas e regras de acesso. Cole no SQL Editor do Supabase e rode uma vez (pode rodar de novo, é idempotente).

-- Save de cada jogador: só o dono lê e escreve.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 500000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;

drop policy if exists saves_select_own on public.saves;
drop policy if exists saves_insert_own on public.saves;
drop policy if exists saves_update_own on public.saves;
drop policy if exists saves_delete_own on public.saves;
create policy saves_select_own on public.saves for select to authenticated using (auth.uid() = user_id);
create policy saves_insert_own on public.saves for insert to authenticated with check (auth.uid() = user_id);
create policy saves_update_own on public.saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy saves_delete_own on public.saves for delete to authenticated using (auth.uid() = user_id);

-- Perfil público (ranking): todos os logados leem, só o dono escreve.
-- Os valores vêm do aparelho do jogador, então o ranking NÃO é oficial (dá para adulterar pelo navegador).
create table if not exists public.public_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 3 and 18),
  level      int  not null default 1 check (level between 1 and 999),
  worth      numeric not null default 0 check (worth between -1e12 and 1e15),
  rank       text check (char_length(rank) <= 30),
  look       jsonb check (pg_column_size(look) < 4000),
  updated_at timestamptz not null default now()
);
create unique index if not exists public_profiles_name_key on public.public_profiles (lower(name));
create index if not exists public_profiles_worth_idx on public.public_profiles (worth desc);
alter table public.public_profiles enable row level security;

drop policy if exists profiles_select_all on public.public_profiles;
drop policy if exists profiles_insert_own on public.public_profiles;
drop policy if exists profiles_update_own on public.public_profiles;
drop policy if exists profiles_delete_own on public.public_profiles;
create policy profiles_select_all on public.public_profiles for select to authenticated using (true);
create policy profiles_insert_own on public.public_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy profiles_update_own on public.public_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy profiles_delete_own on public.public_profiles for delete to authenticated using (auth.uid() = user_id);
