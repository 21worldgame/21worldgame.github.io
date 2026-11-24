-- Versão mínima do jogo para gravar o save. Aparelho com o jogo antigo em cache continua dando o que a versão velha dava
-- (passe pagando dinheiro e XP em toda mão de 21 até a v193); assim o save dele não grava até atualizar.
-- O save fica no aparelho e o jogo tenta de novo sozinho: quando atualizar, grava normalmente.
-- Só vale para o próprio jogador gravando (o administrador restaurando cópia antiga continua podendo).
-- Para subir o mínimo depois: trocar o número em min_app_version() e rodar de novo.
create or replace function public.min_app_version() returns int language sql immutable as $$ select 194 $$;

create or replace function public.saves_min_version() returns trigger language plpgsql as $$
begin
  if auth.uid() = new.user_id and coalesce(nullif(new.data->>'appV', '')::numeric, 0) < public.min_app_version() then
    raise exception 'versao antiga do jogo (%): atualize para gravar', coalesce(new.data->>'appV', '?') using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists saves_min_version on public.saves;
create trigger saves_min_version before insert or update on public.saves for each row execute function public.saves_min_version();
