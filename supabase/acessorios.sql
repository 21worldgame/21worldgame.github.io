-- 21 World: estoque dos acessórios, o mesmo para todos os jogadores. Cada um começa com 35.
-- Quem já tem continua tendo. Comprar na loja tira 1; vender de volta para a loja devolve 1 (nunca passa de 35).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.acc_stock (
  id text primary key check (length(id) <= 40),
  left_qty int not null default 35 check (left_qty between 0 and 35)
);

alter table public.acc_stock enable row level security;
drop policy if exists "acessorios: todos veem o estoque" on public.acc_stock;
create policy "acessorios: todos veem o estoque" on public.acc_stock for select using (true);
-- ninguém escreve direto: só pelas funções abaixo

-- comprar: devolve quantos sobraram, ou -1 se esgotou
create or replace function public.take_acc(p_id text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return -2; end if;
  insert into public.acc_stock (id) values (p_id) on conflict (id) do nothing;
  update public.acc_stock set left_qty = left_qty - 1 where id = p_id and left_qty > 0 returning left_qty into n;
  if not found then return -1; end if;
  return n;
end $$;

-- vender para a loja: volta 1 para o estoque
create or replace function public.give_acc(p_id text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return -2; end if;
  insert into public.acc_stock (id) values (p_id) on conflict (id) do nothing;
  update public.acc_stock set left_qty = least(35, left_qty + 1) where id = p_id returning left_qty into n;
  return n;
end $$;

revoke all on function public.take_acc(text) from public, anon;
revoke all on function public.give_acc(text) from public, anon;
grant execute on function public.take_acc(text) to authenticated;
grant execute on function public.give_acc(text) to authenticated;
