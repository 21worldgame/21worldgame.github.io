// Estoque dos acessórios, único para o jogo inteiro (tabela acc_stock no servidor, ver acessorios.sql).
// Cada acessório começa com 35. Comprar na loja tira 1; vender de volta para a loja devolve 1 (até 35).
// Sem login ou sem a tabela criada: o jogo segue sem limite.
import * as Auth from './auth.js';

export const MAX = 35;
const left = {};
let at = 0;
export const leftOf = id => left[id];   // undefined = ainda não sabemos

// lê o estoque (no máximo a cada 30 s) e avisa quando chegar
export async function refresh(onChange) {
  const sb = Auth.sbClient(); if (!sb || Date.now() - at < 30000) return;
  at = Date.now();
  const { data, error } = await sb.from('acc_stock').select('id,left_qty');
  if (error) return;
  for (const r of data) left[r.id] = r.left_qty;
  onChange?.();
}
const call = async (fn, id) => {
  const sb = Auth.sbClient(); if (!sb || !Auth.account()) return null;
  const { data, error } = await sb.rpc(fn, { p_id: id });
  return error ? null : data;
};
// tira 1 do estoque: false se esgotou
export async function take(id) {
  const n = await call('take_acc', id);
  if (n === -1) { left[id] = 0; return false; }
  if (typeof n === 'number' && n >= 0) left[id] = n;
  return true;
}
export async function give(id) {
  const n = await call('give_acc', id);
  if (typeof n === 'number') left[id] = n;
}
