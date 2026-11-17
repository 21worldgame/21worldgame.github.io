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

# Painel administrativo (central-r7k2.html)

O painel fica em `https://21worldgame.github.io/central-r7k2.html`. Ele não aparece em nenhum menu do jogo.
Quem decide quem é administrador é o banco, nunca o site: sem estar na tabela `admins`, a pessoa não lê nem muda nada.

## Ativar (uma vez)
1. No Supabase, em **Authentication > Sign In / Providers > Email**, desligue **Confirm email** (o jogo não usa e-mail de confirmação).
2. Abra o **SQL Editor**, cole todo o `supabase/admin.sql` e clique em **Run**. Ele também confirma sozinho toda conta nova.
3. (Opcional) Para zerar todas as contas, rode `supabase/reset-contas.sql`.
4. Crie a sua conta normalmente pelo jogo, com o e-mail de administrador. Ela entra na hora.
5. No SQL Editor, rode a linha que cadastra o administrador (está em `supabase/admin-setup.local.sql`, que não vai para o GitHub):
   `insert into public.admins (user_id) select id from auth.users where lower(email) = 'seu-email' on conflict do nothing;`
   O administrador fica preso ao ID da conta: alguém que crie outra conta com o mesmo e-mail não vira administrador.
6. Abra `central-r7k2.html` e entre com o mesmo e-mail e senha do jogo.

## Senha esquecida (sem e-mail)
No jogo, "esqueci a senha" abre um formulário: e-mail, nome do personagem, o que a pessoa lembra da conta e a senha nova.
O pedido aparece na aba **senhas** do painel ao lado dos dados reais da conta. Aprovar troca a senha na hora; a senha
fica guardada só cifrada (bcrypt) e ninguém a vê. A pessoa recebe sempre a mesma resposta, exista a conta ou não.

## Entrar com Google
1. No Google Cloud Console, crie um "ID do cliente OAuth" do tipo Aplicativo da Web. Em "URIs de redirecionamento autorizados" coloque
   `https://musurfbgxdhfaqzpuhhu.supabase.co/auth/v1/callback`.
2. No Supabase, em **Authentication > Sign In / Providers > Google**, ligue e cole o Client ID e o Client Secret.
3. Em **Authentication > URL Configuration**, Site URL `https://21worldgame.github.io/` e Redirect URL `https://21worldgame.github.io/**`.
O botão "entrar com Google" aparece sozinho no jogo assim que o provedor estiver ligado.

## O que dá para fazer
- **Senhas**: pedidos de senha nova para aprovar ou recusar.
- **Visão geral**: jogadores, novos cadastros, ativos nas últimas 24 h, suspensos e os mais ricos.
- **Jogadores**: buscar por nome ou e-mail, ver o save completo, dar ou tirar dinheiro, fichas e XP, mandar mensagem, renomear, suspender por um tempo ou sem prazo, reativar, reiniciar o progresso e apagar o save.
  O que você manda vira uma "ordem" que o jogo do jogador aplica sozinho em até 1 minuto, uma vez só.
- **Economia e eventos**: multiplicadores de XP, da roleta do dia, dos trabalhos e dos prêmios; nome do evento (aparece numa faixa no topo do jogo); modo manutenção; presente para todos os jogadores.
- **Avisos**: mensagens que aparecem para todos, com prazo.
- **Registro**: tudo o que cada administrador fez, com data.

## Limites
- Apagar a conta de e-mail de alguém é em **Authentication > Users** no Supabase (o site não tem permissão para isso, de propósito).
- Os números do jogo ficam no aparelho de cada jogador; quem entende de programação consegue alterar o próprio save. O painel mostra e corrige, mas não impede isso.
