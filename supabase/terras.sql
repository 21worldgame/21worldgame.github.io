-- 21 World: auditoria de terras + devolução pelo administrador.
-- Toda vez que um save perde uma terra PRÓPRIA, o servidor anota aqui: qual terra, quando, de qual aparelho veio
-- a gravação e se o livro-caixa novo explica (venda, banco, troca). Sem explicação = suspeita de perda.
-- No painel (aba "terras") dá para ver tudo e devolver a terra ao jogador com um clique.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.

create table if not exists public.land_audit (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  at            timestamptz not null default now(),
  land          jsonb not null,
  reason        text,                -- null = o livro-caixa não explica o sumiço
  money_before  numeric,
  money_after   numeric,
  month_before  int,
  month_after   int,
  dev           text,                -- aparelho que gravou
  restored_at   timestamptz
);
create index if not exists land_audit_at on public.land_audit (at desc);
create index if not exists land_audit_user on public.land_audit (user_id, at desc);
alter table public.land_audit enable row level security;
drop policy if exists land_audit_admin_select on public.land_audit;
drop policy if exists land_audit_admin_update on public.land_audit;
create policy land_audit_admin_select on public.land_audit for select to authenticated using (public.is_admin());
create policy land_audit_admin_update on public.land_audit for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.audit_lands() returns trigger
language plpgsql security definer set search_path = public as $$
declare l jsonb; why text; logtxt text; region text; ha text;
begin
  if old.data is null or new.data is null then return new; end if;
  select coalesce(string_agg(e->>'txt', ' | '), '') into logtxt
    from (select jsonb_array_elements(case when jsonb_typeof(new.data->'log') = 'array' then new.data->'log' else '[]'::jsonb end) e limit 60) x;
  for l in select value from jsonb_array_elements(case when jsonb_typeof(old.data->'lands') = 'array' then old.data->'lands' else '[]'::jsonb end) loop
    continue when coalesce(l->>'own', 'false') <> 'true';
    continue when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(new.data->'lands') = 'array' then new.data->'lands' else '[]'::jsonb end) n
                          where n->>'id' = l->>'id');
    region := coalesce(l->>'region', '?'); ha := coalesce(l->>'ha', '?');
    why := case
      when logtxt ilike '%banco tomou a terra em ' || region || '%' then 'banco tomou (dívida atrasada)'
      when logtxt ilike '%venda de ' || ha || ' ha%' then 'vendida pelo jogador'
      when logtxt ilike '%vendeu%' and logtxt ilike '%' || region || '%' then 'vendida na loja ou para jogador'
      when logtxt ilike '%troca%' then 'trocada com outro jogador'
      when new.data->>'month' is not null and (new.data->>'month')::int <= 1 and (old.data->>'month')::int > 1 then 'progresso reiniciado'
      else null end;
    insert into public.land_audit (user_id, land, reason, money_before, money_after, month_before, month_after, dev)
    values (new.user_id, l, why, (old.data->>'money')::numeric, (new.data->>'money')::numeric,
            (old.data->>'month')::int, (new.data->>'month')::int, new.data->>'dev');
  end loop;
  return new;
exception when others then
  return new;   -- a auditoria nunca impede o jogo de salvar
end $$;
drop trigger if exists saves_audit_lands on public.saves;
create trigger saves_audit_lands before update on public.saves for each row execute function public.audit_lands();

-- devolução: o admin manda uma ordem "land" com a terra; o jogo do jogador aplica na próxima vez que abrir
alter table public.admin_grants add column if not exists item jsonb;
alter table public.admin_grants drop constraint if exists admin_grants_kind_check;
alter table public.admin_grants add constraint admin_grants_kind_check check (kind in ('money', 'chips', 'xp', 'reset', 'message', 'land'));
