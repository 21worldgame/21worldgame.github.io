-- 21 World: perfil completo do jogador (o que os outros veem ao clicar no ranking).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.
alter table public.public_profiles add column if not exists card jsonb;
alter table public.public_profiles drop constraint if exists public_profiles_card_size;
alter table public.public_profiles add constraint public_profiles_card_size check (card is null or pg_column_size(card) < 20000);
