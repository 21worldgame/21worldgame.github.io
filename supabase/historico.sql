-- Histórico de saves (só o administrador vê; o jogador não sabe que existe).
-- Cada vez que o save de alguém muda, a versão anterior fica guardada: no máximo uma a cada 5 min por jogador,
-- e SEMPRE que o dinheiro cair 30% ou mais, alguma terra sumir, ou o save for apagado/reiniciado.
-- Guarda as 200 últimas por jogador + a última de cada dia dos últimos 60 dias + as cópias feitas pelo administrador.
-- Restaurar (admin_restore_save) guarda antes uma cópia do estado atual e devolve ao jogo o que saiu do save (Pix que ele mandou depois da cópia é desfeito: cancelado ou retirado de quem recebeu):
-- marcas (bancos, provedores, mercados, usinas), mina de ouro, frigorífico e o estoque dos acessórios.
-- Rodar inteiro no SQL Editor do Supabase. Pode rodar de novo sem problema. Depende de public.is_admin() (admin.sql).

create table if not exists public.save_history (
  id bigserial primary key,
  user_id uuid not null,   -- sem chave estrangeira: apagar a conta em Authentication > Users nunca trava por causa do histórico
  saved_at timestamptz not null default now(),
  why text not null default 'antes de mudar',
  money numeric,
  lands int,
  data jsonb not null
);
alter table public.save_history add column if not exists chips numeric;
alter table public.save_history add column if not exists level int;
alter table public.save_history add column if not exists month int;
alter table public.save_history add column if not exists worth numeric;
create index if not exists save_history_user on public.save_history (user_id, saved_at desc);
alter table public.save_history enable row level security;
drop policy if exists hist_admin_select on public.save_history;
create policy hist_admin_select on public.save_history for select to authenticated using (public.is_admin());

-- guarda uma versão e apaga as que sobram (as 200 últimas, a última de cada dia por 60 dias e as do administrador ficam)
create or replace function public.hist_keep(p_user uuid, p_why text, p_data jsonb) returns bigint language plpgsql security definer set search_path = public as $$
declare nid bigint;
begin
  insert into save_history (user_id, why, money, lands, chips, level, month, worth, data)
  values (p_user, p_why, coalesce((p_data->>'money')::numeric, 0),
          (select count(*) from jsonb_array_elements(case when jsonb_typeof(p_data->'lands') = 'array' then p_data->'lands' else '[]'::jsonb end) l where (l->>'own')::boolean is true),
          coalesce((p_data->>'chips')::numeric, 0), nullif(p_data->>'level', '')::int, nullif(p_data->>'month', '')::int,
          (select worth from public_profiles where user_id = p_user), p_data)
  returning id into nid;
  delete from save_history h where h.user_id = p_user and h.id not in (
    select id from (select id from save_history where user_id = p_user order by saved_at desc limit 200) a
    union select id from (select distinct on (saved_at::date) id from save_history where user_id = p_user and saved_at > now() - interval '60 days' order by saved_at::date, saved_at desc) b
    union select id from save_history where user_id = p_user and (why like 'cópia guardada%' or why like 'antes de restaurar%') and saved_at > now() - interval '90 days');
  return nid;
end $$;
revoke all on function public.hist_keep(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.keep_save_history() returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_money numeric := coalesce((old.data->>'money')::numeric, 0);
  old_lands int := jsonb_array_length(case when jsonb_typeof(old.data->'lands') = 'array' then old.data->'lands' else '[]'::jsonb end);
  why text := null;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from auth.users u where u.id = old.user_id) then return old; end if;   -- a conta está sendo apagada: sem cópia
    why := 'save apagado ou reiniciado';
  elsif old.data is distinct from new.data then
    if coalesce((new.data->>'money')::numeric, 0) < old_money * 0.7 and old_money > 100000 then why := 'dinheiro caiu muito';
    elsif jsonb_array_length(case when jsonb_typeof(new.data->'lands') = 'array' then new.data->'lands' else '[]'::jsonb end) < old_lands then why := 'terra a menos';
    elsif not exists (select 1 from save_history h where h.user_id = old.user_id and h.saved_at > now() - interval '5 minutes') then why := 'cópia automática';
    end if;
  end if;
  if why is not null then perform public.hist_keep(old.user_id, why, old.data); end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists saves_keep_history on public.saves;
create trigger saves_keep_history before update or delete on public.saves for each row execute function public.keep_save_history();

-- o administrador guarda uma cópia do save de agora (botão "guardar cópia agora" na ficha do jogador)
create or replace function public.admin_snapshot_save(p_user uuid, p_note text default null) returns text language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  select data into d from public.saves where user_id = p_user;
  if d is null then return 'missing'; end if;
  perform public.hist_keep(p_user, left('cópia guardada pelo administrador' || coalesce(': ' || nullif(trim(p_note), ''), ''), 120), d);
  return 'ok';
end $$;
revoke all on function public.admin_snapshot_save(uuid, text) from public, anon;
grant execute on function public.admin_snapshot_save(uuid, text) to authenticated;

-- restaurar: a versão escolhida vira o save atual e o que saiu do save volta para o jogo.
-- O aparelho do jogador troca o que tem pela versão restaurada (adminRestoreAt), sem juntar com o que ele fez depois.
drop function if exists public.admin_restore_save(bigint);
create or replace function public.admin_restore_save(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h public.save_history; cur jsonb; nd jsonb; ms bigint := (extract(epoch from now()) * 1000)::bigint;
  brands text[]; r record; freed text[] := '{}'; taken text[] := '{}'; conflict text[] := '{}';
  mine text := null; frig boolean := false; acc int := 0; pix_in numeric := 0; pix_out numeric := 0; lands_gone int := 0;
  pix_cancel numeric := 0; pix_back numeric := 0; back_to text[] := '{}'; out_ids jsonb := '[]'::jsonb; nm text;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
  select * into h from public.save_history where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'err', 'missing'); end if;
  select data into cur from public.saves where user_id = h.user_id;
  if cur is not null then perform public.hist_keep(h.user_id, 'antes de restaurar (cópia automática)', cur); end if;

  nd := h.data || jsonb_build_object('savedAt', ms, 'adminRestoreAt', ms);
  -- Pix que ele mandou depois da cópia: a cópia ainda tem esse dinheiro, então o Pix é desfeito dos dois lados
  -- (não recebido: cancelado; já recebido: sai de quem recebeu). O id vai para pixOut da cópia para o jogo dele não descontar de novo.
  if to_regclass('public.pix') is not null then
    select name into nm from public.public_profiles where user_id = h.user_id;
    for r in select * from public.pix where from_id = h.user_id and at > h.saved_at and to_id <> h.user_id loop
      if not r.claimed then delete from public.pix where id = r.id; pix_cancel := pix_cancel + r.amount;
      else
        insert into public.admin_grants (user_id, kind, amount, note) values (r.to_id, 'money', -r.amount,
          left('Pix de ' || coalesce(nm, 'outro jogador') || ' desfeito: a conta dele voltou no tempo', 200));
        pix_back := pix_back + r.amount; back_to := back_to || coalesce(r.to_name, 'jogador'); out_ids := out_ids || to_jsonb(r.id);
      end if;
    end loop;
    if jsonb_array_length(out_ids) > 0 then
      nd := jsonb_set(nd, '{pixOut}', coalesce(case when jsonb_typeof(nd->'pixOut') = 'array' then nd->'pixOut' end, '[]'::jsonb) || out_ids);
    end if;
  end if;
  insert into public.saves (user_id, data, updated_at) values (h.user_id, nd, now())
    on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;

  -- marcas: o que não está no save restaurado volta para a loja; o que está e ninguém tem fica com ele
  select coalesce(array_agg(distinct b->>'brand'), '{}') into brands
    from jsonb_each(case when jsonb_typeof(nd->'biz') = 'object' then nd->'biz' else '{}'::jsonb end) e(k, v),
         jsonb_array_elements(case when jsonb_typeof(e.v) = 'array' then e.v else '[]'::jsonb end) b
   where b->>'brand' is not null;
  if to_regclass('public.company_owner') is not null then
    for r in delete from public.company_owner where owner = h.user_id and not (brand = any(brands)) returning brand loop freed := freed || r.brand; end loop;
    for r in select x as brand, o.owner, o.owner_name from unnest(brands) x left join public.company_owner o on o.brand = x loop
      if r.owner is null then insert into public.company_owner (brand, owner, owner_name) select r.brand, h.user_id, p.name from public.public_profiles p where p.user_id = h.user_id on conflict (brand) do nothing; taken := taken || r.brand;
      elsif r.owner <> h.user_id then conflict := conflict || (r.brand || ' (hoje é de ' || coalesce(r.owner_name, 'outro jogador') || ')'); end if;
    end loop;
  end if;

  -- mina de ouro
  if to_regclass('public.gold_mine') is not null then
    if jsonb_typeof(nd->'mina') is distinct from 'object' then
      update public.gold_mine set owner = null, owner_name = null, since = null where id = 1 and owner = h.user_id;
      if found then mine := 'voltou à venda'; end if;
    elsif exists (select 1 from public.gold_mine where id = 1 and owner is null) then
      update public.gold_mine set owner = h.user_id, owner_name = (select name from public.public_profiles where user_id = h.user_id), since = now() where id = 1;
      mine := 'ficou com ele de novo';
    elsif exists (select 1 from public.gold_mine where id = 1 and owner <> h.user_id) then conflict := conflict || 'mina de ouro (hoje é de outro jogador)'::text;
    end if;
  end if;

  -- frigorífico aberto para terceiros
  if to_regclass('public.abate_plant') is not null and coalesce((nd->'abate'->>'owned')::boolean, false) is false then
    delete from public.abate_plant where owner = h.user_id;
    frig := found;
  end if;

  -- acessórios: a diferença entre o save de agora e o restaurado volta (ou sai) do estoque da loja
  if to_regclass('public.acc_stock') is not null then
    for r in
      with c as (select substr(x, 5) id, count(*) n from jsonb_array_elements_text(case when jsonb_typeof(cur->'owned') = 'array' then cur->'owned' else '[]'::jsonb end) x where x like 'acc:%' group by 1),
           o as (select substr(x, 5) id, count(*) n from jsonb_array_elements_text(case when jsonb_typeof(nd->'owned') = 'array' then nd->'owned' else '[]'::jsonb end) x where x like 'acc:%' group by 1)
      select coalesce(c.id, o.id) id, coalesce(c.n, 0) - coalesce(o.n, 0) d from c full join o on o.id = c.id
    loop
      if r.d <> 0 then
        insert into public.acc_stock (id) values (r.id) on conflict (id) do nothing;
        update public.acc_stock set left_qty = least(35, greatest(0, left_qty + r.d)) where id = r.id;
        acc := acc + r.d;
      end if;
    end loop;
  end if;

  -- terras que saíram pela restauração não são "terra sumida sem explicação"
  if to_regclass('public.land_audit') is not null then
    update public.land_audit set reason = 'save restaurado pelo administrador' where user_id = h.user_id and at >= now() and reason is null;
    get diagnostics lands_gone = row_count;
  end if;

  -- Pix depois da cópia (só para informar: recebidos somem do saldo dele; enviados voltam para ele e o outro fica com o dele)
  if to_regclass('public.pix') is not null then
    select coalesce(sum(amount) filter (where to_id = h.user_id), 0), 0 into pix_in, pix_out
      from public.pix where at > h.saved_at and (to_id = h.user_id or from_id = h.user_id);
  end if;

  -- ranking: mostra o patrimônio da versão restaurada até o jogo dele mandar o novo
  if h.worth is not null then update public.public_profiles set worth = h.worth, level = coalesce(h.level, level) where user_id = h.user_id; end if;

  insert into public.admin_log (action, target, details) values ('restore_save', h.user_id,
    jsonb_build_object('copia', h.id, 'de', h.saved_at, 'marcas_devolvidas', freed, 'mina', mine, 'frigorifico_fechado', frig, 'acessorios_devolvidos', acc, 'pix_cancelado', pix_cancel, 'pix_retirado_de_quem_recebeu', pix_back));
  return jsonb_build_object('ok', true, 'from', h.saved_at, 'freed', freed, 'taken', taken, 'conflict', conflict, 'mine', mine, 'frig', frig,
                            'acc', acc, 'lands', lands_gone, 'pixIn', pix_in, 'pixOut', pix_out,
                            'pixCancel', pix_cancel, 'pixBack', pix_back, 'pixBackTo', (select coalesce(array_agg(distinct x), '{}') from unnest(back_to) x));
end $$;
revoke all on function public.admin_restore_save(bigint) from public, anon;
grant execute on function public.admin_restore_save(bigint) to authenticated;
