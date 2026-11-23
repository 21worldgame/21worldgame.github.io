-- 21 World: Central de Profissionais (perfis, serviços, contratos com dinheiro em custódia, entregas, avaliações, denúncias e penalidades).
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.
-- Depende de admin.sql (is_admin, is_banned) e schema.sql (public_profiles).
--
-- Como o dinheiro anda: ao contratar, o contratante paga o contrato inteiro (pro_payments; o jogo desconta do save dele).
-- O servidor segura o valor. A cada período que termina: se o profissional registrou entrega naquele período (ou o contratante
-- confirmou), o valor do período vai para o profissional; se não, volta para o contratante e o profissional leva penalidade.
-- Os créditos ficam em pro_payouts e cada jogo pega os seus (igual ao Pix: credita, salva, confirma com pro_ack).

-- ---------- tabelas ----------
create table if not exists public.pro_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  title text not null check (char_length(title) between 3 and 40),
  bio text not null default '' check (char_length(bio) <= 600),
  cv text not null default '' check (char_length(cv) <= 1500),
  services jsonb not null default '[]',
  active boolean not null default true,
  verified boolean not null default false,
  rating_sum int not null default 0,
  rating_n int not null default 0,
  stars numeric not null default 4,
  strikes60 int not null default 0,
  done int not null default 0,          -- contratos concluídos com pagamento
  delivered int not null default 0,     -- períodos entregues
  late int not null default 0,          -- períodos sem entrega
  earned bigint not null default 0,
  suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pro_contracts (
  id bigint generated always as identity primary key,
  pro_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  pro_name text, client_name text,
  service jsonb not null,
  period text not null check (period in ('dia', 'semana', 'mes', 'unico')),
  len interval not null,
  price bigint not null check (price > 0),
  periods int not null check (periods between 1 and 400),
  started_at timestamptz not null default now(),
  settled int not null default 0,       -- períodos já acertados
  confirmed int not null default 0,     -- períodos que o contratante confirmou
  paid bigint not null default 0, released bigint not null default 0, refunded bigint not null default 0,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'cancelado', 'disputa', 'encerrado')),
  renewals int not null default 0,
  rated boolean not null default false,
  last_event text, last_actor uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pro_contracts_pro on public.pro_contracts (pro_id, updated_at desc);
create index if not exists pro_contracts_client on public.pro_contracts (client_id, updated_at desc);
create index if not exists pro_contracts_open on public.pro_contracts (status) where status = 'ativo';
create table if not exists public.pro_deliveries (
  id bigint generated always as identity primary key,
  contract_id bigint not null references public.pro_contracts(id) on delete cascade,
  at timestamptz not null default now(),
  text text not null check (char_length(text) between 3 and 400)
);
create index if not exists pro_deliveries_c on public.pro_deliveries (contract_id, at);
create table if not exists public.pro_reviews (
  contract_id bigint primary key references public.pro_contracts(id) on delete cascade,
  pro_id uuid not null references auth.users(id) on delete cascade,
  client_name text,
  stars int not null check (stars between 1 and 5),
  text text check (char_length(text) <= 300),
  at timestamptz not null default now()
);
create index if not exists pro_reviews_pro on public.pro_reviews (pro_id, at desc);
create table if not exists public.pro_reports (
  id bigint generated always as identity primary key,
  contract_id bigint not null references public.pro_contracts(id) on delete cascade,
  by_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('nao_entregou', 'fraude', 'abuso', 'outro')),
  text text check (char_length(text) <= 500),
  status text not null default 'aberta' check (status in ('aberta', 'procedente', 'improcedente')),
  decision text,
  at timestamptz not null default now(),
  decided_at timestamptz
);
create table if not exists public.pro_strikes (
  id bigint generated always as identity primary key,
  pro_id uuid not null references auth.users(id) on delete cascade,
  contract_id bigint references public.pro_contracts(id) on delete set null,
  reason text, weight numeric not null default 0.5,
  at timestamptz not null default now()
);
create index if not exists pro_strikes_pro on public.pro_strikes (pro_id, at desc);
create table if not exists public.pro_payments (
  id bigint generated always as identity primary key,
  contract_id bigint not null references public.pro_contracts(id) on delete cascade,
  payer uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  memo text,
  at timestamptz not null default now()
);
create index if not exists pro_payments_payer on public.pro_payments (payer, at desc);
create table if not exists public.pro_payouts (
  id bigint generated always as identity primary key,
  to_id uuid not null references auth.users(id) on delete cascade,
  contract_id bigint references public.pro_contracts(id) on delete set null,
  amount bigint not null check (amount > 0),
  kind text not null check (kind in ('liberado', 'reembolso')),
  memo text,
  claimed boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists pro_payouts_open on public.pro_payouts (to_id) where not claimed;

-- ---------- quem vê o quê (escrever, só pelas funções abaixo) ----------
alter table public.pro_profiles enable row level security;
alter table public.pro_contracts enable row level security;
alter table public.pro_deliveries enable row level security;
alter table public.pro_reviews enable row level security;
alter table public.pro_reports enable row level security;
alter table public.pro_strikes enable row level security;
alter table public.pro_payments enable row level security;
alter table public.pro_payouts enable row level security;
drop policy if exists pro_profiles_read on public.pro_profiles;
create policy pro_profiles_read on public.pro_profiles for select to anon, authenticated using (true);
drop policy if exists pro_contracts_read on public.pro_contracts;
create policy pro_contracts_read on public.pro_contracts for select to authenticated using (auth.uid() in (pro_id, client_id) or public.is_admin());
drop policy if exists pro_deliveries_read on public.pro_deliveries;
create policy pro_deliveries_read on public.pro_deliveries for select to authenticated
  using (exists (select 1 from public.pro_contracts c where c.id = contract_id and (auth.uid() in (c.pro_id, c.client_id) or public.is_admin())));
drop policy if exists pro_reviews_read on public.pro_reviews;
create policy pro_reviews_read on public.pro_reviews for select to anon, authenticated using (true);
drop policy if exists pro_reports_read on public.pro_reports;
create policy pro_reports_read on public.pro_reports for select to authenticated using (auth.uid() = by_id or public.is_admin());
drop policy if exists pro_strikes_read on public.pro_strikes;
create policy pro_strikes_read on public.pro_strikes for select to authenticated using (auth.uid() = pro_id or public.is_admin());
drop policy if exists pro_payments_read on public.pro_payments;
create policy pro_payments_read on public.pro_payments for select to authenticated using (auth.uid() = payer or public.is_admin());
drop policy if exists pro_payouts_read on public.pro_payouts;
create policy pro_payouts_read on public.pro_payouts for select to authenticated using (auth.uid() = to_id or public.is_admin());
revoke insert, update, delete on public.pro_profiles, public.pro_contracts, public.pro_deliveries, public.pro_reviews, public.pro_reports,
  public.pro_strikes, public.pro_payments, public.pro_payouts from anon, authenticated;

-- ---------- regras internas (não são chamadas direto pelo jogo) ----------
create or replace function public.pro_name_of(p uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.public_profiles where user_id = p), 'jogador') $$;

create or replace function public.pro_pay_out(p_to uuid, p_amount bigint, p_memo text, p_kind text, p_contract bigint) returns void
language sql security definer set search_path = public as $$
  insert into public.pro_payouts (to_id, amount, memo, kind, contract_id) values (p_to, p_amount, left(p_memo, 120), p_kind, p_contract) $$;

-- estrelas: média das avaliações (começa em 4, com peso de 2 avaliações) menos as penalidades dos últimos 60 dias
create or replace function public.pro_recalc(p uuid) returns void language plpgsql security definer set search_path = public as $$
declare pen numeric; n int;
begin
  select coalesce(sum(weight), 0), count(*) into pen, n from public.pro_strikes where pro_id = p and at > now() - interval '60 days';
  update public.pro_profiles set strikes60 = n,
    stars = greatest(0, least(5, round((rating_sum + 8)::numeric / (rating_n + 2) - pen, 2))) where user_id = p;
end $$;

-- penalidade: 3 ou mais em 30 dias suspende o profissional da Central por 7 dias
create or replace function public.pro_strike(p uuid, p_contract bigint, p_reason text, p_weight numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_weight <= 0 then return; end if;
  insert into public.pro_strikes (pro_id, contract_id, reason, weight) values (p, p_contract, left(p_reason, 200), p_weight);
  if (select count(*) from public.pro_strikes where pro_id = p and at > now() - interval '30 days') >= 3 then
    update public.pro_profiles set suspended_until = greatest(coalesce(suspended_until, now()), now() + interval '7 days') where user_id = p;
  end if;
  perform public.pro_recalc(p);
end $$;

-- índice do período em andamento (0 = primeiro)
create or replace function public.pro_idx(c public.pro_contracts) returns int language sql stable as $$
  select greatest(0, floor(extract(epoch from now() - c.started_at) / extract(epoch from c.len)))::int $$;

-- acerta os períodos que terminaram (ou que o contratante confirmou)
create or replace function public.pro_settle(c_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare c public.pro_contracts; i int; s timestamptz; e timestamptz; rel bigint := 0; ref bigint := 0; nrel int := 0; nref int := 0; ev text;
begin
  select * into c from public.pro_contracts where id = c_id for update;
  if not found or c.status <> 'ativo' then return; end if;
  i := c.settled;
  while i < c.periods loop
    s := c.started_at + c.len * i; e := s + c.len;
    exit when e > now() and i >= c.confirmed;
    if i < c.confirmed or exists (select 1 from public.pro_deliveries d where d.contract_id = c.id and d.at >= s and d.at < e)
      then rel := rel + c.price; nrel := nrel + 1; else ref := ref + c.price; nref := nref + 1; end if;
    i := i + 1;
  end loop;
  if i = c.settled then return; end if;
  if rel > 0 then
    perform public.pro_pay_out(c.pro_id, rel, format('Central: contrato #%s (%s) com %s', c.id, c.service->>'title', c.client_name), 'liberado', c.id);
    update public.pro_profiles set earned = earned + rel, delivered = delivered + nrel where user_id = c.pro_id;
  end if;
  if ref > 0 then
    perform public.pro_pay_out(c.client_id, ref, format('Central: reembolso do contrato #%s (sem entrega)', c.id), 'reembolso', c.id);
    update public.pro_profiles set late = late + nref where user_id = c.pro_id;
    perform public.pro_strike(c.pro_id, c.id, format('%s período(s) sem entrega no contrato #%s', nref, c.id), 0.5 * nref);
  end if;
  ev := concat_ws(' · ', case when rel > 0 then format('R$ %s liberados ao profissional', rel) end, case when ref > 0 then format('R$ %s devolvidos (período sem entrega)', ref) end);
  update public.pro_contracts set settled = i, released = released + rel, refunded = refunded + ref,
    status = case when i >= periods then 'concluido' else status end,
    last_event = case when i >= periods then concat_ws(' · ', ev, 'contrato concluído') else ev end, last_actor = null, updated_at = now()
    where id = c.id;
  if i >= c.periods and c.released + rel > 0 then update public.pro_profiles set done = done + 1 where user_id = c.pro_id; end if;
end $$;

-- ---------- o que o jogo chama ----------
-- salvar o perfil profissional (os números de reputação só o servidor mexe)
create or replace function public.pro_save_profile(p_title text, p_bio text, p_cv text, p_services jsonb, p_active boolean)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sv jsonb;
begin
  if uid is null then return 'login'; end if;
  if public.is_banned(uid) then return 'banned'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then return 'title'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', left(coalesce(nullif(x->>'id', ''), md5(random()::text)), 12),
      'title', left(trim(x->>'title'), 60), 'desc', left(coalesce(x->>'desc', ''), 400), 'obl', left(coalesce(x->>'obl', ''), 300),
      'price', greatest(100, least(100000000000, floor(coalesce((x->>'price')::numeric, 0))))::bigint,
      'period', x->>'period', 'days', greatest(1, least(30, coalesce((x->>'days')::int, 7))))), '[]'::jsonb)
    into sv from (select x from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) x limit 8) t
    where x->>'period' in ('dia', 'semana', 'mes', 'unico') and char_length(trim(coalesce(x->>'title', ''))) >= 3;
  insert into public.pro_profiles (user_id, name, title, bio, cv, services, active)
    values (uid, public.pro_name_of(uid), left(trim(p_title), 40), left(coalesce(p_bio, ''), 600), left(coalesce(p_cv, ''), 1500), sv, coalesce(p_active, true))
    on conflict (user_id) do update set name = excluded.name, title = excluded.title, bio = excluded.bio, cv = excluded.cv,
      services = excluded.services, active = excluded.active, updated_at = now();
  return 'ok';
end $$;

-- contratar: paga o contrato inteiro (fica em custódia); devolve 'ok:<contrato>:<pagamento>'
create or replace function public.pro_hire(p_pro uuid, p_service text, p_periods int) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.pro_profiles; sv jsonb; per text; n int; pr bigint; tot bigint; w numeric; ln interval; cid bigint; pid bigint;
begin
  if uid is null then return 'login'; end if;
  if p_pro = uid then return 'self'; end if;
  if public.is_banned(uid) then return 'banned'; end if;
  select * into p from public.pro_profiles where user_id = p_pro;
  if not found or not p.active then return 'nopro'; end if;
  if p.suspended_until > now() then return 'suspended'; end if;
  select x into sv from jsonb_array_elements(p.services) x where x->>'id' = p_service limit 1;
  if sv is null then return 'noservice'; end if;
  per := sv->>'period'; pr := (sv->>'price')::bigint;
  n := case when per = 'unico' then 1 else greatest(1, least(coalesce(p_periods, 1), case per when 'dia' then 90 when 'semana' then 52 else 12 end)) end;
  tot := pr * n;
  select worth into w from public.public_profiles where user_id = uid;
  if w is null or tot > greatest(w, 0) then return 'worth'; end if;
  if (select count(*) from public.pro_contracts where client_id = uid and created_at > now() - interval '1 hour') >= 20 then return 'limit'; end if;
  ln := case per when 'dia' then interval '1 day' when 'semana' then interval '7 days' when 'mes' then interval '30 days'
    else make_interval(days => (sv->>'days')::int) end;
  insert into public.pro_contracts (pro_id, client_id, pro_name, client_name, service, period, len, price, periods, paid, last_event, last_actor)
    values (p_pro, uid, p.name, public.pro_name_of(uid), sv, per, ln, pr, n, tot, format('novo contrato: %s', sv->>'title'), uid) returning id into cid;
  insert into public.pro_payments (contract_id, payer, amount, memo) values (cid, uid, tot, format('Central: contrato #%s (%s) com %s', cid, sv->>'title', p.name)) returning id into pid;
  return format('ok:%s:%s', cid, pid);
end $$;

-- renovar: mais períodos, pagos agora; devolve 'ok:<pagamento>'
create or replace function public.pro_renew(p_id bigint, p_periods int) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.pro_contracts; n int; tot bigint; w numeric; pid bigint;
begin
  perform public.pro_settle(p_id);
  select * into c from public.pro_contracts where id = p_id for update;
  if not found or c.client_id is distinct from uid then return 'nocontract'; end if;
  if c.status not in ('ativo', 'concluido') then return 'status'; end if;
  if exists (select 1 from public.pro_profiles where user_id = c.pro_id and (suspended_until > now() or not active)) then return 'suspended'; end if;
  n := greatest(1, least(coalesce(p_periods, 1), 52)); tot := c.price * n;
  if c.periods + n > 400 then return 'limit'; end if;
  select worth into w from public.public_profiles where user_id = uid;
  if w is null or tot > greatest(w, 0) then return 'worth'; end if;
  if c.status = 'concluido' then   -- recomeça agora: os períodos novos contam a partir deste momento
    if c.released > 0 then update public.pro_profiles set done = greatest(0, done - 1) where user_id = c.pro_id; end if;
    update public.pro_contracts set started_at = now() - len * settled, confirmed = settled where id = p_id;
  end if;
  update public.pro_contracts set periods = periods + n, paid = paid + tot, renewals = renewals + 1, status = 'ativo',
    last_event = format('renovado por mais %s período(s)', n), last_actor = uid, updated_at = now() where id = p_id;
  insert into public.pro_payments (contract_id, payer, amount, memo) values (p_id, uid, tot, format('Central: renovação do contrato #%s', p_id)) returning id into pid;
  return format('ok:%s', pid);
end $$;

-- profissional registra uma entrega (vale para o período em andamento)
create or replace function public.pro_deliver(p_id bigint, p_text text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.pro_contracts;
begin
  perform public.pro_settle(p_id);
  select * into c from public.pro_contracts where id = p_id;
  if not found or c.pro_id is distinct from uid then return 'nocontract'; end if;
  if c.status <> 'ativo' then return 'status'; end if;
  if char_length(trim(coalesce(p_text, ''))) < 3 then return 'text'; end if;
  if (select count(*) from public.pro_deliveries where contract_id = p_id and at > now() - interval '1 minute') >= 3 then return 'limit'; end if;
  insert into public.pro_deliveries (contract_id, text) values (p_id, left(trim(p_text), 400));
  update public.pro_contracts set last_event = format('entrega registrada: %s', left(trim(p_text), 80)), last_actor = uid, updated_at = now() where id = p_id;
  return 'ok';
end $$;

-- contratante confirma a entrega do período em andamento: libera na hora
create or replace function public.pro_confirm(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.pro_contracts;
begin
  perform public.pro_settle(p_id);
  select * into c from public.pro_contracts where id = p_id for update;
  if not found or c.client_id is distinct from uid then return 'nocontract'; end if;
  if c.status <> 'ativo' then return 'status'; end if;
  update public.pro_contracts set confirmed = greatest(confirmed, least(periods, public.pro_idx(c) + 1)) where id = p_id;
  perform public.pro_settle(p_id);
  update public.pro_contracts set last_event = concat_ws(' · ', 'entrega confirmada pelo contratante', last_event), last_actor = uid where id = p_id;
  return 'ok';
end $$;

-- cancelar. Contratante: o período em andamento é pago se já teve entrega; o resto volta para ele.
-- Profissional: tudo o que não foi acertado volta para o contratante; depois de 1 h de contrato conta como penalidade.
create or replace function public.pro_cancel(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.pro_contracts; s timestamptz; rel bigint := 0; ref bigint;
begin
  perform public.pro_settle(p_id);
  select * into c from public.pro_contracts where id = p_id for update;
  if not found or uid not in (c.pro_id, c.client_id) then return 'nocontract'; end if;
  if c.status <> 'ativo' then return 'status'; end if;
  s := c.started_at + c.len * c.settled;
  if uid = c.client_id and exists (select 1 from public.pro_deliveries d where d.contract_id = p_id and d.at >= s) then rel := c.price; end if;
  ref := c.price * (c.periods - c.settled) - rel;
  if rel > 0 then
    perform public.pro_pay_out(c.pro_id, rel, format('Central: contrato #%s cancelado (período entregue pago)', p_id), 'liberado', p_id);
    update public.pro_profiles set earned = earned + rel, delivered = delivered + 1 where user_id = c.pro_id;
  end if;
  if ref > 0 then perform public.pro_pay_out(c.client_id, ref, format('Central: reembolso do contrato #%s cancelado', p_id), 'reembolso', p_id); end if;
  if uid = c.pro_id and now() - c.created_at > interval '1 hour' then
    perform public.pro_strike(c.pro_id, p_id, format('abandonou o contrato #%s', p_id), 1);
  end if;
  update public.pro_contracts set status = 'cancelado', settled = periods, released = released + rel, refunded = refunded + ref,
    last_event = format('cancelado pelo %s', case when uid = c.client_id then 'contratante' else 'profissional' end), last_actor = uid, updated_at = now() where id = p_id;
  return 'ok';
end $$;

-- avaliar (uma vez por contrato, depois de algum pagamento liberado ou do fim do contrato)
create or replace function public.pro_review(p_id bigint, p_stars int, p_text text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.pro_contracts;
begin
  select * into c from public.pro_contracts where id = p_id for update;
  if not found or c.client_id is distinct from uid then return 'nocontract'; end if;
  if c.rated then return 'done'; end if;
  if c.released = 0 and c.status not in ('concluido', 'cancelado', 'encerrado') then return 'early'; end if;
  if p_stars not between 1 and 5 then return 'stars'; end if;
  insert into public.pro_reviews (contract_id, pro_id, client_name, stars, text) values (p_id, c.pro_id, c.client_name, p_stars, nullif(left(trim(coalesce(p_text, '')), 300), ''));
  update public.pro_contracts set rated = true, last_event = format('avaliação: %s estrela(s)', p_stars), last_actor = uid, updated_at = now() where id = p_id;
  update public.pro_profiles set rating_sum = rating_sum + p_stars, rating_n = rating_n + 1 where user_id = c.pro_id;
  perform public.pro_recalc(c.pro_id);
  return 'ok';
end $$;

-- denunciar: contrato ativo fica em disputa (o dinheiro em custódia congela até o administrador decidir)
create or replace function public.pro_report(p_id bigint, p_reason text, p_text text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.pro_contracts;
begin
  perform public.pro_settle(p_id);
  select * into c from public.pro_contracts where id = p_id for update;
  if not found or c.client_id is distinct from uid then return 'nocontract'; end if;
  if exists (select 1 from public.pro_reports where contract_id = p_id and status = 'aberta') then return 'open'; end if;
  if c.status not in ('ativo', 'concluido', 'cancelado') or c.updated_at < now() - interval '14 days' and c.status <> 'ativo' then return 'status'; end if;
  insert into public.pro_reports (contract_id, by_id, reason, text) values (p_id, uid, coalesce(nullif(p_reason, ''), 'outro'), left(coalesce(p_text, ''), 500));
  update public.pro_contracts set status = case when status = 'ativo' then 'disputa' else status end,
    last_event = 'denúncia aberta: aguardando o administrador', last_actor = uid, updated_at = now() where id = p_id;
  return 'ok';
end $$;

-- receber: o jogo credita no save, sobe o save e só então confirma aqui (mesmo cuidado do Pix)
create or replace function public.pro_ack(p_ids bigint[]) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or p_ids is null then return 0; end if;
  update public.pro_payouts set claimed = true where to_id = auth.uid() and not claimed and id = any(p_ids[1:200]);
  get diagnostics n = row_count; return n;
end $$;

-- relógio da Central: qualquer jogo online chama de minuto em minuto; acerta os períodos vencidos e atualiza as estrelas
create or replace function public.pro_tick() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.pro_contracts where status = 'ativo' and started_at + len * (settled + 1) <= now() order by id limit 300 loop
    perform public.pro_settle(r.id); n := n + 1;
  end loop;
  for r in select user_id from public.pro_profiles where strikes60 > 0 loop perform public.pro_recalc(r.user_id); end loop;   -- penalidade antiga vai saindo
  return n;
end $$;

-- ---------- administrador ----------
-- decidir denúncia. Procedente: devolve ao contratante tudo o que ainda está em custódia, encerra o contrato e penaliza (1 estrela).
-- Improcedente: o contrato volta ao normal e os períodos já vencidos são pagos ao profissional.
create or replace function public.admin_pro_decide(p_report bigint, p_favor_client boolean, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare r public.pro_reports; c public.pro_contracts; held bigint;
begin
  if not public.is_admin() then return 'denied'; end if;
  select * into r from public.pro_reports where id = p_report for update;
  if not found or r.status <> 'aberta' then return 'status'; end if;
  select * into c from public.pro_contracts where id = r.contract_id for update;
  update public.pro_reports set status = case when p_favor_client then 'procedente' else 'improcedente' end, decision = left(p_note, 300), decided_at = now() where id = p_report;
  if p_favor_client then
    held := c.paid - c.released - c.refunded;
    if held > 0 then perform public.pro_pay_out(c.client_id, held, format('Central: denúncia do contrato #%s aceita (devolução)', c.id), 'reembolso', c.id); end if;
    if c.status in ('ativo', 'disputa') then
      update public.pro_contracts set status = 'encerrado', settled = periods, refunded = refunded + greatest(held, 0),
        last_event = 'denúncia aceita pelo administrador: dinheiro em custódia devolvido', last_actor = null, updated_at = now() where id = c.id;
    else
      update public.pro_contracts set last_event = 'denúncia aceita pelo administrador', last_actor = null, updated_at = now() where id = c.id;
    end if;
    perform public.pro_strike(c.pro_id, c.id, format('denúncia aceita: %s', r.reason), 1);
  else
    if c.status = 'disputa' then
      update public.pro_contracts set status = 'ativo', confirmed = greatest(confirmed, least(periods, public.pro_idx(c))),
        last_event = 'denúncia recusada pelo administrador: contrato segue', last_actor = null, updated_at = now() where id = c.id;
      perform public.pro_settle(c.id);
    else
      update public.pro_contracts set last_event = 'denúncia recusada pelo administrador', last_actor = null, updated_at = now() where id = c.id;
    end if;
  end if;
  insert into public.admin_log (action, target, details) values ('pro_decide', c.pro_id, jsonb_build_object('report', p_report, 'favor_client', p_favor_client, 'note', p_note));
  return 'ok';
end $$;
-- suspender (dias > 0) ou liberar (0) um profissional; selo de verificado
create or replace function public.admin_pro_set(p_pro uuid, p_days int, p_verified boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return 'denied'; end if;
  update public.pro_profiles set suspended_until = case when p_days is null then suspended_until when p_days <= 0 then null else now() + make_interval(days => p_days) end,
    verified = coalesce(p_verified, verified), updated_at = now() where user_id = p_pro;
  insert into public.admin_log (action, target, details) values ('pro_set', p_pro, jsonb_build_object('days', p_days, 'verified', p_verified));
  return 'ok';
end $$;

-- quem pode chamar
revoke all on function public.pro_name_of(uuid), public.pro_pay_out(uuid, bigint, text, text, bigint), public.pro_recalc(uuid),
  public.pro_strike(uuid, bigint, text, numeric), public.pro_settle(bigint) from public, anon, authenticated;
revoke all on function public.pro_save_profile(text, text, text, jsonb, boolean), public.pro_hire(uuid, text, int), public.pro_renew(bigint, int),
  public.pro_deliver(bigint, text), public.pro_confirm(bigint), public.pro_cancel(bigint), public.pro_review(bigint, int, text),
  public.pro_report(bigint, text, text), public.pro_ack(bigint[]), public.pro_tick(), public.admin_pro_decide(bigint, boolean, text),
  public.admin_pro_set(uuid, int, boolean) from public, anon;
grant execute on function public.pro_save_profile(text, text, text, jsonb, boolean), public.pro_hire(uuid, text, int), public.pro_renew(bigint, int),
  public.pro_deliver(bigint, text), public.pro_confirm(bigint), public.pro_cancel(bigint), public.pro_review(bigint, int, text),
  public.pro_report(bigint, text, text), public.pro_ack(bigint[]), public.pro_tick(), public.admin_pro_decide(bigint, boolean, text),
  public.admin_pro_set(uuid, int, boolean) to authenticated;
