-- 21 World: a mina de ouro é ÚNICA no jogo inteiro. Esta tabela guarda quem é o dono.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.gold_mine (
  id int primary key default 1 check (id = 1),
  owner uuid references auth.users(id) on delete set null,
  owner_name text,
  since timestamptz
);
insert into public.gold_mine (id) values (1) on conflict (id) do nothing;

alter table public.gold_mine enable row level security;
drop policy if exists "mina: todos veem o dono" on public.gold_mine;
create policy "mina: todos veem o dono" on public.gold_mine for select using (true);
-- ninguém escreve direto: só pelas funções abaixo

-- comprar: só funciona se ninguém for dono (trava a linha para dois não comprarem ao mesmo tempo)
create or replace function public.claim_gold_mine(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if auth.uid() is null then return 'login'; end if;
  select owner into o from public.gold_mine where id = 1 for update;
  if o is not null and o <> auth.uid() then return 'taken'; end if;
  update public.gold_mine set owner = auth.uid(), owner_name = left(coalesce(p_name, 'jogador'), 24), since = now() where id = 1;
  return 'ok';
end $$;

-- vender de volta: só o dono libera a mina para o jogo
create or replace function public.release_gold_mine()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'login'; end if;
  update public.gold_mine set owner = null, owner_name = null, since = null where id = 1 and owner = auth.uid();
  if not found then return 'not-owner'; end if;
  return 'ok';
end $$;

revoke all on function public.claim_gold_mine(text) from public, anon;
revoke all on function public.release_gold_mine() from public, anon;
grant execute on function public.claim_gold_mine(text) to authenticated;
grant execute on function public.release_gold_mine() to authenticated;

-- o jogo fica sabendo na hora quando a mina muda de dono
do $$ begin
  alter publication supabase_realtime add table public.gold_mine;
exception when duplicate_object then null; when undefined_object then null; end $$;
