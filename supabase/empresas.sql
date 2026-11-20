-- 21 World: cada banco, provedor, supermercado e usina tem UM dono no jogo inteiro (como a mina de ouro).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.company_owner (
  brand text primary key check (length(brand) between 1 and 24),
  owner uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  since timestamptz not null default now()
);

alter table public.company_owner enable row level security;
drop policy if exists "empresas: todos veem os donos" on public.company_owner;
create policy "empresas: todos veem os donos" on public.company_owner for select using (true);
-- ninguém escreve direto: só pelas funções abaixo

-- marcas que o administrador liberou: o antigo dono não registra de novo sozinho (o jogo devolve o dinheiro a ele)
create table if not exists public.company_released (
  brand text not null, user_id uuid not null references auth.users(id) on delete cascade, at timestamptz not null default now(),
  primary key (brand, user_id)
);
alter table public.company_released enable row level security;
-- ninguém lê nem escreve direto: só pelas funções

-- comprar a marca: só se ninguém for dono (a chave primária impede dois donos ao mesmo tempo)
create or replace function public.claim_company(p_brand text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if auth.uid() is null then return 'login'; end if;
  if p_brand is null or p_brand !~ '^[a-z0-9]{1,24}$' then return 'invalid'; end if;
  delete from public.company_released where brand = p_brand and user_id = auth.uid();
  if found then return 'released'; end if;   -- o admin tirou essa marca de você: o jogo devolve o dinheiro
  insert into public.company_owner (brand, owner, owner_name) values (p_brand, auth.uid(), left(coalesce(p_name, 'jogador'), 24))
    on conflict (brand) do nothing;
  select owner into o from public.company_owner where brand = p_brand;
  if o = auth.uid() then return 'ok'; end if;
  return 'taken';
end $$;

-- vender: só o dono libera a marca para o jogo
create or replace function public.release_company(p_brand text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'login'; end if;
  delete from public.company_owner where brand = p_brand and owner = auth.uid();
  if not found then return 'not-owner'; end if;
  return 'ok';
end $$;

revoke all on function public.claim_company(text, text) from public, anon;
revoke all on function public.release_company(text) from public, anon;
grant execute on function public.claim_company(text, text) to authenticated;
grant execute on function public.release_company(text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.company_owner;
exception when duplicate_object then null; when undefined_object then null; end $$;
