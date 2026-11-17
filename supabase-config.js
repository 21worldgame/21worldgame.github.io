// Dados do seu projeto no Supabase (Project Settings > API).
// A chave "anon" é pública de propósito: quem protege os dados são as regras de acesso (RLS) do supabase/schema.sql.
// NUNCA coloque aqui a chave "service_role".
// Enquanto url e anonKey estiverem vazios, o jogo funciona sem login, salvando só neste navegador.
export const SUPABASE = {
  url: 'https://musurfbgxdhfaqzpuhhu.supabase.co',
  anonKey: 'sb_publishable_7c62oS19-mNje4JWtkrhtQ_5k66EEL4',   // chave pública (publishable)
  providers: [],    // login social opcional, depois de ativar no painel: ['github'] ou ['github', 'google']
};
