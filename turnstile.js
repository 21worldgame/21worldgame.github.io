// Cloudflare Turnstile: o "não sou robô" do Cloudflare no login e no cadastro (barra fazenda de contas e robô tentando senha).
// Quem confere o token é o próprio Supabase (Authentication > Attack Protection > Captcha, provedor Turnstile, com a chave secreta).
// Desligado enquanto SUPABASE.turnstile (chave pública do site) estiver vazio. Invisível: só pede um clique se o Cloudflare desconfiar.
// Cada token vale para uma chamada: pegue um novo para cada signUp/signInWithPassword.
import { SUPABASE } from './supabase-config.js';

let lib = null;
const load = () => lib ||= new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
  s.onload = () => ok(window.turnstile); s.onerror = () => { lib = null; no(new Error('captcha: não carregou')); };
  document.head.append(s);
});

// box: elemento dentro do formulário onde o desafio aparece se precisar. Sem chave: devolve undefined (Supabase ignora).
export async function captcha(box) {
  if (!SUPABASE.turnstile) return undefined;
  const ts = await load();
  box.hidden = false; box.replaceChildren();
  return new Promise((ok, no) => ts.render(box, {
    sitekey: SUPABASE.turnstile, language: 'pt-br', appearance: 'interaction-only',
    callback: t => { ok(t); setTimeout(() => { box.hidden = true; }, 300); },
    'error-callback': () => no(new Error('captcha: falhou')), 'expired-callback': () => no(new Error('captcha: expirou')),
  }));
}
