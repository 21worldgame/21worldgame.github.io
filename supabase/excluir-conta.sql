-- Excluir a conta de um jogador de vez (painel > alertas de trapaça). Só o administrador; nunca outro administrador.
-- Apaga o usuário do login (auth.users): save, perfil, Pix, suspensões e o resto saem junto (as tabelas apagam em cascata).
-- O e-mail fica livre para criar conta nova do zero; para segurar a pessoa fora, prefira suspender (permanente ou por prazo).
create or replace function public.admin_delete_account(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'só o administrador'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then return 'admin'; end if;
  delete from auth.users where id = p_user;
  return case when found then 'ok' else 'missing' end;
end $$;
revoke all on function public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_delete_account(uuid) to authenticated;
