-- 21 World: frigoríficos dos jogadores abatem o gado de outros jogadores (terceirização).
-- O dono escolhe a taxa por cabeça e abre o frigorífico; quem abate lá paga a taxa e o dono recebe a taxa + o couro,
-- mesmo desligado: fica guardado aqui até ele abrir o jogo.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.abate_plant (
  owner uuid primary key references auth.users(id) on delete cascade,
  owner_name text,
  fee int not null default 50 check (fee between 10 and 200),   -- taxa por cabeça (R$)
  open boolean not null default true,
  cap int not null default 300,                                 -- cabeças de terceiros por mês do mundo (10 min)
  used int not null default 0,
  bucket bigint not null default 0,                             -- qual "mês" de 10 min o used se refere
  updated_at timestamptz not null default now()
);
alter table public.abate_plant enable row level security;
drop policy if exists "frigorifico: todos veem" on public.abate_plant;
create policy "frigorifico: todos veem" on public.abate_plant for select using (true);

-- serviços feitos e ainda não recebidos pelo dono
create table if not exists public.abate_job (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  buyer uuid not null references auth.users(id) on delete cascade,
  buyer_name text,
  heads int not null check (heads between 1 and 300),
  pay bigint not null check (pay >= 0),
  claimed boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists abate_job_owner on public.abate_job (owner) where not claimed;
alter table public.abate_job enable row level security;
-- ninguém lê nem escreve direto: só pelas funções

-- dono: abre/fecha e escolhe a taxa (fechar = open false)
create or replace function public.set_abate(p_name text, p_fee int, p_open boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'login'; end if;
  insert into public.abate_plant (owner, owner_name, fee, open) values (auth.uid(), left(coalesce(p_name, 'jogador'), 24), greatest(10, least(200, coalesce(p_fee, 50))), coalesce(p_open, true))
    on conflict (owner) do update set owner_name = excluded.owner_name, fee = excluded.fee, open = excluded.open, updated_at = now();
  return 'ok';
end $$;

-- dono vendeu o frigorífico
create or replace function public.close_abate()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'login'; end if;
  delete from public.abate_plant where owner = auth.uid();
  return 'ok';
end $$;

-- quem abate: confere taxa e vaga do mês, registra o pagamento do dono (taxa + couro de R$ 60 por cabeça)
create or replace function public.use_abate(p_owner uuid, p_heads int, p_fee int, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare r public.abate_plant; b bigint := floor(extract(epoch from now()) / 600);
begin
  if auth.uid() is null then return 'login'; end if;
  if p_owner = auth.uid() then return 'self'; end if;
  if p_heads is null or p_heads < 1 or p_heads > 300 then return 'invalid'; end if;
  select * into r from public.abate_plant where owner = p_owner for update;
  if not found or not r.open then return 'closed'; end if;
  if r.fee <> p_fee then return 'fee'; end if;   -- o dono mudou a taxa: o jogo mostra a nova
  if r.bucket <> b then r.used := 0; end if;
  if r.used + p_heads > r.cap then return 'full'; end if;
  update public.abate_plant set used = r.used + p_heads, bucket = b where owner = p_owner;
  insert into public.abate_job (owner, buyer, buyer_name, heads, pay) values (p_owner, auth.uid(), left(coalesce(p_name, 'jogador'), 24), p_heads, p_heads::bigint * (r.fee + 60));
  return 'ok';
end $$;

-- dono: recebe o que entrou (uma vez só)
create or replace function public.claim_abate()
returns table (pay bigint, heads bigint, jobs bigint) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query with c as (update public.abate_job set claimed = true where owner = auth.uid() and not claimed returning abate_job.pay, abate_job.heads)
    select coalesce(sum(c.pay), 0)::bigint, coalesce(sum(c.heads), 0)::bigint, count(*)::bigint from c;
end $$;

revoke all on function public.set_abate(text, int, boolean) from public, anon;
revoke all on function public.close_abate() from public, anon;
revoke all on function public.use_abate(uuid, int, int, text) from public, anon;
revoke all on function public.claim_abate() from public, anon;
grant execute on function public.set_abate(text, int, boolean) to authenticated;
grant execute on function public.close_abate() to authenticated;
grant execute on function public.use_abate(uuid, int, int, text) to authenticated;
grant execute on function public.claim_abate() to authenticated;
