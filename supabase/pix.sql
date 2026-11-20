-- 21 World: Pix e pagamentos entre jogadores (pelo inventário).
-- Quem envia tira o dinheiro do próprio save e registra aqui; quem recebe pega quando abrir o jogo e confirma (ack_pix) depois de salvar.
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
declare dest text; w numeric; nid bigint;
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
    values (auth.uid(), left(coalesce(p_name, 'jogador'), 24), p_to, dest, p_amount, nullif(left(trim(coalesce(p_memo, '')), 80), ''), case when p_kind = 'pagamento' then 'pagamento' else 'pix' end)
    returning id into nid;
  return 'ok:' || nid;   -- o jogo guarda o id no save de quem enviou
end $$;

-- receber em 2 passos: o jogo lê os Pix pendentes (select, pela política acima), credita, sobe o save e só então confirma aqui.
-- Assim, se o crédito se perder na sincronização entre aparelhos, o Pix continua pendente e é creditado de novo.
drop function if exists public.claim_pix();
create or replace function public.ack_pix(p_ids bigint[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or p_ids is null then return 0; end if;
  update public.pix set claimed = true where to_id = auth.uid() and not claimed and id = any(p_ids[1:200]);
  get diagnostics n = row_count; return n;
end $$;

revoke all on function public.send_pix(uuid, bigint, text, text, text) from public, anon;
revoke all on function public.ack_pix(bigint[]) from public, anon;
grant execute on function public.send_pix(uuid, bigint, text, text, text) to authenticated;
grant execute on function public.ack_pix(bigint[]) to authenticated;
