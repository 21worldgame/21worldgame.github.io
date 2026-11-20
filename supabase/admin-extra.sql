-- 21 World: ferramentas extras do painel (rode DEPOIS de admin.sql, mina.sql e empresas.sql).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

-- liberar a mina de ouro (volta para a loja)
create or replace function public.admin_release_mine()
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.gold_mine set owner = null, owner_name = null, since = null where id = 1;
  return 'ok';
end $$;

-- liberar uma marca (banco, provedor, supermercado ou usina)
create or replace function public.admin_release_company(p_brand text)
returns text language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  delete from public.company_owner where brand = p_brand returning owner into o;
  if o is not null then insert into public.company_released (brand, user_id) values (p_brand, o) on conflict do nothing; end if;
  return 'ok';
end $$;

revoke all on function public.admin_release_mine() from public, anon;
revoke all on function public.admin_release_company(text) from public, anon;
grant execute on function public.admin_release_mine() to authenticated;
grant execute on function public.admin_release_company(text) to authenticated;
