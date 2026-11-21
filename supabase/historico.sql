-- Histórico de saves (só o administrador vê; o jogador não sabe que existe).
-- Cada vez que o save de alguém muda, a versão anterior fica guardada: no máximo uma a cada 10 min por jogador,
-- e SEMPRE que o dinheiro cair 30% ou mais, alguma terra sumir, ou o save for apagado/reiniciado.
-- Guarda as 60 últimas por jogador. O painel (central.html) lista e restaura.
-- Rodar uma vez no SQL Editor do Supabase. Depende de public.is_admin() (admin.sql).

create table if not exists public.save_history (
  id bigserial primary key,
  user_id uuid not null,   -- sem chave estrangeira: apagar a conta em Authentication > Users nunca trava por causa do histórico
  saved_at timestamptz not null default now(),
  why text not null default 'antes de mudar',
  money numeric,
  lands int,
  data jsonb not null
);
create index if not exists save_history_user on public.save_history (user_id, saved_at desc);
alter table public.save_history enable row level security;
drop policy if exists hist_admin_select on public.save_history;
create policy hist_admin_select on public.save_history for select to authenticated using (public.is_admin());

create or replace function public.keep_save_history() returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_money numeric := coalesce((old.data->>'money')::numeric, 0);
  old_lands int := jsonb_array_length(coalesce(old.data->'lands', '[]'::jsonb));
  why text := null;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from auth.users u where u.id = old.user_id) then return old; end if;   -- a conta está sendo apagada: sem cópia
    why := 'save apagado ou reiniciado';
  elsif old.data is distinct from new.data then
    if coalesce((new.data->>'money')::numeric, 0) < old_money * 0.7 and old_money > 100000 then why := 'dinheiro caiu muito';
    elsif jsonb_array_length(coalesce(new.data->'lands', '[]'::jsonb)) < old_lands then why := 'terra a menos';
    elsif not exists (select 1 from save_history h where h.user_id = old.user_id and h.saved_at > now() - interval '10 minutes') then why := 'cópia periódica';
    end if;
  end if;
  if why is not null then
    insert into save_history (user_id, why, money, lands, data) values (old.user_id, why, old_money, old_lands, old.data);
    delete from save_history where user_id = old.user_id and id not in (select id from save_history where user_id = old.user_id order by saved_at desc limit 60);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists saves_keep_history on public.saves;
create trigger saves_keep_history before update or delete on public.saves for each row execute function public.keep_save_history();

-- restaurar: a versão escolhida vira o save atual (com hora nova, para os aparelhos do jogador puxarem da nuvem)
create or replace function public.admin_restore_save(p_id bigint) returns text language plpgsql security definer set search_path = public as $$
declare h public.save_history;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  select * into h from public.save_history where id = p_id;
  if not found then return 'missing'; end if;
  insert into public.saves (user_id, data, updated_at)
    values (h.user_id, h.data || jsonb_build_object('savedAt', (extract(epoch from now()) * 1000)::bigint), now())
    on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return 'ok';
end $$;
revoke all on function public.admin_restore_save(bigint) from public;
grant execute on function public.admin_restore_save(bigint) to authenticated;
