-- 21 World: aba "vigilância" do painel admin.
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.
-- Depende de admin.sql (is_admin), pix.sql (tabela pix) e historico.sql (save_history), que já estão rodados.

-- 1) o admin passa a ver todos os Pix entre jogadores (antes só via os dele)
drop policy if exists "pix: admin vê tudo" on public.pix;
create policy "pix: admin vê tudo" on public.pix for select to authenticated using (public.is_admin());

-- 2) índices para a vigilância carregar rápido (Pix dos últimos 7 dias e histórico das últimas 24 h de todos)
create index if not exists pix_at on public.pix (at desc);
create index if not exists save_history_at on public.save_history (saved_at desc);
