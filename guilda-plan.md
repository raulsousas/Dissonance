# Ressonance — Technical Plan

## Top-Level Overview

**Goal:** Build a private, invite-only Discord-inspired communication platform called "Ressonance" for a small group of friends.

**Scope:**
- Full-stack application: React/TypeScript frontend + Elixir/Phoenix backend + PostgreSQL + Redis + MinIO
- Real-time messaging via Phoenix Channels (WebSocket)
- Voice/video via WebRTC + self-hosted LiveKit (Phase 6)
- Google OAuth 2.0 / OpenID Connect authentication with allowlist-based access control
- Roles, permissions, servers, channels, direct messages, friend system, notifications
- End-to-end Podman Compose environment; deployment-agnostic design

**Confirmed technical decisions:**

| Decision | Choice |
|---|---|
| Elixir/OTP | Latest stable mutually compatible versions with selected Phoenix; pinned in `.tool-versions` (asdf) and `Dockerfile`. Versions verified against Phoenix compatibility matrix before pinning. |
| Frontend testing | Vitest for unit and component tests; Playwright for E2E. Both configured with initial tests and documented commands in README. |
| File upload limit | 25 MB per file (default). Validated on backend via Ecto changeset + Plug multipart limit. Configurable via `MAX_UPLOAD_BYTES` env var. MIME type allowlist enforced. Authorization checked before accepting upload. |
| Phase 1 implementation | One sub-task at a time. Each sub-task: explain what was implemented, run relevant checks, confirm project remains runnable, wait for review before proceeding. |
| Monorepo layout | `frontend/`, `backend/`, `infra/`, Podman Compose at root |
| File storage — local | MinIO in Podman Compose; swap to S3/R2 documented for production |
| Google OAuth credentials | Not yet created; `docs/google-oauth-setup.md` included in plan |
| LiveKit timing | Added to Podman Compose only in Phase 6 |
| Deployment | Local Podman Compose first; deployment docs stubbed for later |
| Backend language | Elixir + Phoenix — not substituted |
| Database IDs | UUIDs (`--binary-id`) throughout |

**Non-goals for this plan:**
- Public community discovery
- Multi-region or distributed infrastructure
- Mobile native apps

**Repository layout:**
```
/
├── frontend/        # React + TypeScript + Vite
├── backend/         # Elixir + Phoenix
├── infra/           # Docker, MinIO config, nginx stubs, LiveKit config (Phase 6)
├── compose.yaml
├── .env.example
└── README.md
```

**Implementation approach:** One phase at a time, project always runnable after each phase.

---

## Phase 1 — Foundation

### 1.1 — Repository skeleton and tooling

**Intent:** Establish the monorepo layout, commit conventions, environment variable contract, and developer tooling so every subsequent phase starts on a solid base.

**Expected Outcomes:**
- `frontend/`, `backend/`, `infra/` directories exist with stub content
- `.env.example` documents every required variable with safe illustrative values
- `.gitignore` excludes secrets, build artifacts, and dependencies
- `README.md` explains what the project is and how to run it locally

**Todo List:**
1. Create top-level directories: `frontend/`, `backend/`, `infra/`
2. Write `.env.example` covering: database URL, Redis URL, MinIO credentials, Google OAuth client ID/secret, Phoenix secret key base, app URL, first-admin email
3. Write root `.gitignore` (Elixir, Node, Docker, env files)
4. Write initial `README.md` with project description and "getting started" section (to be expanded as phases complete)

**Relevant Context:** None — greenfield.

**Status:** `[x] done`

---

### 1.2 — Podman Compose environment (Phase 1 services)

**Intent:** Provide a single `podman compose up` command that starts PostgreSQL, Redis, MinIO, the Phoenix backend, and the Vite frontend dev server — fully wired together.

**Expected Outcomes:**
- `compose.yaml` at repo root starts all five services
- Services communicate over an internal container network
- Database persists data in a named volume
- MinIO bucket is initialized on first start
- Health checks defined for Postgres, Redis, MinIO
- Ports exposed: 4000 (backend), 5173 (frontend), 9000/9001 (MinIO console)

**Todo List:**
1. Write `compose.yaml` with services: `postgres`, `redis`, `minio`, `backend`, `frontend`
2. Add `infra/minio/init.sh` — creates the default bucket on startup via `mc`
3. Configure environment variable injection from `.env` file for each service
4. Add `infra/` README explaining each service and how to access MinIO console
5. Verify `podman compose up` reaches a healthy state (all containers green)

**Relevant Context:** MinIO image `minio/minio`; use `minio/mc` sidecar for bucket init.

**Status:** `[x] done`

---

### 1.3 — Phoenix backend scaffold

**Intent:** Create a well-structured Elixir/Phoenix application that will be the single source of truth for all business logic, data, and real-time events.

**Expected Outcomes:**
- Phoenix app generated at `backend/` with `--no-live --no-dashboard` (we add our own UI)
- Context modules planned: `Accounts`, `Servers`, `Channels`, `Messaging`, `Voice`, `Notifications`
- Ecto repo connected to PostgreSQL via environment variable
- Phoenix endpoint configured for WebSocket (Phoenix Channels)
- CORS policy allowing only the frontend origin
- Basic health-check route `GET /health` returning `200 OK`
- Mix releases configured for production use later

**Todo List:**
1. Run `mix phx.new Ressonance --no-live --no-dashboard --binary-id` inside `backend/`
2. Configure `config/dev.exs`, `config/runtime.exs` to read `DATABASE_URL`, `SECRET_KEY_BASE`, `APP_URL` from env
3. Set up CORS via `cors_plug` or Phoenix built-in, restricting to `APP_URL`
4. Add `GET /health` route in router
5. Create empty context modules with `@moduledoc` stubs: `Accounts`, `Servers`, `Channels`, `Messaging`, `Voice`, `Notifications`
6. Configure Mix release in `mix.exs`
7. Write `backend/Dockerfile` (multi-stage: build with Elixir image, run with slim Debian)

**Relevant Context:** Use `--binary-id` for UUIDs throughout. Phoenix 1.7+.

**Status:** `[x] done`

---

### 1.4 — Database schema and migrations (Phase 1)

**Intent:** Define and version-control the core database schema so every developer starts from the same foundation.

**Expected Outcomes:**
- Ecto migrations exist for: `users`, `sessions`, `servers`, `server_members`, `roles`, `channels`, `messages`, `direct_conversations`, `direct_messages`, `friendships`, `invites`, `notifications`, `admin_logs`
- All foreign keys, indexes on frequently queried columns, and `inserted_at`/`updated_at` timestamps present
- `mix ecto.create && mix ecto.migrate` runs cleanly in Docker

**Todo List:**
1. Generate migration for `users` (id UUID, email, google_sub, display_name, avatar_url, status, role [admin/member], inserted_at, updated_at)
2. Generate migration for `sessions` (id, user_id FK, token_hash, expires_at, user_agent, inserted_at)
3. Generate migration for `servers` (id, name, description, icon_url, owner_id FK, inserted_at, updated_at)
4. Generate migration for `roles` (id, server_id FK, name, permissions bitmask integer, position, is_default)
5. Generate migration for `server_members` (id, server_id FK, user_id FK, role_id FK, joined_at)
6. Generate migration for `channel_categories` (id, server_id FK, name, position)
7. Generate migration for `channels` (id, server_id FK, category_id FK nullable, name, type [text/voice], position, topic)
8. Generate migration for `messages` (id, channel_id FK, author_id FK, content, edited_at, reply_to_id FK nullable, inserted_at)
9. Generate migration for `message_reactions` (id, message_id FK, user_id FK, emoji)
10. Generate migration for `message_attachments` (id, message_id FK, url, filename, size, content_type)
11. Generate migration for `direct_conversations` (id, inserted_at)
12. Generate migration for `direct_conversation_members` (conversation_id FK, user_id FK)
13. Generate migration for `direct_messages` (id, conversation_id FK, author_id FK, content, edited_at, inserted_at)
14. Generate migration for `friendships` (id, requester_id FK, addressee_id FK, status [pending/accepted/blocked], inserted_at)
15. Generate migration for `invites` (id, server_id FK, created_by FK, code unique, max_uses, uses, expires_at, inserted_at)
16. Generate migration for `notifications` (id, user_id FK, type, data jsonb, read_at, inserted_at)
17. Generate migration for `admin_logs` (id, actor_id FK, action, target_type, target_id, metadata jsonb, inserted_at)
18. Add composite unique indexes (server_members: server_id+user_id; friendships: requester_id+addressee_id)
19. Run migrations in Docker and confirm zero errors

**Relevant Context:** Use UUIDs (`binary_id`). Permissions bitmask on `roles` allows flexible per-server permission sets.

**Status:** `[x] done`

---

### 1.5 — React frontend scaffold

**Intent:** Create the frontend application with all tooling configured, a working dev server inside Docker, and a navigable shell layout that visually resembles the target design.

**Expected Outcomes:**
- Vite + React + TypeScript app at `frontend/`
- Tailwind CSS configured with a dark-mode-first theme using a Discord-inspired color palette
- Radix UI primitives installed
- Zustand installed
- TanStack Query installed and configured with a `QueryClient`
- React Router v6 with route definitions: `/login`, `/app` (protected), `/app/servers/:serverId`, `/app/dm`
- Shell layout component rendered at `/app`: server sidebar (left), channel sidebar, main area, member panel, user bar (bottom-left)
- All panels are empty/static in Phase 1 — structure only
- `frontend/Dockerfile` for the Vite dev server in Docker

**Todo List:**
1. Run `npm create vite@latest . -- --template react-ts` inside `frontend/`
2. Install and configure Tailwind CSS with custom theme tokens (background, surface, accent colors)
3. Install `@radix-ui/react-*` core primitives (dialog, dropdown-menu, tooltip, popover, scroll-area, separator, avatar, context-menu)
4. Install `zustand`, `@tanstack/react-query`, `react-router-dom`, `lucide-react` (icons)
5. Set up `QueryClient` provider in `main.tsx`
6. Create route structure in `App.tsx`
7. Build `AppLayout` component with the five-panel shell (server bar, channel sidebar, main area, member panel, user bar)
8. Apply Tailwind dark theme; make layouts responsive with sidebar collapse on smaller screens
9. Create placeholder pages: `LoginPage`, `AppPage`, `ChannelPage`, `DmPage`
10. Configure Vite proxy: `/api` → `http://backend:4000`
11. Write `frontend/Dockerfile` using Node + `npm run dev` with host binding

**Relevant Context:** Color palette reference: Discord dark background ~`#313338`, sidebar ~`#2b2d31`, surface ~`#1e1f22`.

**Status:** `[x] done`

---

## Phase 2 — Authentication and Access Control

### 2.1 — Google OAuth credentials setup documentation

**Intent:** Provide complete instructions so the developer can obtain real Google OAuth credentials without guessing.

**Expected Outcomes:**
- `docs/google-oauth-setup.md` with step-by-step Google Cloud Console instructions
- `.env.example` updated with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Notes on allowed redirect URIs for local dev (`http://localhost:4000/auth/google/callback`) and production

**Todo List:**
1. Write `docs/google-oauth-setup.md` covering: create project, enable Google Identity API, configure OAuth consent screen, create OAuth 2.0 Web Application credentials, set authorized redirect URIs
2. Update `.env.example` with all OAuth variables and placeholder values

**Status:** `[x] done`

---

### 2.2 — Phoenix authentication: Google OAuth + sessions

**Intent:** Implement secure server-side OAuth 2.0 flow with session management. No passwords stored.

**Expected Outcomes:**
- `GET /auth/google` redirects user to Google with `state` and `nonce` parameters
- `GET /auth/google/callback` validates `state`, exchanges code for tokens, verifies ID token, upserts user in DB
- Session created with HttpOnly + Secure (prod) + SameSite=Lax cookie
- Unauthorized users (not on allowlist) receive a clear rejection — no session created
- `DELETE /auth/logout` destroys session
- `GET /api/me` returns current user or 401
- Rate limiting on OAuth callback endpoint

**Todo List:**
1. Add `ueberauth` + `ueberauth_google` to `mix.exs`; configure in `config/`
2. Implement `AuthController` with `request/2`, `callback/2`, `logout/2` actions
3. In `callback/2`: validate state, extract Google profile (sub, email, name, picture), call `Accounts.find_or_create_user/1`
4. In `Accounts.find_or_create_user/1`: check allowlist before creating/updating user; return `{:error, :unauthorized}` if not allowed
5. Implement `Accounts.create_session/2` — generate secure random token, store hash in DB, set cookie
6. Implement `AuthPlug` — reads session cookie, loads user into `conn.assigns.current_user`; returns 401 on missing/expired session
7. Add `GET /api/me` returning current user JSON
8. Add `DELETE /auth/logout` clearing cookie and deleting session record
9. Configure rate limiting on callback route using `plug_attack` or Phoenix built-in
10. Write unit tests for `Accounts` context: allowlist check, session creation, session expiry

**Status:** `[x] done`

---

### 2.3 — Admin allowlist management

**Intent:** Implement the two access modes — allowlist and invites — with the first admin seeded via environment variable.

**Expected Outcomes:**
- `FIRST_ADMIN_EMAIL` env var seeds the first admin user on application start
- Admin API endpoints: `GET /api/admin/users`, `POST /api/admin/users/approve`, `DELETE /api/admin/users/:id/access`
- Only admin-role users can call admin endpoints (enforced by plug)
- Invite system: `POST /api/invites` creates time-limited invite codes; `GET /api/invites/:code/join` consumes them
- Non-allowlisted user attempting Google login receives an error page, not a session

**Todo List:**
1. Add `Accounts.seed_first_admin/0` called in `application.ex` — checks if `FIRST_ADMIN_EMAIL` is set and marks that user (or a pending record) as admin
2. Create `AdminPlug` that checks `current_user.role == :admin`
3. Implement admin routes under `/api/admin` protected by `AdminPlug`
4. Implement `Accounts.list_users/0`, `approve_user/1`, `revoke_access/1`
5. Implement `Invites` context: `create_invite/2`, `consume_invite/2`, `list_invites/1`, `revoke_invite/1`
6. Add invite routes: `POST /api/invites`, `GET /api/invites/:code`, `DELETE /api/invites/:code`
7. Write tests for allowlist and invite flows

**Status:** `[x] done`

---

### 2.4 — Frontend authentication flow

**Intent:** Wire the React app to the backend auth endpoints so users can log in with Google and be redirected to the app, with route protection.

**Expected Outcomes:**
- `LoginPage` shows "Continue with Google" button that redirects to `/auth/google`
- After OAuth callback, backend redirects to `/app` with session cookie set
- `useAuth` hook exposes `currentUser`, `isLoading`, `logout`
- Protected route wrapper redirects unauthenticated users to `/login`
- Error state shown when user is not authorized (not on allowlist)
- `logout()` calls `DELETE /auth/logout` and redirects to `/login`

**Todo List:**
1. Create `useAuth` hook using TanStack Query to fetch `GET /api/me`
2. Create `AuthProvider` wrapping the app with auth context
3. Build `ProtectedRoute` component checking auth state
4. Build `LoginPage` with Google SSO button and error state display
5. Handle redirect from backend after successful auth (Phoenix redirects to `/app`)
6. Implement `logout` function and wire to user bar UI
7. Write frontend tests for login page states and protected route redirect

**Status:** `[x] done`

---

## Phase 3 — Servers and Channels

### 3.1 — Servers backend

**Intent:** Full CRUD for servers with membership, ownership, and invite-based joining.

**Expected Outcomes:**
- `GET /api/servers` — returns servers the current user belongs to
- `POST /api/servers` — creates server, makes creator owner
- `GET /api/servers/:id` — returns server detail (channels, members, roles)
- `PATCH /api/servers/:id` — update name/description/icon (owner/admin)
- `DELETE /api/servers/:id` — delete server (owner only, with confirmation flag)
- `POST /api/servers/join` — join via invite code
- `DELETE /api/servers/:id/members/me` — leave server
- All routes authorize via plug; server membership checked per operation

**Todo List:**
1. Implement `Servers` context: `list_for_user/1`, `create/2`, `get/2`, `update/3`, `delete/2`, `add_member/3`, `remove_member/3`, `transfer_ownership/3`
2. Implement `ServersController` with all listed endpoints
3. Add `ServerMemberPlug` — checks user is member of the requested server
4. Implement icon upload to MinIO via `ExAws.S3` when `icon` field is provided
5. Write tests for each server operation including permission checks

**Status:** `[x] done`

---

### 3.2 — Channels backend

**Intent:** CRUD for channel categories and channels within a server.

**Expected Outcomes:**
- `GET /api/servers/:server_id/channels` — list categories and channels
- `POST /api/servers/:server_id/channels` — create channel (requires `manage_channels` permission)
- `PATCH /api/servers/:server_id/channels/:id` — update channel
- `DELETE /api/servers/:server_id/channels/:id` — delete channel
- Same for categories
- Channel types: `text`, `voice`
- Permission check: reading channels requires membership; managing requires role permission

**Todo List:**
1. Implement `Channels` context: CRUD for categories and channels
2. Implement `ChannelsController`
3. Add permission check plug for `manage_channels` on mutating operations
4. Define permission bitmask constants in a shared module
5. Write tests

**Status:** `[x] done`

---

### 3.3 — Roles and permissions backend

**Intent:** Implement a per-server role system with a bitmask-based permission model.

**Expected Outcomes:**
- Default roles seeded when server is created: Owner (all permissions), Admin, Moderator, Member
- `GET /api/servers/:id/roles` — list roles
- `POST /api/servers/:id/roles` — create role
- `PATCH /api/servers/:id/roles/:role_id` — update role name/permissions
- `DELETE /api/servers/:id/roles/:role_id` — delete role
- `PATCH /api/servers/:id/members/:user_id/role` — assign role to member
- Permission bitmask values documented in code

**Todo List:**
1. Define `Permissions` module with bitmask constants: `MANAGE_SERVER`, `MANAGE_CHANNELS`, `MANAGE_INVITES`, `MANAGE_MEMBERS`, `DELETE_MESSAGES`, `SEND_MESSAGES`, `ATTACH_FILES`, `CONNECT_VOICE`, `SPEAK_VOICE`, `VIDEO`
2. Implement `Roles` context: CRUD + `has_permission?/2`
3. Implement `RolesController`
4. Update `ServerMemberPlug` to attach role and `has_permission?/2` helper to conn
5. Seed default roles in `Servers.create/2`
6. Write tests for permission checks at boundary

**Status:** `[x] done`

---

### 3.4 — Servers and channels frontend

**Intent:** Render real server data in the UI, allowing users to create, switch, and navigate servers and channels.

**Expected Outcomes:**
- Server sidebar shows user's real servers, fetched from API
- "Create Server" modal with name/icon form
- Clicking a server loads its channels in the channel sidebar
- Channel sidebar groups channels by category
- Clicking a text channel navigates to that channel's message view
- Clicking a voice channel shows a join prompt (no audio yet)
- Server settings page (name, icon, delete)
- Invite generation UI (admin/owner)

**Todo List:**
1. Create TanStack Query hooks: `useServers`, `useServer`, `useChannels`
2. Build server list in sidebar using real data
3. Build "Create Server" modal with form validation
4. Build channel sidebar with category groups and channel items
5. Build server settings page (name, description, icon upload)
6. Build invite generation modal with copyable link and expiry options
7. Add join-by-invite route: `/invite/:code` → call join API → redirect to server
8. Write tests for server creation form and navigation

**Status:** `[x] done`

---

## Phase 4 — Real-time Text Messaging

### 4.1 — Phoenix Channels for text messages

**Intent:** Implement bidirectional real-time messaging using Phoenix Channels with full authorization.

**Expected Outcomes:**
- `UserSocket` authenticated via session token passed on connect
- `ChannelChannel` topic: `channel:<channel_id>`
- Events handled: `new_message`, `edit_message`, `delete_message`, `add_reaction`, `remove_reaction`, `typing_start`, `typing_stop`
- Only channel members may join the socket topic — join rejected otherwise
- Messages broadcast to all subscribers instantly

**Todo List:**
1. Configure `UserSocket` to authenticate via token extracted from cookie or param
2. Implement `ChannelChannel` with `join/3` (membership check), `handle_in/3` for each event
3. In `handle_in` for `new_message`: validate payload, persist via `Messaging.create_message/2`, broadcast to topic
4. In `handle_in` for `edit_message`/`delete_message`: verify author or `DELETE_MESSAGES` permission before persisting
5. In `handle_in` for reactions: upsert/delete `message_reactions` record, broadcast
6. Add typing indicator broadcast (ephemeral, not persisted)
7. Write channel tests using `Phoenix.ChannelTest`

**Status:** `[x] done` — `UserSocket` (token+cookie auth), `ChannelChannel` (join/new_message/edit/delete/react/typing/mark_read), `Guilda.Messaging.ReadState`, 13 Phoenix.ChannelTest tests passing.

---

### 4.2 — Messaging REST API (history, pagination)

**Intent:** Provide HTTP endpoints for loading message history so the frontend can paginate backward through conversations.

**Expected Outcomes:**
- `GET /api/channels/:id/messages?before=<id>&limit=50` — returns paginated messages with author info
- `POST /api/channels/:id/messages` — HTTP fallback for sending (WebSocket is primary)
- `GET /api/channels/:id/messages/:msg_id` — single message
- Attachment upload: `POST /api/channels/:id/attachments` — stores file in MinIO, returns URL
- All endpoints require channel membership

**Todo List:**
1. Implement `Messaging` context: `list_messages/2` (keyset pagination), `create_message/2`, `update_message/3`, `delete_message/2`
2. Implement `MessagesController`
3. Add file upload endpoint with MIME type allowlist, size limit (25 MB), virus scan stub
4. Write tests for pagination and permission boundaries

**Status:** `[x] done` — `Guilda.Messaging` context (create/list/edit/soft_delete/reactions/read_state), `MessagesController` (GET+POST /api/channels/:id/messages), 16 ExUnit tests passing.

---

### 4.3 — Frontend messaging UI

**Intent:** Build the full chat experience: virtualized message list, message input, reactions, replies, mentions, unread state.

**Expected Outcomes:**
- Message list loads history on channel open, fetches more when scrolling up
- New messages arrive via WebSocket and are appended instantly
- Message input: plain text, Enter to send, Shift+Enter for newline, paste images
- Edit and delete own messages (inline edit, confirmation for delete)
- Reply to a message (shows quoted preview above input)
- Add/remove emoji reactions
- Mention users with `@` autocomplete
- Unread message indicator per channel (dot + count)
- Loading, empty, error, and reconnecting states
- Optimistic message insert with failure rollback

**Todo List:**
1. Create WebSocket client service using browser `WebSocket` + Phoenix socket.js
2. Create `useChannel` hook: connects to socket topic, handles events, manages message list in Zustand slice
3. Build `MessageList` component with reverse-scroll infinite load using `IntersectionObserver`
4. Build `MessageItem` with avatar, name, timestamp, content, reaction bar, context menu (edit/delete/reply)
5. Build `MessageInput` with textarea, emoji picker (simple), file attachment button
6. Implement optimistic send: append message locally, confirm on ack, rollback on error
7. Implement unread tracking: store last-read message ID per channel, compute unread count
8. Build `TypingIndicator` consuming typing events from socket
9. Write tests for message input and rendering states

**Status:** `[x] done` — `socket.ts` singleton, `messagingStore.ts` (Zustand), `useChannel.ts`, `MessageList`, `MessageItem` (reactions+context menu+inline edit), `MessageInput` (reply/optimistic send), `TypingIndicator`, `ChannelPage` wired up. 29 frontend tests passing.

---

## Phase 5 — Friends and Direct Messages

### 5.1 — Friend system backend

**Intent:** Implement friend requests, acceptance, and real-time status updates.

**Expected Outcomes:**
- `POST /api/friends/requests` — send request (by user ID or username)
- `POST /api/friends/requests/:id/accept` — accept
- `DELETE /api/friends/requests/:id` — decline or cancel
- `GET /api/friends` — list accepted friends with online status
- `DELETE /api/friends/:id` — remove friend
- Friendship events broadcast via user's presence channel

**Todo List:**
1. Implement `Friendships` context: `send_request/2`, `accept/2`, `decline/2`, `remove/2`, `list_friends/1`
2. Implement `FriendsController`
3. Add notifications on friend request received/accepted
4. Write tests

**Status:** `[ ] pending`

---

### 5.2 — Direct messages backend

**Intent:** Private conversations between two users, with persistent history and real-time delivery.

**Expected Outcomes:**
- `POST /api/dm` — open or get existing conversation with a user
- `GET /api/dm` — list user's conversations with last message
- `GET /api/dm/:conversation_id/messages` — paginated history
- Phoenix Channel topic `dm:<conversation_id>` for real-time delivery
- Only conversation participants may access the channel
- Unread count tracked per conversation

**Todo List:**
1. Implement `DirectMessaging` context: `get_or_create_conversation/2`, `list_conversations/1`, `list_messages/2`, `create_message/2`
2. Implement `DmController`
3. Implement `DmChannel` in Phoenix Channels
4. Write tests for access boundaries (user C cannot read conversation between A and B)

**Status:** `[ ] pending`

---

### 5.3 — Presence system

**Intent:** Track real user connectivity (online/away/do-not-disturb/invisible) without trusting frontend-reported state.

**Expected Outcomes:**
- User is considered online when they have an active Phoenix socket connection
- Phoenix Presence tracks connected users with metadata (status)
- Friends receive presence updates in real time
- Invisible mode: user is shown as offline to others but receives events normally

**Todo List:**
1. Configure `Ressonance.Presence` using `Phoenix.Presence`
2. On socket connect: track user in presence with status from `users` table
3. Expose `GET /api/users/:id/presence` for polling fallback
4. Broadcast `presence_diff` events to friends' channels
5. Write tests for presence tracking and invisible mode

**Status:** `[ ] pending`

---

### 5.4 — DM and friends frontend

**Intent:** Build the DM section of the app with friend list, conversation list, and real-time messaging.

**Expected Outcomes:**
- DM view accessible from left sidebar (person icon)
- Friend list tab: pending requests (with accept/decline), accepted friends with presence indicators
- Conversation list shows recent DMs with unread dots
- Clicking a conversation opens the same `MessageList` + `MessageInput` components reused from channels
- Send friend request by searching username
- Notification badge on DM icon when unread DMs exist

**Todo List:**
1. Create hooks: `useFriends`, `useConversations`, `useDmChannel`
2. Build `FriendsPage` with tabs: Online, All, Pending, Add Friend
3. Build `DmSidebar` with conversation list
4. Reuse `MessageList` and `MessageInput` for DM view
5. Wire presence indicators to friend list items
6. Write tests

**Status:** `[ ] pending`

---

## Phase 6 — Voice and Video

### 6.1 — LiveKit infrastructure

**Intent:** Add the self-hosted LiveKit server to Podman Compose and document its configuration.

**Expected Outcomes:**
- `livekit` service added to `compose.yaml`
- `infra/livekit/livekit.yaml` configuration file
- LIVEKIT_API_KEY and LIVEKIT_API_SECRET in `.env.example`
- `docs/livekit-setup.md` explains local vs production configuration and STUN/TURN requirements

**Todo List:**
1. Add `livekit/livekit-server` to `compose.yaml` with proper port exposure (7880 WebRTC, 7881 HTTP)
2. Write `infra/livekit/livekit.yaml` with development configuration
3. Update `.env.example` with LiveKit variables
4. Write `docs/livekit-setup.md` covering local setup, HTTPS requirement for production, STUN/TURN config

**Status:** `[ ] pending`

---

### 6.2 — Voice channel backend (LiveKit token issuance)

**Intent:** Phoenix backend controls authorization for voice rooms and issues short-lived LiveKit access tokens.

**Expected Outcomes:**
- `POST /api/channels/:id/voice/token` — returns a LiveKit room token for authorized users
- Backend verifies: user is member of server, has `CONNECT_VOICE` permission
- Token grants publish (if `SPEAK_VOICE`) and subscribe permissions
- Voice channel participant list tracked via Phoenix Channel events (not LiveKit state)
- `POST /api/channels/:id/voice/leave` — explicit leave event

**Todo List:**
1. Add `livekit_ex` or manual JWT generation library to `mix.exs`
2. Implement `Voice` context: `issue_token/3` (user, channel, permissions)
3. Implement `VoiceController` with token endpoint
4. Add `voice_join` / `voice_leave` events to `ChannelChannel` for participant list tracking
5. Write tests for token issuance and permission checks

**Status:** `[ ] pending`

---

### 6.3 — Voice and video frontend

**Intent:** Build the voice channel UI using the LiveKit JavaScript client SDK with all required controls.

**Expected Outcomes:**
- Clicking a voice channel joins the room (requests mic permission, fetches token, connects to LiveKit)
- Participant list shows who is connected with speaking indicator
- Mute/unmute own microphone
- Deafen (stop receiving audio)
- Device selection (mic, speakers)
- Individual volume control per participant
- Disconnect button
- Video toggle and screen share (requires `VIDEO` permission)
- Reconnection handling
- Visual indicator when another participant is speaking
- The feature is only reported done after testing between two real devices

**Todo List:**
1. Install `@livekit/client` SDK
2. Create `useVoiceChannel` hook: fetch token, connect to LiveKit room, manage participant state
3. Build `VoiceChannelPanel` replacing main area when voice channel is active
4. Build `ParticipantTile` with avatar, name, speaking ring, mute/volume controls
5. Build `VoiceControls` bar: mute, deafen, video, screen share, disconnect, device picker
6. Implement reconnection: LiveKit SDK handles transport reconnect; display reconnecting state
7. Add browser permission handling (mic/camera blocked state with helpful message)
8. Write integration notes in `docs/voice-video.md`
9. Test between two browser sessions before marking complete

**Status:** `[ ] pending`

---

## Phase 7 — Finalization

### 7.1 — Automated tests completion

**Intent:** Ensure all major flows have test coverage before calling the project production-ready.

**Expected Outcomes:**
- Backend: ExUnit tests for all contexts and channels covering happy and error paths
- Frontend: Vitest + React Testing Library tests for auth states, forms, routing
- E2E: Playwright tests for: two-user messaging, unauthorized access attempt, invite flow, reconnect, voice join/leave

**Todo List:**
1. Audit existing test coverage; list gaps
2. Write missing backend unit and integration tests
3. Write missing frontend component tests
4. Write Playwright E2E test suite with test user seeding
5. Add `mix test` and `npm test` to CI-ready scripts in `Makefile` or `package.json`

**Status:** `[ ] pending`

---

### 7.2 — Security review

**Intent:** Audit the application against the security requirements before exposing it to friends.

**Expected Outcomes:**
- IDOR checks: every resource access validates the requesting user's membership/ownership
- Input validation on all API endpoints using Ecto changesets
- File upload MIME validation and size limits enforced
- Rate limiting verified on sensitive endpoints
- CORS policy verified — only allow app origin
- CSRF protection verified on non-GET endpoints
- Secrets confirmed absent from code and logs
- Admin log entries written for critical actions

**Todo List:**
1. Audit every controller action for missing authorization plug
2. Audit all Ecto changesets for missing validations
3. Verify rate limiting configuration
4. Verify CORS and CSRF settings
5. Review logs for accidental credential exposure
6. Verify file upload validation
7. Write a short `docs/security.md` summarizing what protections are in place

**Status:** `[ ] pending`

---

### 7.3 — UI polish and error handling

**Intent:** Ensure the application feels complete: all loading states, empty states, errors, and edge cases handled gracefully.

**Expected Outcomes:**
- Every data-fetching operation has loading, error, and empty states
- Toast notifications for actions (server created, message failed, invite copied)
- Reconnecting state shown in message area when WebSocket drops
- Keyboard navigation: Tab, Escape, Enter work in all modals and menus
- Responsive layout tested on desktop (1440px), tablet (768px), mobile (375px)
- Light theme toggle functional

**Todo List:**
1. Audit every page for missing loading/error/empty states
2. Add toast system (Radix Toast or similar)
3. Implement WebSocket reconnection banner in chat area
4. Keyboard accessibility pass on all modals and interactive components
5. Responsive layout QA and fixes
6. Implement light/dark theme toggle with CSS variables

**Status:** `[ ] pending`

---

### 7.4 — Admin panel

**Intent:** Build the admin interface for user management, invite management, and audit log viewing.

**Expected Outcomes:**
- `/admin` route protected by admin role check
- User list with approve/revoke access actions
- Active invite list with revoke action
- Server list with member count
- Admin log table with pagination
- Session revocation: admin can invalidate all sessions for a user

**Todo List:**
1. Build `AdminLayout` and routing under `/admin`
2. Build `UsersTable` with approve/revoke actions
3. Build `InvitesTable` with revoke action
4. Build `ServersTable`
5. Build `AdminLogTable` with pagination
6. Add `DELETE /api/admin/users/:id/sessions` endpoint for session revocation
7. Write tests for admin-only route protection

**Status:** `[ ] pending`

---

### 7.5 — Documentation and deployment preparation

**Intent:** Ensure another person can install, configure, and run the project by following the README alone.

**Expected Outcomes:**
- `README.md` contains: prerequisites, step-by-step local setup, environment variable reference, how to create the first admin, how to run tests
- `docs/` contains: `google-oauth-setup.md`, `livekit-setup.md`, `security.md`, `voice-video.md`, `deployment.md` (stub for future hosting)
- `compose.yaml` has a production-ready variant stub (without Vite dev server)
- Backup instructions for PostgreSQL volume in `docs/deployment.md`

**Todo List:**
1. Finalize `README.md` with complete setup instructions
2. Write `docs/deployment.md` stub covering: what to change for production (HTTPS, env vars, MinIO → S3, LiveKit TURN)
3. Add database backup section to `docs/deployment.md`
4. Final pass: confirm `podman compose up` from a clean state reaches a working app

**Status:** `[ ] pending`

---

## Data Model Summary

| Table | Key Columns |
|---|---|
| users | id, email, google_sub, display_name, avatar_url, status, role |
| sessions | id, user_id, token_hash, expires_at |
| servers | id, name, owner_id, icon_url |
| roles | id, server_id, name, permissions (bitmask) |
| server_members | server_id, user_id, role_id |
| channel_categories | id, server_id, name, position |
| channels | id, server_id, category_id, name, type, position |
| messages | id, channel_id, author_id, content, reply_to_id |
| message_reactions | id, message_id, user_id, emoji |
| message_attachments | id, message_id, url, filename, size |
| direct_conversations | id |
| direct_conversation_members | conversation_id, user_id |
| direct_messages | id, conversation_id, author_id, content |
| friendships | id, requester_id, addressee_id, status |
| invites | id, server_id, created_by, code, max_uses, uses, expires_at |
| notifications | id, user_id, type, data (jsonb), read_at |
| admin_logs | id, actor_id, action, target_type, target_id, metadata (jsonb) |

## Permission Bitmask Constants

| Permission | Bit |
|---|---|
| MANAGE_SERVER | 1 |
| MANAGE_CHANNELS | 2 |
| MANAGE_INVITES | 4 |
| MANAGE_MEMBERS | 8 |
| DELETE_MESSAGES | 16 |
| SEND_MESSAGES | 32 |
| ATTACH_FILES | 64 |
| CONNECT_VOICE | 128 |
| SPEAK_VOICE | 256 |
| VIDEO | 512 |
