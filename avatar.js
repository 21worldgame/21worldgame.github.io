// Personagem em SVG por camadas, com traço de contorno e sombreamento em volumes (luz vindo do alto à esquerda).
// Cores vêm dos tokens (--skin-n, --hair-n, --cloth-n, --iris-n); sombra e brilho são camadas por cima.
export const CATALOG = {
  skin: { label: 'pele', opts: [1, 2, 3, 4, 5].map(n => ({ id: n, swatch: `var(--skin-${n})` })) },
  hair: { label: 'cabelo', opts: ['curto', 'degradê', 'longo', 'coque', 'raspado', 'boné'].map(id => ({ id })) },
  hairColor: { label: 'cor do cabelo', opts: [1, 2, 3, 4, 5].map(n => ({ id: n, swatch: `var(--hair-${n})` })) },
  beard: { label: 'barba', opts: ['nenhuma', 'por fazer', 'cavanhaque', 'bigode', 'cheia'].map(id => ({ id })) },
  eyes: { label: 'olhos', opts: [1, 2, 3, 4].map(n => ({ id: n, swatch: `var(--iris-${n})` })) },
  outfit: {
    label: 'roupa',
    opts: [{ id: 'camiseta' }, { id: 'moletom' }, { id: 'regata' }, { id: 'camisa', price: 1500 }, { id: 'jaqueta', price: 3000 }, { id: 'terno', price: 12000 }],
  },
  cloth: { label: 'cor da roupa', opts: [1, 2, 3, 4, 5, 6].map(n => ({ id: n, swatch: `var(--cloth-${n})` })) },
  acc: {
    label: 'acessório',
    opts: [{ id: 'nenhum' }, { id: 'brinco', price: 1200 }, { id: 'óculos escuros', price: 2500 }, { id: 'fone gamer', price: 4000 }, { id: 'boné de marca', price: 6000 }, { id: 'chapéu de peão', price: 9000 }, { id: 'chapéu de granjeiro', price: 35000 }, { id: 'pulseira de prata', price: 15000 }, { id: 'corrente de ouro', price: 25000 }, { id: 'relógio de luxo', price: 60000 }, { id: 'grillz de ouro', price: 90000 }, { id: 'anel de diamante', price: 150000 }],
  },
};

export const DEFAULT = { name: 'você', skin: 3, hair: 'curto', hairColor: 1, beard: 'por fazer', eyes: 1, outfit: 'camiseta', cloth: 1, acc: 'nenhum' };

export const NPC_LOOKS = {
  dealer: { skin: 2, hair: 'degradê', hairColor: 1, beard: 'nenhuma', eyes: 2, outfit: 'colete', cloth: 6, acc: 'nenhum' },
  Dorival: { skin: 4, hair: 'boné', hairColor: 2, beard: 'cheia', eyes: 1, outfit: 'jaqueta', cloth: 3, acc: 'nenhum' },
  Rosa: { skin: 2, hair: 'longo', hairColor: 4, beard: 'nenhuma', eyes: 3, outfit: 'regata', cloth: 4, acc: 'corrente de ouro' },
  Neide: { skin: 1, hair: 'coque', hairColor: 3, beard: 'nenhuma', eyes: 4, outfit: 'camisa', cloth: 2, acc: 'brinco' },
  Tião: { skin: 5, hair: 'raspado', hairColor: 1, beard: 'cavanhaque', eyes: 1, outfit: 'moletom', cloth: 5, acc: 'óculos escuros' },
};

// vários acessórios ao mesmo tempo, um por lugar do corpo (dois chapéus ou dois relógios não)
export const SLOT = { brinco: 'orelha', 'óculos escuros': 'olhos', 'fone gamer': 'cabeça', 'boné de marca': 'cabeça', 'chapéu de peão': 'cabeça', 'chapéu de granjeiro': 'cabeça',
  'pulseira de prata': 'pulso', 'relógio de luxo': 'pulso', 'corrente de ouro': 'pescoço', 'grillz de ouro': 'boca', 'anel de diamante': 'mão', gravata: 'pescoço' };
// save antigo guarda um texto ('brinco' ou 'nenhum'); o novo guarda a lista
export const accsOf = a => [].concat(a?.acc ?? []).filter(x => typeof x === 'string' && x && x !== 'nenhum').slice(0, 12);
export function toggleAcc(a, id) {
  const cur = accsOf(a);
  a.acc = id === 'nenhum' ? [] : cur.includes(id) ? cur.filter(x => x !== id) : [...cur.filter(x => !SLOT[id] || SLOT[x] !== SLOT[id]), id];
  return a.acc;
}

const INK = 'var(--ink-line)', SH = 'var(--shade)', HI = 'var(--hi)';
let uid = 0;

export function avatarSVG(raw, { label = '' } = {}) {
  const a = { ...DEFAULT, ...raw };
  if (a.outfit === 'jaqueta' && !CATALOG.outfit.opts.some(o => o.id === a.outfit)) a.outfit = 'camiseta';
  const id = `av${++uid}`;
  const skin = `var(--skin-${a.skin})`, hair = `var(--hair-${a.hairColor})`, cloth = `var(--cloth-${a.cloth})`, iris = `var(--iris-${a.eyes || 1})`;
  const line = (d, w = 2, extra = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const shade = (d, o = 0.18) => `<path d="${d}" fill="${SH}" opacity="${o}"/>`;
  const glow = (d, o = 0.2) => `<path d="${d}" fill="${HI}" opacity="${o}"/>`;

  const defs = `<defs>
    <linearGradient id="${id}-lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--lens-top)"/><stop offset="1" stop-color="var(--lens-bot)"/></linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--gold-hi)"/><stop offset=".5" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--gold-lo)"/></linearGradient>
    <clipPath id="${id}-head"><path d="M68 64 C66 34 82 22 100 22 C118 22 134 34 132 64 L131 86 C129 106 116 122 100 124 C84 122 71 106 69 86 Z"/></clipPath>
  </defs>`;

  // cabelo comprido fica atrás de tudo
  const backHair = a.hair === 'longo'
    ? `<path d="M64 60 C56 100 52 150 66 168 L134 168 C148 150 144 100 136 60 C132 40 68 40 64 60 Z" fill="${hair}"/>${shade('M118 60 C138 90 140 140 134 168 L120 168 C128 130 126 90 118 60 Z', 0.25)}${line('M64 60 C56 100 52 150 66 168 M136 60 C144 100 148 150 134 168', 2)}`
    : '';

  const neck = `<path d="M86 110 L86 148 Q100 156 114 148 L114 110 Z" fill="${skin}"/>${shade('M86 114 Q100 134 114 114 L114 130 Q100 142 86 130 Z', 0.3)}${line('M86 112 L86 146 M114 112 L114 146', 1.6)}`;

  // tronco e roupa
  const torsoD = 'M18 200 C20 166 46 150 80 145 Q100 154 120 145 C154 150 180 166 182 200 Z';
  const torsoShade = shade('M140 152 C164 160 178 176 182 200 L150 200 C150 182 146 166 140 152 Z', 0.22) + glow('M44 162 C56 154 68 150 78 148 C66 158 56 168 50 182 Z', 0.12);
  const outfits = {
    camiseta: `<path d="${torsoD}" fill="${cloth}"/>${torsoShade}${line('M84 147 Q100 160 116 147', 2)}${line('M60 176 Q66 186 64 200 M140 178 Q134 188 136 200', 1.2, 'opacity=".45"')}`,
    moletom: `<path d="${torsoD}" fill="${cloth}"/>${torsoShade}<path d="M72 148 C66 132 84 126 100 136 C116 126 134 132 128 148 C120 140 80 140 72 148 Z" fill="${cloth}"/>${shade('M72 148 C66 132 84 126 100 136 C116 126 134 132 128 148 C120 140 80 140 72 148 Z', 0.22)}${line('M72 148 C66 132 84 126 100 136 C116 126 134 132 128 148', 2)}
      <path d="M93 150 L91 176 M107 150 L109 176" stroke="var(--shirt)" stroke-width="2.4" stroke-linecap="round"/><circle cx="91" cy="178" r="2" fill="var(--rim-metal)"/><circle cx="109" cy="178" r="2" fill="var(--rim-metal)"/>${line('M70 184 Q100 192 130 184', 1.2, 'opacity=".4"')}`,
    regata: `<path d="${torsoD}" fill="${skin}"/>${torsoShade}<path d="M64 152 C70 172 70 190 66 200 L134 200 C130 190 130 172 136 152 C126 162 74 162 64 152 Z" fill="${cloth}"/>${shade('M118 158 C130 168 132 186 134 200 L120 200 C122 184 122 170 118 158 Z', 0.2)}${line('M64 152 C70 172 70 190 66 200 M136 152 C130 172 130 190 134 200 M70 156 Q100 168 130 156', 1.8)}`,
    camisa: `<path d="${torsoD}" fill="${cloth}"/>${torsoShade}<path d="M84 145 L96 160 L100 150 Z M116 145 L104 160 L100 150 Z" fill="${cloth}"/>${glow('M84 145 L96 160 L100 150 Z M116 145 L104 160 L100 150 Z', 0.25)}${line('M84 145 L96 160 L100 150 L104 160 L116 145', 1.8)}${line('M100 152 L100 200', 1.4)}<circle cx="100" cy="170" r="1.6" fill="${INK}"/><circle cx="100" cy="186" r="1.6" fill="${INK}"/>`,
    jaqueta: `<path d="${torsoD}" fill="${cloth}"/><path d="M86 147 L100 200 L114 147 Q100 156 86 147 Z" fill="var(--shirt)"/>${torsoShade}
      <path d="M80 145 L98 200 L84 200 L62 160 Z M120 145 L102 200 L116 200 L138 160 Z" fill="${cloth}"/>${shade('M120 145 L102 200 L116 200 L138 160 Z', 0.25)}${glow('M66 162 L80 150 L86 168 Z', 0.22)}${line('M80 145 L98 200 M120 145 L102 200 M62 160 L80 145 M138 160 L120 145', 1.8)}`,
    colete: `<path d="${torsoD}" fill="var(--shirt)"/>${torsoShade}<path d="M84 145 L96 160 L100 150 Z M116 145 L104 160 L100 150 Z" fill="var(--shirt)"/>${line('M84 145 L96 160 L100 150 L104 160 L116 145', 1.4)}
      <path d="M46 160 C58 152 72 148 84 147 L99 200 L40 200 C40 184 42 170 46 160 Z M154 160 C142 152 128 148 116 147 L101 200 L160 200 C160 184 158 170 154 160 Z" fill="var(--suit)"/>${glow('M50 164 C60 156 70 152 80 150 L88 176 L56 190 Z', 0.08)}
      <path d="M97 152 L103 152 L106 184 L100 192 L94 184 Z" fill="${INK}"/>${line('M46 160 C58 152 72 148 84 147 L99 200 M154 160 C142 152 128 148 116 147 L101 200', 1.6)}<circle cx="108" cy="178" r="1.6" fill="var(--rim-metal)"/><circle cx="110" cy="190" r="1.6" fill="var(--rim-metal)"/>`,
    terno: `<path d="${torsoD}" fill="var(--suit)"/><path d="M86 147 L100 200 L114 147 Q100 156 86 147 Z" fill="var(--shirt)"/>${torsoShade}
      <path d="M80 145 L97 186 L86 200 L60 160 Z M120 145 L103 186 L114 200 L140 160 Z" fill="var(--suit)"/>${glow('M80 145 L97 186 L90 190 L70 156 Z', 0.1)}${line('M80 145 L97 186 M120 145 L103 186 M60 160 L80 145 M140 160 L120 145', 1.6)}`,
  };
  const accs = accsOf(a);
  const tie = accs.includes('gravata')
    ? `<path d="M90 150 L100 156 L110 150 L110 162 L100 156 L90 162 Z" fill="${INK}"/>`
    : a.outfit === 'terno' ? `<path d="M97 154 L103 154 L106 182 L100 190 L94 182 Z" fill="${cloth}"/>${line('M97 154 L103 154 L106 182 L100 190 L94 182 Z', 1.2)}` : '';

  const headD = 'M68 64 C66 34 82 22 100 22 C118 22 134 34 132 64 L131 86 C129 106 116 122 100 124 C84 122 71 106 69 86 Z';
  const ears = `<path d="M70 64 C58 60 56 82 68 88 Z" fill="${skin}"/><path d="M130 64 C142 60 144 82 132 88 Z" fill="${skin}"/>
    ${shade('M66 68 C62 72 63 80 67 83 Z M134 68 C138 72 137 80 133 83 Z', 0.3)}${line('M70 64 C58 60 56 82 68 88 M130 64 C142 60 144 82 132 88', 1.8)}`;
  const head = `<path d="${headD}" fill="${skin}"/>
    <g clip-path="url(#${id}-head)">
      ${shade('M116 36 C134 50 134 72 131 88 C128 106 116 122 100 124 C114 110 121 96 122 80 C123 62 122 48 116 36 Z', 0.2)}
      ${shade('M74 66 Q86 60 96 66 L96 70 Q86 66 76 70 Z M104 66 Q114 60 124 66 L124 70 Q114 66 104 70 Z', 0.18)}
      ${shade('M90 116 Q100 126 110 116 Q100 120 90 116 Z', 0.25)}
      ${glow('M78 40 C86 30 96 28 104 30 C92 34 84 40 80 50 Z', 0.18)}
      ${glow('M78 86 a7 4 0 1 0 14 0 a7 4 0 1 0 -14 0', 0.14)}
    </g>
    ${line(headD, 2.2)}`;

  const eye = (cx, flip) => {
    const s = flip ? -1 : 1, x = v => cx + v * s;
    return `<path d="M${x(-9)} 74 Q${cx} 67 ${x(9)} 73 Q${cx} 78 ${x(-9)} 74 Z" fill="var(--sclera)"/>
      <circle cx="${cx}" cy="73.4" r="3.8" fill="${iris}"/><circle cx="${cx}" cy="73.4" r="1.8" fill="${INK}"/><circle cx="${x(-1.2)}" cy="72.2" r="1" fill="${HI}"/>
      ${line(`M${x(-10)} 74 Q${cx} 65.5 ${x(10)} 72.5`, 2.2)}${line(`M${x(-7)} 77 Q${cx} 79 ${x(7)} 76.5`, 0.9, 'opacity=".5"')}`;
  };
  const brows = `<path d="M75 64 Q85 58 96 61 L96 64.5 Q85 62.5 76 67 Z" fill="${hair}"/><path d="M125 64 Q115 58 104 61 L104 64.5 Q115 62.5 124 67 Z" fill="${hair}"/>
    ${line('M75 64 Q85 58 96 61 M125 64 Q115 58 104 61', 1, 'opacity=".6"')}`;
  const nose = `${shade('M101 70 Q105 82 106 93 L102 94 Q102 82 100 72 Z', 0.28)}${glow('M97 80 a1.6 5 0 1 0 3.2 0 a1.6 5 0 1 0 -3.2 0', 0.25)}
    ${line('M93 94 Q96 98 100 96.5 Q104 98 107 94', 1.6)}<ellipse cx="96.5" cy="94" rx="1.8" ry="1" fill="${SH}" opacity=".5"/><ellipse cx="103.5" cy="94" rx="1.8" ry="1" fill="${SH}" opacity=".5"/>`;
  const mouth = `<path d="M88 105 Q95 101.5 100 103.5 Q105 101.5 112 105 Q100 107.5 88 105 Z" fill="var(--lip)"/>
    <path d="M89.5 105.6 Q100 113 110.5 105.6 Q100 108.6 89.5 105.6 Z" fill="var(--lip)"/>${glow('M95 108 Q100 110.4 105 108 Q100 109 95 108 Z', 0.35)}
    ${line('M88 105 Q100 108 112 105', 1.4)}`;

  const beard = {
    'por fazer': `<path d="M72 88 C74 108 86 123 100 124 C114 123 126 108 128 88 C124 100 116 106 112 112 Q100 118 88 112 C84 106 76 100 72 88 Z" fill="${hair}" opacity=".28"/><path d="M88 101 Q100 97 112 101 Q100 103 88 101 Z" fill="${hair}" opacity=".3"/>`,
    cavanhaque: `<path d="M90 110 Q100 130 110 110 Q100 116 90 110 Z" fill="${hair}"/><path d="M86 102 Q100 95 114 102 Q100 101 86 102 Z" fill="${hair}"/>${line('M90 110 Q100 130 110 110', 1.2)}`,
    bigode: `<path d="M85 103 Q100 94 115 103 Q108 100 100 101 Q92 100 85 103 Z" fill="${hair}"/>${line('M85 103 Q100 94 115 103', 1.2)}`,
    cheia: `<path d="M70 82 C72 108 86 126 100 127 C114 126 128 108 130 82 C126 94 118 100 112 110 Q100 116 88 110 C82 100 74 94 70 82 Z" fill="${hair}"/><path d="M85 103 Q100 94 115 103 Q100 101 85 103 Z" fill="${hair}"/>
      ${glow('M80 100 Q86 112 94 118', 0)}${line('M70 82 C72 108 86 126 100 127 C114 126 128 108 130 82', 1.6)}<path d="M80 104 L82 112 M88 112 L89 120 M100 116 L100 124 M112 112 L111 120 M120 104 L118 112" stroke="${HI}" stroke-width="1" opacity=".25"/>`,
  }[a.beard] || '';

  const strands = d => `<path d="${d}" fill="none" stroke="${HI}" stroke-width="1.2" opacity=".22" stroke-linecap="round"/>`;
  const top = {
    curto: `<path d="M66 64 C60 30 80 14 100 14 C122 14 142 30 134 64 C130 50 124 40 112 37 C100 44 84 41 76 39 C70 46 68 55 66 64 Z" fill="${hair}"/>${shade('M118 22 C136 32 140 48 134 64 C130 50 124 40 112 37 Z', 0.25)}${strands('M78 26 Q90 20 102 24 M96 18 Q112 16 124 26 M74 38 Q84 30 96 32')}${line('M66 64 C60 30 80 14 100 14 C122 14 142 30 134 64', 2.2)}`,
    'degradê': `<path d="M68 62 C66 52 68 46 72 42 C76 52 76 58 70 66 Z M132 62 C134 52 132 46 128 42 C124 52 124 58 130 66 Z" fill="${hair}" opacity=".45"/><path d="M70 46 C66 20 92 8 108 12 C128 14 138 28 130 46 C120 34 100 32 84 38 C78 40 74 42 70 46 Z" fill="${hair}"/>${shade('M118 16 C134 24 136 36 130 46 C124 38 118 34 110 33 Z', 0.25)}${strands('M80 26 Q96 14 116 18 M84 34 Q100 26 120 28')}${line('M70 46 C66 20 92 8 108 12 C128 14 138 28 130 46', 2.2)}`,
    longo: `<path d="M64 66 C58 28 80 12 100 12 C122 12 144 28 136 66 C132 50 124 38 108 36 C96 42 82 44 72 42 C68 50 66 58 64 66 Z" fill="${hair}"/><path d="M66 62 C64 84 64 104 70 122 L77 119 C72 98 72 78 74 60 Z M134 62 C136 84 136 104 130 122 L123 119 C128 98 128 78 126 60 Z" fill="${hair}"/>${shade('M120 20 C138 30 142 48 136 66 C132 50 124 38 112 36 Z', 0.25)}${strands('M76 26 Q92 16 108 20 M98 16 Q116 16 128 28 M68 70 Q66 96 72 116 M132 70 Q134 96 128 116')}${line('M64 66 C58 28 80 12 100 12 C122 12 144 28 136 66', 2.2)}`,
    coque: `<circle cx="100" cy="12" r="11" fill="${hair}"/>${line('M89 12 a11 11 0 1 1 22 0', 2)}<path d="M68 58 C66 28 84 18 100 18 C118 18 134 28 132 58 C126 42 114 34 100 34 C86 34 74 42 68 58 Z" fill="${hair}"/>${shade('M116 22 C130 30 134 44 132 58 C128 46 122 38 112 35 Z', 0.25)}${strands('M78 30 Q90 22 100 22 M100 22 Q112 22 122 30')}${line('M68 58 C66 28 84 18 100 18 C118 18 134 28 132 58', 2)}`,
    raspado: `<path d="M68 60 C66 30 84 20 100 20 C118 20 134 30 132 60 C126 44 114 36 100 36 C86 36 74 44 68 60 Z" fill="${hair}" opacity=".5"/>`,
    'boné': `<path d="M66 56 C64 26 84 14 100 14 C118 14 136 26 134 56 Z" fill="${cloth}"/>${shade('M118 18 C132 26 136 40 134 56 L122 56 C124 40 122 28 118 18 Z', 0.25)}${glow('M76 30 C84 20 92 18 100 18 C90 24 84 32 80 44 Z', 0.2)}
      <path d="M96 52 C116 46 150 46 162 54 C150 60 120 60 96 58 Z" fill="${cloth}"/>${shade('M96 55 C120 56 150 58 162 54 C150 60 120 60 96 58 Z', 0.35)}${line('M66 56 C64 26 84 14 100 14 C118 14 136 26 134 56 M96 52 C116 46 150 46 162 54 C150 60 120 60 96 58 M100 14 L100 52', 2)}<circle cx="100" cy="15" r="2.4" fill="${cloth}" stroke="${INK}" stroke-width="1.2"/>`,
  }[a.hair] || '';

  const ACC = {
    'óculos escuros': `<path d="M74 70 Q74 82 84 83 Q95 83 96 72 Q96 66 86 66 Q74 66 74 70 Z" fill="url(#${id}-lens)"/><path d="M126 70 Q126 82 116 83 Q105 83 104 72 Q104 66 114 66 Q126 66 126 70 Z" fill="url(#${id}-lens)"/>
      <path d="M74 70 Q74 82 84 83 Q95 83 96 72 Q96 66 86 66 Q74 66 74 70 Z M126 70 Q126 82 116 83 Q105 83 104 72 Q104 66 114 66 Q126 66 126 70 Z M96 69 Q100 66 104 69 M74 69 L68 67 M126 69 L132 67" fill="none" stroke="url(#${id}-gold)" stroke-width="1.8"/>${glow('M78 70 L84 68 L80 76 Z M108 70 L114 68 L110 76 Z', 0.4)}`,
    'corrente de ouro': `<path d="M82 148 Q100 176 118 148" fill="none" stroke="url(#${id}-gold)" stroke-width="3.2" stroke-dasharray="3 1.4"/><path d="M95 166 L100 160 L105 166 L100 176 Z" fill="url(#${id}-gold)" stroke="var(--gold-lo)" stroke-width=".8"/>`,
    'fone gamer': `<path d="M64 64 C58 10 142 10 136 64" fill="none" stroke="${INK}" stroke-width="7"/><path d="M64 64 C58 10 142 10 136 64" fill="none" stroke="var(--hud-accent)" stroke-width="2.4"/>
      <rect x="56" y="58" width="14" height="26" rx="6" fill="${INK}"/><rect x="130" y="58" width="14" height="26" rx="6" fill="${INK}"/><rect x="58" y="62" width="4" height="18" rx="2" fill="var(--hud-accent)"/><rect x="138" y="62" width="4" height="18" rx="2" fill="var(--hud-accent)"/>`,
    brinco: `<circle cx="64" cy="88" r="2.6" fill="url(#${id}-gold)"/><circle cx="136" cy="88" r="2.6" fill="url(#${id}-gold)"/>`,
    'boné de marca': `<path d="M64 54 C62 22 84 10 100 10 C118 10 138 22 136 54 Z" fill="var(--ink-line)"/>${glow('M76 28 C84 18 92 16 100 16 C90 22 84 30 80 42 Z', 0.18)}
      <path d="M64 52 C80 46 120 46 136 52 C140 60 60 60 64 52 Z" fill="var(--ink-line)"/><circle cx="100" cy="34" r="7" fill="url(#${id}-gold)"/>${line('M64 54 C62 22 84 10 100 10 C118 10 138 22 136 54', 2)}`,
    'chapéu de peão': `<ellipse cx="100" cy="50" rx="62" ry="12" fill="var(--hair-3)"/>${shade('M40 50 Q100 70 160 50 Q100 62 40 50 Z', 0.35)}
      <path d="M70 50 C68 24 80 10 100 14 C120 10 132 24 130 50 Q100 58 70 50 Z" fill="var(--hair-3)"/><path d="M70 44 Q100 52 130 44 L130 50 Q100 58 70 50 Z" fill="var(--ink-line)"/>
      ${glow('M78 24 C86 16 94 14 100 16 C92 22 86 30 82 42 Z', 0.2)}${line('M40 50 Q100 66 160 50 M70 50 C68 24 80 10 100 14 C120 10 132 24 130 50', 1.8)}`,
    'chapéu de granjeiro': `<ellipse cx="100" cy="50" rx="58" ry="11" fill="#d9b25f"/>${shade('M42 50 Q100 68 158 50 Q100 61 42 50 Z', 0.3)}
      <path d="M72 50 C70 26 82 14 100 16 C118 14 130 26 128 50 Q100 57 72 50 Z" fill="#e8c878"/><path d="M72 44 Q100 51 128 44 L128 50 Q100 57 72 50 Z" fill="#b5462f"/>
      ${glow('M80 26 C88 18 94 17 100 18 C92 24 86 31 83 42 Z', 0.22)}${line('M42 50 Q100 65 158 50 M72 50 C70 26 82 14 100 16 C118 14 130 26 128 50', 1.6)}`,
    'grillz de ouro': `<path d="M91 105.4 Q100 109.5 109 105.4 L108 108 Q100 111 92 108 Z" fill="url(#${id}-gold)" stroke="var(--gold-lo)" stroke-width=".6"/>`,
    'pulseira de prata': '', 'relógio de luxo': '', 'anel de diamante': '',
  };
  const acc = accs.map(k => ACC[k] || '').join('');

  return `<svg viewBox="0 0 200 200" role="img" aria-label="${label || 'personagem'}">${defs}${backHair}${neck}${outfits[a.outfit] || outfits.camiseta}${tie}${ears}${head}${beard}${eye(86, false)}${eye(114, true)}${brows}${nose}${mouth}${top}${acc}</svg>`;
}
