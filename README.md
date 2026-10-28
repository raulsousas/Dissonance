# Guilda

A private, invite-only communication platform for small groups of friends — inspired by the layout and workflow of Discord, built with Elixir/Phoenix on the backend and React on the frontend.

> **Status:** Active development — Phase 1 (Foundation) in progress.

---

## Table of Contents

- [What is Guilda?](#what-is-guilda)
- [Technology Stack](#technology-stack)
- [Version Requirements](#version-requirements)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [First-time Setup](#first-time-setup)
  - [Running the Application](#running-the-application)
  - [Stopping the Application](#stopping-the-application)
- [Environment Variables](#environment-variables)
- [Creating the First Admin](#creating-the-first-admin)
- [Running Tests](#running-tests)
- [Documentation](#documentation)
- [Development Conventions](#development-conventions)

---

## What is Guilda?

Guilda is a self-hosted group communication application. It provides:

- **Servers** — private communities with channels, categories, roles, and permissions.
- **Text channels** — real-time messaging with history, reactions, replies, and file sharing.
- **Direct messages** — private conversations between members.
- **Voice/video channels** — powered by self-hosted [LiveKit](https://livekit.io/) (Phase 6).
- **Google SSO login** — no passwords; access is controlled by an allowlist and invite links.

Access is strictly private. Anyone who signs in with Google must be on the allowlist or hold a valid invite link. The first admin account is set via an environment variable.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS · Radix UI · Zustand · TanStack Query |
| Backend | Elixir 1.18 · Phoenix 1.8 · Phoenix Channels · Ecto |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| File storage | LocalStack S3 (local) / S3-compatible (production) |
| Voice / Video | WebRTC + LiveKit (Phase 6) |
| Infrastructure | Podman · Podman Compose |

---

## Version Requirements

These versions are pinned in [`.tool-versions`](.tool-versions) for use with [asdf](https://asdf-vm.com/):

| Tool | Version |
|---|---|
| Elixir | 1.18.5-otp-27 |
| Erlang/OTP | 27.3.4.19 |
| Node.js | 22.14.0 (LTS) |
| Docker image | `hexpm/elixir:1.18.5-erlang-27.3.4.19-alpine-3.24.3` |

Phoenix 1.8 requires Elixir ≥ 1.15 and OTP ≥ 25. These versions are verified against the [Phoenix compatibility matrix](https://hexdocs.pm/phoenix/changelog.html).

---

## Project Structure

```
/
├── frontend/            # React + TypeScript + Vite application
├── backend/             # Elixir + Phoenix application
├── infra/               # Container helpers, LocalStack init, nginx stubs (future)
├── docs/                # Project documentation
├── compose.yaml         # Development environment (Podman Compose)
├── .env.example         # Environment variable reference
├── .tool-versions       # asdf version pins
└── README.md
```

---

## Getting Started

### Prerequisites

You need one of the following setups:

**Option A — Podman (recommended)**
- [Podman](https://podman.io/) v5+ with the machine initialised and running
- Podman Compose (built-in `podman compose` subcommand, available in Podman 5+)

> **Windows / macOS setup:** Podman requires a Linux VM on these platforms.
> Run once before first use:
> ```bash
> podman machine init
> podman machine start
> ```

**Option B — Local development with asdf**
- [asdf](https://asdf-vm.com/) with `erlang`, `elixir`, and `nodejs` plugins
- Podman (for PostgreSQL, Redis, LocalStack)

### First-time Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url> guilda
   cd guilda
   ```

2. **Copy and configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in the required values. At minimum, set:
   - `SECRET_KEY_BASE` — generate with `mix phx.gen.secret` (or any 64+ random bytes)
   - `FIRST_ADMIN_EMAIL` — your Google email address
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`

   See [Environment Variables](#environment-variables) and [`docs/google-oauth-setup.md`](docs/google-oauth-setup.md) for details.

3. **Start the environment**

   ```bash
   podman compose up
   ```

   This starts PostgreSQL, Redis, LocalStack (S3), the Phoenix backend, and the Vite frontend dev server.
   On first start, Podman will build the application images — this takes a few minutes.

4. **Open the application**

   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:4000](http://localhost:4000)
   - LocalStack S3: [http://localhost:4566](http://localhost:4566)

### Running the Application

```bash
# Start all services in the foreground (logs visible)
podman compose up

# Start in the background
podman compose up -d

# View logs for a specific service
podman compose logs -f backend
podman compose logs -f frontend
```

### Stopping the Application

```bash
# Stop containers (data is preserved in volumes)
podman compose down

# Stop containers AND remove volumes (resets database and LocalStack — destructive)
podman compose down -v
```

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example). The table below lists the most important ones:

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY_BASE` | ✅ | Phoenix secret key (≥ 64 bytes). Run `mix phx.gen.secret`. |
| `DATABASE_URL` | ✅ | PostgreSQL connection string. |
| `REDIS_URL` | ✅ | Redis connection string. |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth 2.0 client ID. |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth 2.0 client secret. |
| `GOOGLE_REDIRECT_URI` | ✅ | Must match an authorized URI in Google Cloud Console. |
| `FIRST_ADMIN_EMAIL` | ✅ | Google email of the first admin user. |
| `APP_URL` | ✅ | Public URL of the backend (no trailing slash). |
| `FRONTEND_URL` | ✅ | Frontend origin (used for CORS). |
| `S3_ACCESS_KEY` | ✅ | S3 / LocalStack access key. |
| `S3_SECRET_KEY` | ✅ | S3 / LocalStack secret key. |
| `S3_BUCKET` | ✅ | S3 bucket name (default: `guilda`). |
| `MAX_UPLOAD_BYTES` | ❌ | Max file upload size in bytes. Default: `26214400` (25 MB). |

---

## Creating the First Admin

Set `FIRST_ADMIN_EMAIL` in your `.env` to your Google account email before starting the application for the first time. When you sign in with that Google account, the backend will automatically promote it to the admin role.

If you missed this step, you can set it manually:

```bash
# Connect to the running backend container
podman compose exec backend bin/guilda rpc 'Guilda.Accounts.promote_to_admin("your-email@gmail.com")'
```

---

## Running Tests

### Backend (Elixir / ExUnit)

```bash
# Run all backend tests
podman compose exec backend mix test

# Run a specific test file
podman compose exec backend mix test test/guilda/accounts_test.exs

# Run with coverage
podman compose exec backend mix test --cover
```

### Frontend (Vitest)

```bash
# Run all frontend unit/component tests
podman compose exec frontend npm test

# Watch mode
podman compose exec frontend npm run test:watch

# With UI
podman compose exec frontend npm run test:ui
```

### End-to-End (Playwright)

```bash
# Run all E2E tests (requires both services running)
podman compose exec frontend npm run test:e2e

# Headed mode (opens browser)
podman compose exec frontend npm run test:e2e -- --headed
```

---

## Documentation

| Document | Description |
|---|---|
| [`docs/google-oauth-setup.md`](docs/google-oauth-setup.md) | Step-by-step Google Cloud Console setup |
| [`docs/livekit-setup.md`](docs/livekit-setup.md) | LiveKit voice/video infrastructure (Phase 6) |
| [`docs/security.md`](docs/security.md) | Security measures and best practices |
| [`docs/voice-video.md`](docs/voice-video.md) | Voice and video architecture notes |
| [`docs/deployment.md`](docs/deployment.md) | Production deployment guide (stub) |
| [`guilda-plan.md`](guilda-plan.md) | Full project plan with phase breakdown |

---

## Development Conventions

- **Elixir:** Follow [Credo](https://github.com/rrrene/credo) defaults. Format with `mix format`.
- **TypeScript:** ESLint + Prettier (configured in `frontend/`). Format with `npm run format`.
- **Commits:** Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
- **Branches:** `main` is the stable branch. Use feature branches and PRs for changes.
- **Secrets:** Never commit `.env`. Rotate any secret accidentally committed immediately.
- **Dependencies:** Don't add new dependencies without a clear justification.
