-- 21 World: trava de patrimônio no servidor (24/11/2026, depois do TURBAO aparecer com R$ 999.999.999 e R$ 10 quatrilhões).
-- O save é gravado pelo próprio aparelho do jogador, então quem edita o jogo (console do navegador ou API direto) podia
-- gravar qualquer coisa: dinheiro, terras, gado, empresas, apagar dívida. Agora o SERVIDOR calcula o patrimônio do save
-- (srv_worth, a mesma conta do netWorth do jogo em logic.js, aproximada) e recusa a gravação quando ele sobe mais do que dá
-- para ganhar jogando no intervalo. Comprar e vender não mexe no patrimônio (dinheiro vira bem e bem vira dinheiro), então
-- só lucro conta. A recusa volta para o aparelho, que pega a última gravação válida (auth.js).
-- O ranking também passa a usar no máximo o patrimônio que o servidor calculou.
-- O administrador (SQL Editor, restaurar cópia) não passa pela trava.
-- Calibragem (histórico de 22 a 24/11): o maior lucro honesto foi ~R$ 1,2 mi entre duas gravações e ~R$ 1,5 mi em 1 hora.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo.

create or replace function public.jn(v jsonb) returns numeric language sql immutable as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else 0 end $$;
create or replace function public.ja(v jsonb) returns setof jsonb language sql immutable as $$
  select jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) $$;

-- patrimônio pelo servidor: dinheiro, fichas, terras, gado, carros, granja, suínos, negócios, mina, investimentos,
-- empréstimos feitos, estoque, cartas, cavalos/cães, colhedora, frigorífico, menos as dívidas.
-- ponytail: aproximado (pomar/canavial e marcas não entram); se aparecer jogo novo com bem valioso, somar aqui
create or replace function public.srv_worth(d jsonb) returns numeric language sql immutable set search_path = public as $$
  select jn(d->'money') + 2 * greatest(0, jn(d->'chips'))
    + coalesce((select sum(jn(l->'value')) from ja(d->'lands') l where l->>'own' = 'true'), 0)
    + coalesce((select sum(jn(h->'heads') * jn(h->'kg') * 0.52 / 15) from ja(d->'herd') h), 0) * least(jn(d->'prices'->'arroba'), 1000)
    + coalesce((select sum(jn(c->'value')) from ja(d->'cars') c), 0)
    + coalesce((select sum(jn(x->'value')) from ja(d->'granja'->'houses') x), 0)
    + coalesce((select sum(jn(x->'birds')) * 2.8 from ja(d->'granja'->'lots') x), 0) * least(jn(d->'prices'->'frango'), 30)
    + coalesce((select sum(jn(x->'value')) * 0.7 from ja(d->'suinos'->'barns') x), 0)
    + coalesce((select sum(jn(x->'pigs')) * 110 from ja(d->'suinos'->'lots') x), 0) * least(jn(d->'prices'->'suino'), 30)
    + coalesce((select sum(greatest(jn(x->'value'), jn(x->'cost'), jn(x->'price'), jn(x->'capital')))
                from jsonb_each(case when jsonb_typeof(d->'biz') = 'object' then d->'biz' else '{}' end) e(k, v), ja(e.v) x), 0)
    + case when jsonb_typeof(d->'mina') = 'object' then 72e6 + jn(d->'mina'->'vein') * least(jn(d->'prices'->'ouro'), 2e6) * 0.3 else 0 end
    + coalesce((select sum(jn(i->'amt') + jn(i->'acc')) from ja(d->'invest') i), 0)
    + coalesce((select sum(jn(x->'bal')) from ja(d->'lent') x), 0)
    + coalesce((select sum(jn(q.v) * least(jn(d->'prices'->q.k), 2e6))
                from jsonb_each(case when jsonb_typeof(d->'stock') = 'object' then d->'stock' else '{}' end) q(k, v)), 0)
    + jn(d->'caneHarvester'->'value') + case when d->'abate'->>'owned' = 'true' then jn(d->'abate'->'value') else 0 end
    + coalesce((select count(*) * 30000 from ja(d->'cards')), 0)
    + coalesce((select sum(greatest(jn(a->'cost'), 20000)) from ja(d->'stable'->'animals') a), 0)
    - coalesce((select sum(jn(x->'bal')) from ja(d->'loans') x), 0)
$$;

-- quanto o patrimônio pode subir em "mins" minutos partindo de "w0":
-- R$ 3 mi de uma vez + R$ 100 mil/min na primeira hora + R$ 20 mil/min depois (jogo fechado avançando meses)
-- + 10% do patrimônio por hora (até 24 h) para quem já é grande
create or replace function public.worth_room(w0 numeric, mins numeric) returns numeric language sql immutable as $$
  select 3e6 + 1e5 * least(greatest(mins, 0), 60) + 2e4 * greatest(mins - 60, 0)
       + greatest(coalesce(w0, 0), 0) * 0.1 * least(greatest(mins, 0), 1440) / 60 $$;

-- dinheiro mandado a outro jogador depois de "desde" (Pix, frigorífico, Central): o patrimônio de quem mandou tem que cair
-- (antes dava para mandar sem descontar do save e o outro recebia dinheiro criado do nada)
create or replace function public.pix_sent(u uuid, desde timestamptz) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from public.pix where from_id = u and to_id <> u and at > desde), 0)
       + coalesce((select sum(pay) from public.abate_job where buyer = u and owner <> u and at > desde), 0)        -- frigorífico de outro jogador
       + coalesce((select sum(amount) from public.pro_payments where payer = u and at > desde), 0) $$;            -- Central de profissionais
revoke all on function public.pix_sent(uuid, timestamptz) from public, anon, authenticated;

drop function if exists public.cash_jump_ok(numeric, numeric, numeric);
drop function if exists public.save_cash(jsonb);

create or replace function public.saves_cash_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric := srv_worth(new.data); w0 numeric; m numeric; r record; extra numeric := 0; t0 timestamptz;
begin
  if auth.uid() is distinct from new.user_id then return new; end if;   -- admin / servidor
  -- dinheiro que entra de fora do save nas últimas 24 h: crédito do administrador e Pix recebido
  if to_regclass('public.admin_grants') is not null then
    select coalesce(sum(amount), 0) into extra from admin_grants where user_id = new.user_id and kind = 'money' and amount > 0 and created_at > now() - interval '24 hours';
  end if;
  if to_regclass('public.pix') is not null then
    extra := extra + (select coalesce(sum(amount), 0) from pix where to_id = new.user_id and at > now() - interval '24 hours');
  end if;
  extra := extra + coalesce((select sum(pay) from abate_job where owner = new.user_id and at > now() - interval '24 hours'), 0)
                 + coalesce((select sum(amount) from pro_payouts where to_id = new.user_id and at > now() - interval '24 hours'), 0);
  if jn(new.data->'money') > 5e9 or w > 5e10 or jsonb_typeof(new.data->'money') is distinct from 'number' then
    raise exception 'dinheiro sem explicacao: gravacao recusada' using errcode = 'P0001';
  end if;
  -- 1) contra a gravação anterior (ou, se apagou o save, contra a última cópia)
  if tg_op = 'UPDATE' then w0 := srv_worth(old.data); m := extract(epoch from now() - old.updated_at) / 60; t0 := old.updated_at;
  else
    select srv_worth(h.data) w, h.saved_at t into r from save_history h where h.user_id = new.user_id order by saved_at desc limit 1;
    if found then w0 := r.w; m := extract(epoch from now() - r.t) / 60; t0 := r.t; else w0 := 0; m := 0; t0 := now(); end if;
  end if;
  if w - w0 > worth_room(w0, m) + extra - pix_sent(new.user_id, t0) then raise exception 'dinheiro sem explicacao: gravacao recusada' using errcode = 'P0001'; end if;
  -- 2) contra a cópia de ~1 hora atrás: muitas gravações pequenas seguidas não somam mais que o permitido na hora
  select srv_worth(h.data) w, h.saved_at t into r from save_history h
   where h.user_id = new.user_id and h.saved_at <= now() - interval '60 minutes' order by saved_at desc limit 1;
  if not found then select srv_worth(h.data) w, h.saved_at t into r from save_history h where h.user_id = new.user_id order by saved_at asc limit 1; end if;
  if found and w - r.w > worth_room(r.w, extract(epoch from now() - r.t) / 60) + extra - pix_sent(new.user_id, r.t) then
    raise exception 'dinheiro sem explicacao: gravacao recusada' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists saves_cash_guard on public.saves;
create trigger saves_cash_guard before insert or update on public.saves for each row execute function public.saves_cash_guard();

-- ranking: no máximo o patrimônio que o servidor calcula do save (com folga, a conta do servidor é aproximada)
create or replace function public.profiles_worth_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric;
begin
  if auth.uid() is distinct from new.user_id or new.worth is null then return new; end if;
  select srv_worth(data) into w from saves where user_id = new.user_id;
  new.worth := least(new.worth, coalesce(greatest(w, 0) * 1.5 + 1e6, 1e6), 5e10);
  return new;
end $$;
drop trigger if exists profiles_worth_guard on public.public_profiles;
create trigger profiles_worth_guard before insert or update on public.public_profiles for each row execute function public.profiles_worth_guard();

-- crédito do administrador: o jogador só pode marcar como aplicado (antes a política deixava mudar o valor da própria linha)
create or replace function public.grants_owner_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not distinct from old.user_id and not public.is_admin()
     and (to_jsonb(new) - 'applied_at') is distinct from (to_jsonb(old) - 'applied_at') then
    raise exception 'so o administrador muda o credito' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists grants_owner_guard on public.admin_grants;
create trigger grants_owner_guard before update on public.admin_grants for each row execute function public.grants_owner_guard();
