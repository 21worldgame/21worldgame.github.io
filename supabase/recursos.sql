-- Recurso contra desconto do administrador / Receita Federal: o jogador pede pelo próprio livro-caixa e o pedido chega
-- no painel (alertas de trapaça > recursos). O administrador aceita (devolve o valor) ou nega, com resposta. Pode rodar de novo.
create table if not exists public.recursos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text check (char_length(name) <= 40),
  grant_id    bigint,                                   -- a ordem (admin_grants) que tirou o dinheiro
  amount      numeric not null default 0,               -- quanto foi descontado (positivo)
  entry       text check (char_length(entry) <= 220),   -- o texto do livro-caixa
  msg         text not null check (char_length(msg) between 5 and 800),
  status      text not null default 'aberto' check (status in ('aberto', 'aceito', 'negado')),
  answer      text check (char_length(answer) <= 400),
  at          timestamptz not null default now(),
  answered_at timestamptz
);
create unique index if not exists recursos_one_per_grant on public.recursos (user_id, grant_id) where grant_id is not null;
create index if not exists recursos_open on public.recursos (status, at desc);
alter table public.recursos enable row level security;
drop policy if exists recursos_select on public.recursos;
drop policy if exists recursos_insert on public.recursos;
drop policy if exists recursos_admin on public.recursos;
create policy recursos_select on public.recursos for select to authenticated using (auth.uid() = user_id or public.is_admin());
-- o jogador só abre recurso dele, sobre um desconto que existe e é dele, com o valor que foi tirado de verdade
create policy recursos_insert on public.recursos for insert to authenticated with check (
  auth.uid() = user_id and status = 'aberto' and answer is null and answered_at is null
  and (select (g.amount < 0 and -g.amount = recursos.amount) from public.admin_grants g where g.id = recursos.grant_id and g.user_id = auth.uid()));
create policy recursos_admin on public.recursos for all to authenticated using (public.is_admin()) with check (public.is_admin());
