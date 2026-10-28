# Infrastructure

This directory contains container helpers and service configuration files.

## Services in compose.yaml (Phase 1)

| Service | Purpose | Ports |
|---|---|---|
| `postgres` | PostgreSQL 16 database | 5432 (internal), 5433 (host) |
| `redis` | Redis 7 (cache + PubSub) | 6379 (internal only) |
| `localstack` | LocalStack S3-compatible object storage | 4566 |
| `backend` | Elixir/Phoenix application | 4000 |
| `frontend` | Vite React dev server | 5173 |

## Container runtime

This project uses **Podman** (v5+) and `podman compose`.

On Windows and macOS, Podman requires a Linux VM. Set it up once:

```bash
podman machine init
podman machine start
```

## Accessing LocalStack S3

The S3 API is available at [http://localhost:4566](http://localhost:4566).

You can browse it with the AWS CLI (pointing at LocalStack):
```bash
aws --endpoint-url=http://localhost:4566 s3 ls
```

Or use any S3-compatible GUI tool (e.g. S3 Browser, Cyberduck) with:
- Endpoint: `http://localhost:4566`
- Access key: `guilda_local` (or the value of `S3_ACCESS_KEY` in `.env`)
- Secret key: `guilda_local_secret` (or the value of `S3_SECRET_KEY` in `.env`)

## Subdirectories

| Directory | Contents |
|---|---|
| `localstack/` | LocalStack S3 bucket initialisation script |
| `livekit/` | LiveKit configuration (added in Phase 6) |
| `nginx/` | Nginx reverse proxy configuration stubs (for production) |
