-- 21 World: Pix e pagamentos entre jogadores (pelo inventário).
-- Quem envia tira o dinheiro do próprio save e registra aqui; quem recebe pega quando abrir o jogo (uma vez só).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.pix (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users(id) on delete cascade,
  from_name text,
  to_id uuid not null references auth.users(id) on delete cascade,
  to_name text,
  amount bigint not null check (amount between 1 and 1000000000000),
  memo text check (char_length(memo) <= 80),
  kind text not null default 'pix' check (kind in ('pix', 'pagamento')),
  claimed boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists pix_to_open on public.pix (to_id) where not claimed;
create index if not exists pix_from_at on public.pix (from_id, at desc);
create index if not exists pix_to_at on public.pix (to_id, at desc);
alter table public.pix enable row level security;
-- cada um vê só o próprio extrato; escrever, só pelas funções
drop policy if exists "pix: meu extrato" on public.pix;
create policy "pix: meu extrato" on public.pix for select to authenticated using (auth.uid() in (from_id, to_id));
revoke insert, update, delete on public.pix from anon, authenticated;

-- enviar: confere o destinatário, o valor e o limite de envios
create or replace function public.send_pix(p_to uuid, p_amount bigint, p_name text, p_memo text, p_kind text default 'pix')
returns text language plpgsql security definer set search_path = public as $$
declare dest text; w numeric;
begin
  if auth.uid() is null then return 'login'; end if;
  if p_to is null or p_to = auth.uid() then return 'self'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000000 then return 'invalid'; end if;
  select name into dest from public.public_profiles where user_id = p_to;
  if dest is null then return 'nouser'; end if;
  select worth into w from public.public_profiles where user_id = auth.uid();
  if w is null or p_amount > greatest(w, 0) then return 'worth'; end if;                     -- não manda mais do que o próprio patrimônio
  if (select count(*) from public.pix where from_id = auth.uid() and at > now() - interval '1 hour') >= 30 then return 'limit'; end if;
  insert into public.pix (from_id, from_name, to_id, to_name, amount, memo, kind)
    values (auth.uid(), left(coalesce(p_name, 'jogador'), 24), p_to, dest, p_amount, nullif(left(trim(coalesce(p_memo, '')), 80), ''), case when p_kind = 'pagamento' then 'pagamento' else 'pix' end);
  return 'ok';
end $$;

-- receber: pega tudo o que chegou e ainda não foi creditado (uma vez só)
create or replace function public.claim_pix()
returns table (id bigint, from_name text, amount bigint, memo text, kind text) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query update public.pix p set claimed = true where p.to_id = auth.uid() and not p.claimed
    returning p.id, p.from_name, p.amount, p.memo, p.kind;
end $$;

revoke all on function public.send_pix(uuid, bigint, text, text, text) from public, anon;
revoke all on function public.claim_pix() from public, anon;
grant execute on function public.send_pix(uuid, bigint, text, text, text) to authenticated;
grant execute on function public.claim_pix() to authenticated;
