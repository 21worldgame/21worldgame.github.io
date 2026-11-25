-- 21 World: compras únicas do mundo (mina de ouro, marcas) só com o dinheiro que o SERVIDOR vê no save.
-- Antes claim_gold_mine e claim_company davam a mina/marca a quem pedisse: com o jogo editado no console
-- (window.hack = G; hack.S.money = 99999999) dava para registrar a mina de R$ 120 mi sem ter o dinheiro.
-- O save da nuvem é confiável porque a trava de patrimônio (teto-dinheiro.sql) não deixa ele inflar.
-- O jogo grava o save antes de pedir (negocios-ui.js, mina-ui.js). Quem já tem a marca/mina no save registra de novo sem pagar.
-- Rode no Supabase depois de teto-dinheiro.sql. Pode rodar de novo.

create table if not exists public.company_price (brand text primary key, price bigint not null);
alter table public.company_price enable row level security;   -- sem política: a API não lê nem muda
insert into public.company_price (brand, price) values
  ('roxinho',6000000),
  ('enter',9000000),
  ('santandre',15000000),
  ('caixa',19000000),
  ('bradeskao',24000000),
  ('itai',28000000),
  ('brasa',34000000),
  ('netroca',700000),
  ('giga21',1600000),
  ('timtim',3200000),
  ('oi',4500000),
  ('clarao',7000000),
  ('viva',9500000),
  ('zezinho',1200000),
  ('acai',3800000),
  ('paoacucre',6500000),
  ('carrefur',11000000),
  ('canaa',180000000),
  ('bomjesus',320000000),
  ('dourado',140000000),
  ('laranjal',260000000),
  ('mcboi',26000000),
  ('reiburguer',21000000),
  ('habibao',12000000),
  ('bobao',8000000),
  ('feirao21',6000000),
  ('rodao',9500000),
  ('importsp',38000000),
  ('italia',62000000),
  ('vivarra',22000000),
  ('hestrela',45000000),
  ('garimpo',8000000),
  ('lopex',9000000),
  ('quintal',16000000),
  ('nelorepq',7000000),
  ('leilaobr',14000000),
  ('azuu',15000000),
  ('jatao',32000000),
  ('brigadeiro',8000000),
  ('angra21',9000000),
  ('ilhabela',16000000),
  ('copapalacio',85000000),
  ('fazzano',60000000),
  ('tchai',34000000)
on conflict (brand) do update set price = excluded.price;

create or replace function public.cloud_money(u uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select jn(data->'money') from public.saves where user_id = u), 0) $$;
revoke all on function public.cloud_money(uuid) from public, anon, authenticated;

create or replace function public.claim_gold_mine(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare o uuid; d jsonb;
begin
  if auth.uid() is null then return 'login'; end if;
  select owner into o from public.gold_mine where id = 1 for update;
  if o is not null and o <> auth.uid() then return 'taken'; end if;
  if o is null then
    select data into d from public.saves where user_id = auth.uid();
    if jsonb_typeof(d->'mina') is distinct from 'object' and cloud_money(auth.uid()) < 120000000 then return 'money'; end if;
  end if;
  update public.gold_mine set owner = auth.uid(), owner_name = left(coalesce(p_name, 'jogador'), 24), since = now() where id = 1;
  return 'ok';
end $$;

create or replace function public.claim_company(p_brand text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare o uuid; pr numeric; d jsonb;
begin
  if auth.uid() is null then return 'login'; end if;
  if p_brand is null or p_brand !~ '^[a-z0-9]{1,24}$' then return 'invalid'; end if;
  delete from public.company_released where brand = p_brand and user_id = auth.uid();
  if found then return 'released'; end if;   -- o admin tirou essa marca de você: o jogo devolve o dinheiro
  select owner into o from public.company_owner where brand = p_brand;
  if o = auth.uid() then return 'ok'; end if;
  if o is not null then return 'taken'; end if;
  -- preço muda com o mês em alguns setores: exige metade do preço de tabela (folga para a variação)
  select price into pr from public.company_price where brand = p_brand;
  select data into d from public.saves where user_id = auth.uid();
  if not exists (select 1 from jsonb_each(case when jsonb_typeof(d->'biz') = 'object' then d->'biz' else '{}' end) e(k, v), ja(e.v) b where b->>'brand' = p_brand)
     and cloud_money(auth.uid()) < coalesce(pr, 700000) * 0.5 then return 'money'; end if;
  insert into public.company_owner (brand, owner, owner_name) values (p_brand, auth.uid(), left(coalesce(p_name, 'jogador'), 24))
    on conflict (brand) do nothing;
  select owner into o from public.company_owner where brand = p_brand;
  if o = auth.uid() then return 'ok'; end if;
  return 'taken';
end $$;

-- pagamento a outro jogador (Pix e Central de profissionais): o dinheiro tem que existir no save da
-- nuvem, já descontado o que ele mandou depois da última gravação. Sem isso, com dinheiro falso só no aparelho e sem gravar,
-- dava para mandar dinheiro de verdade para outra conta.
create or replace function public.pay_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); u uuid := coalesce(j->>'from_id', j->>'payer')::uuid; amt numeric := jn(j->'amount'); t timestamptz;
begin
  if auth.uid() is distinct from u then return new; end if;   -- admin / servidor
  select updated_at into t from public.saves where user_id = u;
  if cloud_money(u) - pix_sent(u, coalesce(t, now())) < amt then
    raise exception 'dinheiro sem explicacao: o pagamento passa do dinheiro da sua conta' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pay_guard on public.pix;
create trigger pay_guard before insert on public.pix for each row execute function public.pay_guard();
drop trigger if exists pay_guard on public.abate_job;   -- frigorífico: a taxa sai do valor dos bois, não do caixa (limite de 300 cabeças/mês)
drop trigger if exists pay_guard on public.pro_payments;
create trigger pay_guard before insert on public.pro_payments for each row execute function public.pay_guard();
