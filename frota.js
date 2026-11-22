// Frota de trabalho (trator, caminhão e máquinas): desgaste com o uso, quebras, quanto cada uma rende e se vale trocar por 0 km.
// Regras puras. Carros de passeio não entram (só os que trabalham na roça).
import { CARS, CROPS, MARKET_FEE, herdValue, CAR_DEPREC, CAR_UPKEEP, CAR_BUYBACK } from './logic.js';
import { ORANGE, SPRAY_CUT, HARVEST_PLUS, COVER } from './pomar.js';
import { CANE, LOGI, kmOf } from './cana.js';

export const WORK = ['trator', 'caminhao', 'maquina'];
export const isWork = c => WORK.includes(CARS[c?.model]?.type);
export const W = { use: 1.5, idle: 0.4, safe: 50, risk: 0.01, maxRisk: 0.3, repair: 0.015, repairWear: 0.03, maint: 0.0015, extraDep: 0.004 };
// saves antigos: o desgaste vem do quanto já desvalorizou (1,5% ao mês)
export function ensure(c) { if (c.wear == null) { const C = CARS[c.model]; c.wear = C ? Math.min(90, Math.max(0, Math.round(Math.log(Math.max(0.05, c.value / C.price)) / Math.log(1 - CAR_DEPREC)))) : 0; } return c; }
export const condition = c => Math.max(0, Math.round(100 - ensure(c).wear));
export const risk = c => { const k = condition(c); return k >= W.safe ? 0 : Math.min(W.maxRisk, (W.safe - k) * W.risk); };
export const repairCost = c => Math.round(CARS[c.model].price * (W.repair + (ensure(c).wear / 100) * W.repairWear));
export const maint = c => Math.round(CARS[c.model].price * W.maint * (ensure(c).wear / 20));
const cane = s => (s.lands || []).filter(l => l.cane), orch = s => (s.lands || []).filter(l => l.orchard);
const tonsPerCut = s => cane(s).reduce((t, l) => t + l.ha * CANE.yield * (CANE.decline ** (l.cane.cuts || 0)) * (l.cane.health ?? 1), 0);
// está trabalhando? e quanto rende por mês (economia que a máquina dá, com a sua produção de hoje)
export function work(s, c) {
  const m = c.model, T = CARS[m]?.type, same = (s.cars || []).filter(x => x.model === m && !x.broken).length || 1;
  if (T === 'trator') {
    const crops = (s.lands || []).filter(l => l.crop), ha = crops.reduce((t, l) => t + l.ha, 0);
    const v = crops.reduce((t, l) => t + (CROPS[l.crop.type].cost * l.ha * 0.15) / CROPS[l.crop.type].months, 0);
    return { busy: ha > 0, ha, gain: Math.round(v), how: ha ? `${ha} ha de lavoura: plantio 15% mais barato` : 'parado: sem lavoura plantada' };
  }
  if (T === 'caminhao') {
    const hv = herdValue(s), cn = tonsPerCut(s), fr = cane(s).reduce((t, l) => t + l.ha * CANE.yield * kmOf(l) * LOGI.freightKm * LOGI.truckSave, 0) / CANE.cycle;
    // taxa de 1% da venda do gado (~1 venda a cada 10 meses) + frete da cana (quando não tem rodotrem)
    return { busy: hv > 0 || cn > 0, gain: Math.round((hv * MARKET_FEE) / 10 + ((s.cars || []).some(x => x.model === 'rodotrem') ? 0 : fr)), how: hv || cn ? `gado sem taxa de frete${cn ? ' e frete da cana mais barato' : ''}` : 'parado: sem gado nem cana' };
  }
  if (m === 'pulv' || m === 'plataforma') {
    const ha = orch(s).reduce((t, l) => t + l.ha, 0), mine = Math.min(COVER[m], ha / same);
    const v = m === 'pulv' ? mine * ORANGE.spray * SPRAY_CUT : (mine * ORANGE.yield * HARVEST_PLUS * (s.prices?.laranja || ORANGE.price)) / ORANGE.cycle;
    return { busy: ha > 0, ha: Math.round(mine), gain: Math.round(v), how: ha ? `atende ${Math.round(mine)} de ${ha} ha de pomar` : 'parado: sem pomar' };
  }
  if (m === 'transbordo' || m === 'rodotrem') {
    const t = tonsPerCut(s), perTon = m === 'transbordo' ? LOGI.load - 2 : cane(s).reduce((a, l) => a + kmOf(l) * LOGI.freightKm * 0.45 * l.ha, 0) / Math.max(1, cane(s).reduce((a, l) => a + l.ha, 0));
    return { busy: t > 0, gain: Math.round((t * perTon) / CANE.cycle / same), how: t ? `~${Math.round(t)} t por corte de cana` : 'parado: sem canavial' };
  }
  return { busy: false, gain: 0, how: '' };
}
// manter x trocar por 0 km (por mês): IPVA/seguro, manutenção, quebras esperadas e desvalorização
export function keepVsNew(s, c) {
  const C = CARS[c.model], k = condition(c);
  const keep = c.value * CAR_UPKEEP + maint(c) + risk(c) * repairCost(c) + c.value * (CAR_DEPREC + W.extraDep * (ensure(c).wear / 50));
  const fresh = C.price * CAR_UPKEEP + C.price * CAR_DEPREC;
  const sell = Math.round(c.value * CAR_BUYBACK), diff = C.price - sell, save = keep - fresh;
  const pay = save > 0 ? Math.ceil(diff / save) : Infinity;
  return { keep: Math.round(keep), fresh: Math.round(fresh), sell, diff, pay, k, worth: k < 45 || risk(c) >= 0.08 || pay <= 24, lost: 1 - c.value / C.price };
}
// fecha o mês: desgaste (mais quando trabalha), conserto quando quebra, desvalorização extra pelo uso
export function monthly(s, rng = Math.random) {
  const out = [];
  for (const c of s.cars || []) {
    if (!isWork(c)) continue;
    ensure(c);
    if (c.broken) { c.broken = 0; continue; }   // ficou um mês na oficina
    if (c.lentTo) continue;
    const w = work(s, c);
    c.wear = Math.min(100, +(c.wear + (w.busy ? W.use : W.idle)).toFixed(1));
    const m = maint(c); if (m > 0) { s.money -= m; out.push({ txt: `manutenção (desgaste), ${CARS[c.model].name}`, val: -m }); }
    c.value = Math.max(Math.round(CARS[c.model].price * 0.08), Math.round(c.value * (1 - W.extraDep * (c.wear / 50))));
    if (rng() < risk(c)) { const r = repairCost(c); s.money -= r; c.broken = 1; out.push({ txt: `${CARS[c.model].name} quebrou: conserto e 1 mês parado`, val: -r }); }
  }
  return out;
}
