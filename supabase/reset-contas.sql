-- 21 World: APAGA TODAS AS CONTAS e todo o progresso salvo na nuvem. Não tem volta.
-- Rode no SQL Editor só quando quiser zerar o jogo. Depois, crie de novo a sua conta no jogo
-- e rode outra vez a linha do administrador (supabase/admin-setup.local.sql).
delete from public.admin_grants;
delete from public.bans;
delete from public.password_requests;
delete from public.saves;
delete from public.public_profiles;
delete from auth.users;          -- leva junto sessões, identidades (Google) e a tabela de administradores
