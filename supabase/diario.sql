-- 21 World: diário dos jogadores (aba "diário" do painel admin). Só o admin lê; o jogador só grava o dele e não vê.
-- Cada lançamento do livro-caixa com hora, tela, botões clicados, dinheiro, fichas e patrimônio na hora;
-- kind: log (lançamento), gap (dinheiro mudou SEM lançamento: furo do jogo), fichas (fichas mudaram), inicio (abriu o jogo / trocou o save).
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo. Depende de admin.sql (is_admin).
create table if not exists public.diario (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  at timestamptz not null default now(),      -- hora do aparelho do jogador (a do servidor fica em created)
  created timestamptz not null default now(),
  m int, kind text not null default 'log', txt text, val bigint default 0,
  money bigint, chips bigint, worth bigint, tab text, acts text
);
create index if not exists diario_user_at on public.diario (user_id, at desc);
create index if not exists diario_at on public.diario (at desc);
create index if not exists diario_gap on public.diario (kind, at desc) where kind <> 'log';
alter table public.diario enable row level security;
drop policy if exists diario_insert on public.diario;
create policy diario_insert on public.diario for insert to authenticated with check (user_id = auth.uid());
drop policy if exists diario_admin on public.diario;
create policy diario_admin on public.diario for select to authenticated using (public.is_admin());

-- limpeza (rode de vez em quando se a tabela ficar grande): apaga o que tem mais de 30 dias
-- delete from public.diario where at < now() - interval '30 days';
