# Diretrizes e Mecanismos de Segurança (Guilda)

Este documento resume as práticas, arquitetura e proteções de segurança implementadas no Guilda.

---

## 1. Autenticação e Sessões

- **Google OAuth 2.0 (OpenID Connect):**
  - Autenticação sem armazenamento ou gestão de senhas locais.
  - O fluxo OAuth valida o token e o e-mail retornado pela API oficial do Google.
- **Sessões HTTP-Only:**
  - Cookies de sessão emitidos com flags `HttpOnly`, `SameSite=Lax` (ou `Strict`) e `Secure` (em produção via HTTPS).
  - Tokens de sessão armazenados no PostgreSQL com hash seguro (SHA-256) e data de expiração.
- **Revogação Instantânea de Acesso:**
  - O administrador pode revogar todas as sessões ativas de qualquer usuário através do endpoint protegido `DELETE /api/admin/users/:id/access`.

---

## 2. Autorização e Controle de Acesso (RBAC)

- **Allowlist & Convites:**
  - Registro de novos usuários requer que o e-mail esteja na allowlist ou que o acesso seja feito através de um código de convite válido gerado por um membro autorizado.
- **Bitmask de Permissões de Servidor:**
  - Sistema de permissões baseado em máscara de bits por cargo (Roles) validado no backend Phoenix antes de qualquer mutação em canais, mensagens ou configurações de servidor.
- **Proteção de Rotas Administrativas:**
  - O plug `GuildaWeb.Plugs.RequireAdminPlug` bloqueia requisições a `/api/admin/*` com código HTTP `403 Forbidden` caso o usuário não possua `role == "admin"`.

---

## 3. Proteção no Armazenamento de Arquivos e Uploads

- **Validação de Tipos MIME & Tamanho:**
  - Limite máximo configurável (`MAX_UPLOAD_BYTES`, padrão: 25 MB).
  - Validação de extensões e tipos de conteúdo suportados (imagens PNG, JPG, GIF, WebP, vídeos MP4/WebM, áudios e documentos comuns).
- **Armazenamento Seguro em S3:**
  - Arquivos são salvos com identificadores UUID aleatórios no S3 / MinIO / LocalStack, evitando ataques de sobrescrita ou path traversal (`../`).
  - URLs de download são geradas com cabeçalhos apropriados de tipo e `Content-Disposition`.

---

## 4. Proteção contra Injeção e Sanitização de Conteúdo

- **Ecto Parameterized Queries:**
  - 100% das consultas ao banco de dados PostgreSQL utilizam consultas parametrizadas via Ecto, eliminando vulnerabilidades de SQL Injection.
- **Prevenção de XSS:**
  - O frontend React trata todo o conteúdo de mensagens como strings puras escapadas no DOM, prevenindo execução de scripts arbitrários.
- **Prevenção de CSRF:**
  - Endpoints de mutação utilizam proteção CSRF e validação de `Origin` / `Referer`.

---

## 5. WebRTC e Criptografia em Trânsito

- Toda a comunicação WebRTC de áudio e vídeo trafega criptografada ponta a ponta (DTLS-SRTP).
- Tokens JWT de acesso a salas de voz possuem validade curta e permissões restritas ao canal em questão.
