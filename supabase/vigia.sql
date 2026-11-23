-- 21 World: o painel admin (aba vigilância) passa a ver todos os Pix entre jogadores, para achar contas que juntam dinheiro de outras.
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema. Depende de admin.sql (is_admin).
drop policy if exists "pix: admin vê tudo" on public.pix;
create policy "pix: admin vê tudo" on public.pix for select to authenticated using (public.is_admin());
