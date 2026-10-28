# Guia de Deploy em Produção (Guilda)

Este guia orienta a preparação e implantação do Guilda em um servidor ou provedor de nuvem (VPS, AWS, DigitalOcean, Hetzner, etc.).

---

## 1. Diferenças entre Desenvolvimento e Produção

| Recurso | Desenvolvimento (Local) | Produção |
|---|---|---|
| **Protocolo Web** | HTTP (`http://localhost:5173`) | **HTTPS** obrigatório (Let's Encrypt / Certbot / Cloudflare) |
| **Frontend** | Vite Dev Server (porta 5173) | Build estático (`npm run build`) servido por Nginx ou Caddy |
| **Object Storage (S3)** | LocalStack S3 (`http://localstack:4566`) | AWS S3, Cloudflare R2 ou MinIO com TLS |
| **LiveKit SFU** | LocalHost (`ws://localhost:7880`) | Domínio dedicado (`wss://livekit.seudominio.com`) com TURN |
| **Google OAuth** | Redirecionamento `localhost:4000` | Redirecionamento `https://api.seudominio.com/auth/google/callback` |

---

## 2. Variáveis de Ambiente de Produção

Crie o arquivo `.env.prod` seguro no servidor:

```bash
# Servidor & Segredos
SECRET_KEY_BASE="gere_uma_chave_segura_de_64_bytes_com_mix_phx_gen_secret"
APP_URL="https://api.seudominio.com"
FRONTEND_URL="https://seudominio.com"
FIRST_ADMIN_EMAIL="seu-email-admin@gmail.com"

# Banco de Dados & Cache
DATABASE_URL="ecto://guilda:SEU_PASSWORD_FORTE@postgres:5432/guilda_prod"
REDIS_URL="redis://:SEU_REDIS_PASSWORD@redis:6379/0"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="seu-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu-google-client-secret"
GOOGLE_REDIRECT_URI="https://api.seudominio.com/auth/google/callback"

# Storage S3 / R2
S3_ACCESS_KEY="sua-access-key"
S3_SECRET_KEY="sua-secret-key"
S3_BUCKET="guilda-uploads-prod"
S3_REGION="us-east-1"
# Opcional (se usar MinIO ou Cloudflare R2): S3_ENDPOINT="https://seu-id-r2.r2.cloudflarestorage.com"

# LiveKit WebRTC
LIVEKIT_URL="https://livekit.seudominio.com"
LIVEKIT_API_KEY="sua-livekit-api-key"
LIVEKIT_API_SECRET="sua-livekit-api-secret-forte"
```

---

## 3. Backup e Restauração do Banco de Dados PostgreSQL

### Backup Manual
```bash
# Executar dump do banco dentro do container
podman compose exec postgres pg_dump -U guilda guilda_prod | gzip > backup_guilda_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restauração do Backup
```bash
# Descompactar e restaurar
gunzip -c backup_guilda_20261028.sql.gz | podman compose exec -i postgres psql -U guilda guilda_prod
```

### Backup Automático via Cron
Adicione ao crontab do servidor para backup diário às 03:00 da manhã:
```cron
0 3 * * * podman compose -f /opt/guilda/compose.prod.yaml exec -T postgres pg_dump -U guilda guilda_prod | gzip > /backups/guilda_$(date +\%Y\%m\%d).sql.gz
```

---

## 4. Reverse Proxy com HTTPS (Nginx / Caddy)

Exemplo de configuração Nginx com suporte a WebSockets (`/socket`) e LiveKit:

```nginx
server {
    listen 443 ssl http2;
    server_name seudominio.com;

    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;

    # Frontend SPA
    location / {
        root /var/www/guilda/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Phoenix Channels WebSocket
    location /socket {
        proxy_pass http://127.0.0.1:4000/socket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```
