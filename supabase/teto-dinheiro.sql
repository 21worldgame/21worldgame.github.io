-- 21 World: trava de dinheiro no servidor (24/11/2026, depois do TURBAO aparecer com R$ 999.999.999 e depois R$ 10 quatrilhões).
-- O save é gravado pelo próprio aparelho do jogador, então quem edita o jogo (console do navegador ou chamando a API
-- direto) podia gravar qualquer valor. Agora o servidor recusa a gravação quando o dinheiro (dinheiro + fichas x 2) sobe
-- mais do que dá para ganhar jogando naquele intervalo, ou passa do teto absoluto. A recusa volta para o aparelho, que
-- pega a cópia da nuvem (auth.js). O administrador (SQL Editor / restaurar cópia) não passa pela trava.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo.
-- Para ajustar: trocar os números em cash_jump_ok(). Hoje o maior ganho legítimo de uma vez é ~R$ 1,2 mi (venda de café).

create or replace function public.save_cash(d jsonb) returns numeric language sql immutable as $$
  select case when jsonb_typeof(d->'money') = 'number' then (d->>'money')::numeric else null end
       + 2 * case when jsonb_typeof(d->'chips') = 'number' then greatest(0, (d->>'chips')::numeric) else 0 end
$$;

-- subir até R$ 30 mi de uma gravação para a outra, mais R$ 3 mi por minuto passado; nunca acima de R$ 5 bi
create or replace function public.cash_jump_ok(before numeric, after numeric, mins numeric) returns boolean language sql immutable as $$
  select after is not null and after <= 5e9 and after - coalesce(before, 0) <= 3e7 + 3e6 * greatest(0, coalesce(mins, 0))
$$;

create or replace function public.saves_cash_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare b numeric; m numeric; h record;
begin
  if auth.uid() is distinct from new.user_id then return new; end if;   -- admin / servidor
  if tg_op = 'UPDATE' then
    b := public.save_cash(old.data); m := extract(epoch from now() - old.updated_at) / 60;
  else
    -- conta que apagou o save e gravou de novo: compara com a última cópia guardada
    select data, saved_at into h from public.save_history where user_id = new.user_id order by saved_at desc limit 1;
    if found then b := public.save_cash(h.data); m := extract(epoch from now() - h.saved_at) / 60; else b := 0; m := 0; end if;
  end if;
  if not public.cash_jump_ok(b, public.save_cash(new.data), m) then
    raise exception 'dinheiro sem explicacao: gravacao recusada' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists saves_cash_guard on public.saves;
create trigger saves_cash_guard before insert or update on public.saves for each row execute function public.saves_cash_guard();

-- ranking: patrimônio mandado pelo aparelho não sobe mais de R$ 30 mi por gravação nem passa de R$ 5 bi
-- ponytail: teto por gravação, não confere o patrimônio contra o save; calcular no servidor se alguém inflar aos poucos
create or replace function public.profiles_worth_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is distinct from new.user_id or new.worth is null then return new; end if;
  new.worth := least(new.worth, 5e9, case when tg_op = 'UPDATE' then greatest(coalesce(old.worth, 0), 0) + 3e7 else 5e9 end);   -- upsert: o INSERT passa aqui antes do UPDATE, por isso só o teto
  return new;
end $$;
drop trigger if exists profiles_worth_guard on public.public_profiles;
create trigger profiles_worth_guard before insert or update on public.public_profiles for each row execute function public.profiles_worth_guard();
