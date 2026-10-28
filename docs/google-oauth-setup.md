# Configuração do Google OAuth 2.0 (Google SSO)

O Guilda utiliza autenticação via Google OAuth 2.0 para login seguro sem necessidade de gerenciar senhas.

---

## 1. Criar Projeto no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto ou selecione um existente (ex: `guilda-auth`).
3. No menu lateral, navegue até **APIs e Serviços** > **Tela de consentimento OAuth**.

---

## 2. Configurar a Tela de Consentimento OAuth

1. Escolha o tipo de usuário:
   - **Externo** (recomendado para grupos de amigos com e-mails pessoais/Gmail) ou **Interno** (Google Workspace).
2. Preencha os campos obrigatórios:
   - **Nome do App:** `Guilda`
   - **E-mail para suporte do usuário:** Seu e-mail
   - **Dados de contato do desenvolvedor:** Seu e-mail
3. **Escopos (Scopes):**
   - Adicione os escopos básicos: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
4. **Usuários de teste:**
   - Enquanto o app estiver em modo de teste, adicione os e-mails dos amigos que terão permissão para logar.

---

## 3. Criar Credenciais OAuth 2.0

1. No menu lateral, clique em **Credenciais**.
2. Clique em **+ Criar Credenciais** > **ID do cliente OAuth**.
3. **Tipo de aplicativo:** `Aplicativo da Web` (Web Application).
4. **Nome:** `Guilda Web Client`.
5. **Origens JavaScript autorizadas:**
   - `http://localhost:5173` (Frontend)
   - `http://localhost:4000` (Backend)
6. **URIs de redirecionamento autorizados:**
   - `http://localhost:4000/auth/google/callback` (Endpoint de callback do backend Phoenix)
7. Clique em **Criar**.

---

## 4. Configurar no Arquivo `.env`

Copie o **Client ID** e o **Client Secret** gerados e adicione no arquivo `.env` na raiz do projeto:

```bash
GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/auth/google/callback"
FIRST_ADMIN_EMAIL="seu-email@gmail.com"
```

---

## 5. Como Funciona o Acesso no Guilda

1. O usuário clica em **Entrar com Google** no frontend.
2. O Google redireciona para o callback do Phoenix (`/auth/google/callback`).
3. O backend verifica:
   - Se o e-mail corresponde a `FIRST_ADMIN_EMAIL`, ele é promovido automaticamente a **Admin**.
   - Se o e-mail estiver na **Allowlist** ou o usuário estiver acessando via um **Link de Convite**, a conta é criada/autorizada com cargo de **Membro**.
   - Caso contrário, o login é recusado com erro `access_denied`.
