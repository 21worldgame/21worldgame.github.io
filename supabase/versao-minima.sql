-- Proteções na gravação do save feita pelo próprio jogador (o administrador restaurando cópia continua podendo tudo):
-- 1) Versão mínima do jogo. Aparelho com o jogo antigo em cache continua dando o que a versão velha dava
--    (passe pagando dinheiro até a v193) e não entende a conta voltada no tempo (até a v195): o save dele não grava até atualizar.
--    O save fica no aparelho e o jogo tenta de novo sozinho; quando atualizar, grava normalmente.
-- 2) Conta voltada no tempo pelo administrador: aparelho que ainda está com o estado de antes (adminRestoreAt menor)
--    não grava por cima. O jogo dele recebe a recusa, pega a cópia do servidor e recarrega.
-- Para subir a versão mínima depois: trocar o número em min_app_version() e rodar de novo.
create or replace function public.min_app_version() returns int language sql immutable as $$ select 225 $$;

create or replace function public.saves_min_version() returns trigger language plpgsql as $$
begin
  if auth.uid() = new.user_id then
    if coalesce(nullif(new.data->>'appV', '')::numeric, 0) < public.min_app_version() then
      raise exception 'versao antiga do jogo (%): atualize para gravar', coalesce(new.data->>'appV', '?') using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and coalesce(nullif(new.data->>'adminRestoreAt', '')::numeric, 0) < coalesce(nullif(old.data->>'adminRestoreAt', '')::numeric, 0) then
      raise exception 'conta restaurada pelo administrador: este aparelho precisa pegar a cópia do servidor' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists saves_min_version on public.saves;
create trigger saves_min_version before insert or update on public.saves for each row execute function public.saves_min_version();
