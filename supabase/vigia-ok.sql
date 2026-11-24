-- "Passar o pano": o administrador tira um jogador dos alertas de trapaça. Guarda o que foi visto naquela hora;
-- o jogador só volta para os alertas se aparecer coisa nova (pontos maiores ou mais dinheiro sem origem). Pode rodar de novo.
create table if not exists public.vigia_ok (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score   numeric not null default 0,
  gap     numeric not null default 0,
  jump    numeric not null default 0,
  pix     numeric not null default 0,
  note    text check (char_length(note) <= 300),
  at      timestamptz not null default now()
);
alter table public.vigia_ok enable row level security;
drop policy if exists vigia_ok_admin on public.vigia_ok;
create policy vigia_ok_admin on public.vigia_ok for all to authenticated using (public.is_admin()) with check (public.is_admin());
