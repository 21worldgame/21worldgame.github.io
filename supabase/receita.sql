-- Receita Federal: quem ganha patrimônio rápido demais é pausado (vira uma suspensão com prazo na tabela bans).
-- 1ª pausa 10 min, depois 15, 20, 25... O admin vê os casos no painel e solta com "reativar conta".
-- Rodar uma vez no SQL Editor do Supabase. Depende de admin.sql (bans, is_admin).
create table if not exists public.receita_casos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  gain numeric,          -- quanto o patrimônio subiu na janela de 10 min
  worth numeric,         -- patrimônio na hora
  minutes int not null,
  until timestamptz not null
);
create index if not exists receita_casos_user on public.receita_casos (user_id, at desc);
alter table public.receita_casos enable row level security;
drop policy if exists receita_admin on public.receita_casos;
create policy receita_admin on public.receita_casos for select to authenticated using (public.is_admin());

-- o jogo do próprio jogador chama quando passa do limite (pela segunda vez; a primeira é só o aviso)
create or replace function public.receita_pausa(p_gain numeric, p_worth numeric) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int; mins int; ate timestamptz; cur public.bans;
begin
  if uid is null then return null; end if;
  select * into cur from public.bans where user_id = uid;
  if found and (cur.until is null or cur.until > now()) then return cur.until; end if;   -- já está pausado/suspenso: não mexe
  select count(*) into n from public.receita_casos where user_id = uid;
  mins := 10 + 5 * n;
  ate := now() + make_interval(mins => mins);
  insert into public.receita_casos (user_id, gain, worth, minutes, until) values (uid, p_gain, p_worth, mins, ate);
  insert into public.bans (user_id, reason, until) values (uid, format('Receita Federal: patrimônio subiu R$ %s em 10 minutos. Conta em análise por %s min.', replace(to_char(round(coalesce(p_gain, 0)), 'FM999,999,999,999,999'), ',', '.'), mins), ate)
    on conflict (user_id) do update set reason = excluded.reason, until = excluded.until, created_at = now();
  return ate;
end $$;
revoke all on function public.receita_pausa(numeric, numeric) from public, anon;
grant execute on function public.receita_pausa(numeric, numeric) to authenticated;
