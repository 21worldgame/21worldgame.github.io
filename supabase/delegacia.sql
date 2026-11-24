-- Delegacia do 21: o jogador registra um Boletim de Ocorrência contra outro jogador (relato + provas)
-- e o caso cai na aba "delegacia" do painel admin para investigar. O denunciado não vê nada.
-- Rodar uma vez no SQL Editor do Supabase. Depende de admin.sql (is_admin) e de public_profiles.
create table if not exists public.bo_casos (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  author uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'jogador',
  target uuid not null references auth.users(id) on delete cascade,
  target_name text not null default 'jogador',
  kind text not null default 'outro',
  fact_when text not null default '',
  story text not null,
  proofs text not null default '',
  status text not null default 'registrado' check (status in ('registrado', 'investigando', 'procedente', 'arquivado')),
  note text not null default '',          -- o que a delegacia responde ao denunciante
  updated_at timestamptz not null default now()
);
create index if not exists bo_casos_author on public.bo_casos (author, at desc);
create index if not exists bo_casos_target on public.bo_casos (target, at desc);
alter table public.bo_casos enable row level security;
drop policy if exists bo_read on public.bo_casos;
create policy bo_read on public.bo_casos for select to authenticated using (auth.uid() = author or public.is_admin());
revoke insert, update, delete on public.bo_casos from anon, authenticated;

-- registrar: até 3 B.O. por dia e 1 aberto por denunciado
create or replace function public.bo_registrar(p_target uuid, p_kind text, p_when text, p_story text, p_proofs text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nid bigint;
begin
  if uid is null then return 'login'; end if;
  if p_target is null or p_target = uid then return 'self'; end if;
  if not exists (select 1 from auth.users where id = p_target) then return 'notarget'; end if;
  if char_length(trim(coalesce(p_story, ''))) < 30 then return 'short'; end if;
  if (select count(*) from public.bo_casos where author = uid and at > now() - interval '1 day') >= 3 then return 'limit'; end if;
  if exists (select 1 from public.bo_casos where author = uid and target = p_target and status in ('registrado', 'investigando')) then return 'open'; end if;
  insert into public.bo_casos (author, author_name, target, target_name, kind, fact_when, story, proofs)
    values (uid, coalesce((select name from public.public_profiles where user_id = uid), 'jogador'),
            p_target, coalesce((select name from public.public_profiles where user_id = p_target), 'jogador'),
            left(coalesce(nullif(p_kind, ''), 'outro'), 30), left(coalesce(p_when, ''), 60), left(trim(p_story), 2000), left(coalesce(p_proofs, ''), 3000))
    returning id into nid;
  return 'ok:' || nid;
end $$;
revoke all on function public.bo_registrar(uuid, text, text, text, text) from public, anon;
grant execute on function public.bo_registrar(uuid, text, text, text, text) to authenticated;

-- delegado (admin): muda a situação e escreve a resposta que o denunciante lê
create or replace function public.admin_bo_set(p_id bigint, p_status text, p_note text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return 'noadmin'; end if;
  if p_status not in ('registrado', 'investigando', 'procedente', 'arquivado') then return 'status'; end if;
  update public.bo_casos set status = p_status, note = left(coalesce(p_note, note), 1000), updated_at = now() where id = p_id;
  if not found then return 'nocase'; end if;
  return 'ok';
end $$;
revoke all on function public.admin_bo_set(bigint, text, text) from public, anon;
grant execute on function public.admin_bo_set(bigint, text, text) to authenticated;
