// Equipe (regras puras): funcionários que o jogador contrata. Para criar um novo funcionário no futuro,
// é só acrescentar uma entrada em STAFF (e as regras dele num módulo próprio, como o contador.js).
// soon: true = aparece na agência como "em breve".
import * as CT from './contador.js';

export const STAFF = [
  { id: 'contador', role: 'contador', name: 'Dr. Valdir Cifrão', stars: 5, xp: '22 anos de profissão',
    look: { skin: 2, hair: 'curto', hairColor: 5, beard: 'bigode', eyes: 2, outfit: 'terno', cloth: 2, acc: 'óculos escuros' },
    does: 'Mostra cada gasto do mês separado por produção e por tipo: impostos, luz, água, funcionários, ração, insumos, frete, parcelas. Cada fechamento aparece uma vez só, com data e hora.',
    price: 'honorário pelo seu patrimônio' },
  { id: 'veterinario', role: 'veterinária', name: 'Dra. Lúcia Campos', stars: 5, soon: true,
    look: { skin: 3, hair: 'coque', hairColor: 2, beard: 'nenhuma', eyes: 3, outfit: 'camisa', cloth: 5, acc: 'nenhum' },
    does: 'Cuida do gado, dos cavalos, dos galgos, dos suínos e da granja: menos doença, menos lesão e menos animais perdidos.' },
  { id: 'gerente', role: 'gerente da fazenda', name: 'Seu Antônio Baião', stars: 4, soon: true,
    look: { skin: 4, hair: 'boné', hairColor: 1, beard: 'cheia', eyes: 1, outfit: 'jaqueta', cloth: 3, acc: 'chapéu de peão' },
    does: 'Toca a fazenda por você: não deixa o defensivo e os tratos desligarem por falta de atenção e avisa a hora certa de colher e vender.' },
  { id: 'advogado', role: 'advogada', name: 'Dra. Helena Prado', stars: 5, soon: true,
    look: { skin: 1, hair: 'longo', hairColor: 4, beard: 'nenhuma', eyes: 4, outfit: 'terno', cloth: 1, acc: 'brinco' },
    does: 'Defende você nos impostos e nas cobranças dos mais ricos, e negocia dívida atrasada com o banco antes de tomarem a sua terra.' },
  { id: 'seguranca', role: 'segurança', name: 'Rocha', stars: 4, soon: true,
    look: { skin: 5, hair: 'raspado', hairColor: 1, beard: 'cavanhaque', eyes: 2, outfit: 'regata', cloth: 6, acc: 'nenhum' },
    does: 'Protege a mina de ouro, as empresas e as fazendas contra roubo e prejuízo.' },
  { id: 'corretor', role: 'corretor de imóveis', name: 'Marcão Lotes', stars: 4, soon: true,
    look: { skin: 3, hair: 'degradê', hairColor: 1, beard: 'por fazer', eyes: 1, outfit: 'camisa', cloth: 4, acc: 'corrente de ouro' },
    does: 'Garimpa terras mais baratas e acha comprador para as suas quando você quer vender.' },
];
export const byId = id => STAFF.find(x => x.id === id);
// quem está trabalhando para o jogador agora (o contador guarda o contrato em s.acct; os próximos em s.staff[id])
export const isActive = (s, id) => (id === 'contador' ? CT.active(s) : !!s.staff?.[id]);
export const active = s => STAFF.filter(x => !x.soon && isActive(s, x.id));
// resumo do contrato de cada um (para a lista de funcionários ativos)
export function contract(s, id, worth) {
  if (id === 'contador') {
    const a = s.acct; if (!a) return null;
    return a.plan === 'mensal' ? { plan: 'mensal', cost: CT.nextMensal(s, worth), per: 'mês', until: 'sem prazo (cancela quando quiser)' }
      : { plan: CT.PLANS[a.plan].label, cost: a.paid, per: 'pago', until: `${CT.monthsLeft(s)} ${CT.monthsLeft(s) === 1 ? 'mês restante' : 'meses restantes'}` };
  }
  return s.staff?.[id] || null;
}
// quanto a equipe custa por mês, em média
export const payroll = (s, worth) => active(s).reduce((t, x) => { const c = contract(s, x.id, worth); return t + (!c ? 0 : c.per === 'mês' ? c.cost : Math.round(c.cost / Math.max(1, CT.PLANS[s.acct?.plan]?.months || 1))); }, 0);
