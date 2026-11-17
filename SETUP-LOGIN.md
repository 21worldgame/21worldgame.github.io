# Ligar o login (Supabase)

Sem isto o jogo funciona igual, sem conta, salvando só no navegador de cada pessoa.
Com isto, as pessoas criam conta, o progresso vai para a nuvem e dá para jogar de qualquer aparelho.

## 1. Criar o projeto
1. Entre em https://supabase.com e crie um projeto (plano grátis serve para começar).
2. Guarde a senha do banco que ele pedir. O jogo não usa essa senha.

## 2. Criar as tabelas
1. No painel: **SQL Editor** > **New query**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Pode rodar de novo sem medo; o arquivo é idempotente.

## 3. Configurar o login
Em **Authentication**:
- **URL Configuration**
  - *Site URL*: o endereço do jogo no GitHub Pages (ex.: `https://SEU-USUARIO.github.io/21world/`).
  - *Redirect URLs*: o mesmo endereço, e também `http://localhost:8080/21world/` para testar aqui.
  - Sem isso, os links de "confirmar e-mail" e "esqueci a senha" levam para o lugar errado.
- **Providers > Email**: deixe ligado. Recomendo manter **Confirm email** ligado, para ninguém criar conta com e-mail dos outros.
- **E-mail em quantidade (importante antes de abrir o cadastro)**: o envio padrão do Supabase aceita só uns poucos e-mails por hora.
  Com várias pessoas se cadastrando, os e-mails de confirmação vão falhar. Em **Project Settings > Authentication > SMTP Settings** ligue um SMTP próprio (Resend, Brevo, Gmail com senha de app etc.).
- **Login com GitHub (opcional)**:
  1. GitHub > Settings > Developer settings > OAuth Apps > New OAuth App.
  2. *Authorization callback URL*: copie do Supabase em Authentication > Providers > GitHub.
  3. Cole o *Client ID* e o *Client secret* no Supabase e ative o provedor.
  4. No `supabase-config.js`, coloque `providers: ['github']`.

## 4. Colar os dados no jogo
Em **Project Settings > API**, copie:
- **Project URL**
- **anon public key**

Cole em `supabase-config.js`:

```js
export const SUPABASE = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
  providers: [],
};
```

A chave `anon` pode ficar no site: quem protege os dados são as regras (RLS) do `schema.sql`, que deixam cada pessoa ler e gravar só o próprio save.
**Nunca coloque a chave `service_role` no jogo.** Ela ignora todas as regras.

## 5. Testar
1. Abra o jogo: deve aparecer a tela "entre para jogar".
2. Crie uma conta, entre, jogue uma mão e espere uns 5 segundos.
3. No Supabase, em **Table Editor > saves**, deve aparecer uma linha com o seu save.
4. Em outro navegador, entre com a mesma conta: o progresso deve estar lá.

## O que precisa saber
- **O ranking não é oficial.** Os valores vêm do aparelho do jogador, então quem sabe mexer no navegador consegue adulterar fichas e patrimônio. Para um ranking confiável, as regras do jogo teriam que rodar no servidor.
- **Dois aparelhos ao mesmo tempo**: vale o save mais recente (o último a gravar vence).
- **Nome do jogador**: único (sem diferenciar maiúsculas). Se já existir, o jogo acrescenta um número.
- **Apagar dados (LGPD)**: o botão "apagar meus dados" no perfil apaga o save e o perfil da nuvem. O cadastro em si (e-mail) é apagado por você em **Authentication > Users**.
- **Moderação**: não há filtro de nomes ofensivos. Se precisar, renomeie ou apague a linha em `public_profiles`.
