-- Relógio do mundo no servidor: a mesma conta de world.js (mudar lá, mudar aqui).
-- De dia o mês passa em monthMs (5 min); de madrugada, das 01:00 às 09:00 de Brasília, em nightMs (10 min).
-- A config fica em game_config.data->'world' = { epoch, base, monthMs, nightMs }. Pode rodar de novo sem problema.

-- meses corridos desde a meia-noite de Brasília de 01/01/1970 até t_ms (milissegundos)
create or replace function public.world_units(t_ms numeric, m numeric, n numeric) returns numeric language sql immutable as $$
  with c as (select 3600000::numeric as h, 86400000::numeric as dms),
       p as (select c.h * 1 as a, c.h * 9 as b, c.dms, (t_ms - c.h * 3) as loc from c),
       q as (select a, b, dms, floor(loc / dms) as d, loc - floor(loc / dms) * dms as x from p)
  select d * (a / m + (b - a) / n + (dms - b) / m)
       + least(x, a) / m + greatest(0, least(x, b) - a) / n + greatest(0, x - b) / m
  from q
$$;

-- mês do mundo agora (o mesmo número que o jogo mostra)
create or replace function public.world_month(p_at timestamptz default now()) returns bigint language sql stable as $$
  with w as (select coalesce((data->'world'->>'epoch')::numeric, 0) as epoch, coalesce((data->'world'->>'base')::numeric, 1) as base,
                    greatest(10000, coalesce((data->'world'->>'monthMs')::numeric, 300000)) as m,
                    greatest(10000, coalesce((data->'world'->>'nightMs')::numeric, 2 * greatest(10000, coalesce((data->'world'->>'monthMs')::numeric, 300000)))) as n
             from public.game_config where id = 1)
  select (base + floor(greatest(0, public.world_units((extract(epoch from p_at) * 1000)::numeric, m, n) - public.world_units(epoch, m, n))))::bigint from w
$$;
grant execute on function public.world_month(timestamptz) to anon, authenticated;
