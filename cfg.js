// configuração do servidor do jogo (chave pública: quem protege os dados são as regras do servidor)
const d = s => atob(s.split('').reverse().join(''));
export const SRV = {
  url: d('==wbj5SZzFmYhBXdz5SdohWdwpXchZGakh3ZiZmc1NXdt9yL6MHc0RHa'),
  anonKey: d('==ANMVUR2Yza18VU0hmcrR3VKRTZq5UbtkTMT9mM2M2NfVGbiFGazlGbiVHcfJ2c'),
  turnstile: '',   // chave pública do site (Cloudflare Turnstile). Vazia = desligado.
  providers: [],   // login social opcional: ['github'] ou ['github', 'google']
};
