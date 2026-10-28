# Deployment Guide

> **Note:** This document is a stub. Guilda currently targets local Podman Compose development only. This guide will be expanded when the project is ready for production deployment.

---

## Current State

The application runs fully in Podman Compose on a local machine. See the main [README](../README.md) for local setup instructions.

---

## What Changes for Production

The following items must be addressed before exposing the application to the internet:

### HTTPS

All services must be served over HTTPS in production:
- Browsers require a secure context for microphone/camera access (WebRTC).
- Google OAuth does not allow non-HTTPS redirect URIs for production credentials.
- Phoenix enforces HTTPS via `force_ssl` in `config/prod.exs`.

Use a reverse proxy (nginx, Caddy, or Traefik) in front of the Phoenix backend to terminate TLS.

### Environment Variables

Update `.env` for production:

```dotenv
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
MIX_ENV=prod
SECRET_KEY_BASE=<generate a new one with `mix phx.gen.secret`>
S3_SECRET_KEY=<strong random secret key>
```

### Object Storage (LocalStack → S3 / Cloudflare R2)

In production, replace LocalStack with a managed S3-compatible service:

1. Create a bucket in AWS S3 or Cloudflare R2.
2. Update these variables in `.env`:
   ```dotenv
   S3_ENDPOINT=https://s3.amazonaws.com        # or your R2/custom endpoint
   S3_PUBLIC_ENDPOINT=https://your-bucket.s3.amazonaws.com
   S3_ACCESS_KEY=<your-access-key>
   S3_SECRET_KEY=<your-secret-key>
   S3_BUCKET=guilda
   S3_REGION=us-east-1
   ```
3. Remove the `localstack` service from `compose.yaml` (or use a production override file).

### LiveKit (Voice/Video)

See [`docs/livekit-setup.md`](livekit-setup.md) for LiveKit production configuration, including STUN/TURN setup.

### Frontend

Replace the Vite dev server with a static build:

```bash
cd frontend && npm run build
```

Serve the `frontend/dist/` directory via nginx or a CDN, or copy it into the Phoenix static assets for a single-container deployment.

---

## Database Backups

### Taking a Backup

```bash
# Dump the database from the running Postgres container
podman compose exec postgres pg_dump -U guilda guilda_dev > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restoring a Backup

```bash
# Restore into a running Postgres container
podman compose exec -T postgres psql -U guilda guilda_dev < backup_YYYYMMDD_HHMMSS.sql
```

### Automated Backups

For production, configure a scheduled backup solution (e.g., cron + `pg_dump` uploaded to S3) or use a managed database service with point-in-time recovery.

---

## Checklist Before Going Live

- [ ] HTTPS configured with a valid TLS certificate
- [ ] `SECRET_KEY_BASE` regenerated (never reuse the dev value)
- [ ] `S3_SECRET_KEY` changed from default (or using real S3/R2 credentials)
- [ ] Google OAuth credentials updated with production redirect URI
- [ ] Google OAuth consent screen published (not in Testing mode)
- [ ] `FIRST_ADMIN_EMAIL` set to the correct admin email
- [ ] LocalStack removed and real S3/R2 bucket configured with appropriate access policies
- [ ] Database backup schedule in place
- [ ] `MIX_ENV=prod` set
- [ ] LiveKit configured with STUN/TURN if needed (Phase 6)
