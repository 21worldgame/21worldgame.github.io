// Matadouro/frigorífico (regras puras). Na hora de vender o gado você escolhe:
// revender vivo (como sempre), abater no frigorífico de terceiros (paga um pouco mais menos a taxa) ou no SEU frigorífico
// (paga bem mais e ainda vende o couro), com limite de abates por mês. Com o frigorífico próprio dá para comprar boi gordo
// pronto no leilão para abater; o limite mensal e o custo fixo seguram para não virar máquina de dinheiro.
import { arrobas } from './logic.js';
export const OWN = { price: 5000000, cap: 300, premium: 0.1, hide: 60, cost: 25, fixed: 15000, deprec: 0.004 };
export const THIRD = { premium: 0.04, cost: 45 };
// frigorífico de outro jogador: paga melhor que o terceiro comum; o dono escolhe a taxa (FEES) e recebe taxa + couro
export const PLAYER = { premium: 0.08, fee: 50 }, FEES = [20, 35, 50, 80, 120];
export const FAT_KG = 480, FAT_MARKUP = 1.05;          // boi gordo do leilão: 480 kg, 5% acima da arroba

export function ensure(s) {
  s.abate ??= { owned: false, value: 0, used: 0, month: s.month };
  if (s.abate.month !== s.month) { s.abate.used = 0; s.abate.month = s.month; }
  return s.abate;
}
export const capLeft = s => (ensure(s).owned ? Math.max(0, OWN.cap - s.abate.used) : 0);
// valor por cabeça: vivo, terceiros ou próprio
export function perHead(s, kg, how, fee = 0) {
  const base = arrobas(kg) * s.prices.arroba;
  if (how === 'vivo') return base * (1 - fee);
  if (how === 'terceiros') return base * (1 + THIRD.premium) - THIRD.cost;
  if (how === 'jogador') return base * (1 + PLAYER.premium) - fee;   // aqui fee = taxa do dono por cabeça
  return base * (1 + OWN.premium) + OWN.hide - OWN.cost;
}
export function build(s) {
  ensure(s);
  if (s.abate.owned) return 'você já tem um frigorífico.';
  if (s.money < OWN.price) return 'dinheiro insuficiente para construir o frigorífico.';
  s.money -= OWN.price; s.abate.owned = true; s.abate.value = OWN.price;
  return null;
}
export function sellPlant(s) {
  ensure(s); if (!s.abate.owned) return 0;
  const v = Math.round(s.abate.value * 0.85);
  s.money += v; s.abate.owned = false; s.abate.value = 0;
  return v;
}
// abate um lote do rebanho; no próprio, o que passar do limite do mês vai para terceiros
export function slaughter(s, lotId) {
  ensure(s);
  const h = s.herd.find(x => x.id === lotId);
  if (!h) return { err: 'lote não encontrado.' };
  const own = Math.min(h.heads, capLeft(s)), third = h.heads - own;
  const v = Math.round(own * perHead(s, h.kg, 'proprio') + third * perHead(s, h.kg, 'terceiros'));
  s.abate.used += own;
  s.herd = s.herd.filter(x => x !== h); s.money += v;
  return { amount: v, own, third, heads: h.heads };
}
// abate no frigorífico de outro jogador (o servidor já reservou a vaga e registrou o pagamento do dono)
export function slaughterAt(s, lotId, fee) {
  const h = s.herd.find(x => x.id === lotId); if (!h) return { err: 'lote não encontrado.' };
  const v = Math.round(h.heads * perHead(s, h.kg, 'jogador', fee));
  s.herd = s.herd.filter(x => x !== h); s.money += v;
  return { amount: v, heads: h.heads };
}
// comprar boi gordo pronto e abater na hora (só com frigorífico próprio, dentro do limite do mês)
export const fatPrice = s => Math.round(arrobas(FAT_KG) * s.prices.arroba * FAT_MARKUP);
export function buyAndSlaughter(s, heads) {
  ensure(s);
  heads = Math.floor(Number(heads) || 0);
  if (!s.abate.owned) return { err: 'precisa ter frigorífico próprio.' };
  if (heads < 1) return { err: 'escolha quantas cabeças.' };
  if (heads > capLeft(s)) return { err: `o frigorífico só abate mais ${capLeft(s)} cabeças este mês.` };
  const cost = heads * fatPrice(s);
  if (cost > s.money) return { err: 'dinheiro insuficiente.' };
  const v = Math.round(heads * perHead(s, FAT_KG, 'proprio'));
  s.money += v - cost; s.abate.used += heads;
  return { cost, amount: v, profit: v - cost };
}
export function monthly(s) {
  ensure(s); const out = [];
  if (s.abate.owned) {
    s.abate.value = Math.round(s.abate.value * (1 - OWN.deprec));
    s.money -= OWN.fixed; out.push({ txt: 'frigorífico: funcionários, energia e manutenção', val: -OWN.fixed });
  }
  return out;
}
export const plantValue = s => (s.abate?.owned ? s.abate.value : 0);
