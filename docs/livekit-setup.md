# LiveKit Setup

> **Note:** LiveKit is added to the project in Phase 6 (Voice and Video). This document is a stub — it will be expanded when Phase 6 begins.

---

## What is LiveKit?

[LiveKit](https://livekit.io/) is an open-source WebRTC infrastructure platform. Guilda uses a self-hosted LiveKit server to manage voice and video rooms, participants, and media transport — avoiding the need to build a custom SFU (Selective Forwarding Unit).

---

## Architecture Overview

```
Browser ──WebRTC──► LiveKit Server (Docker)
              ▲
              │ token
              │
           Phoenix Backend
```

- The **Phoenix backend** issues short-lived JWT access tokens for rooms.
- The **browser** uses the LiveKit JS SDK to connect to the LiveKit server directly.
- **WebSocket** (Phoenix Channels) handles signalling and participant presence events in Guilda's UI.
- **Media** (audio/video) is transported directly between the browser and LiveKit over WebRTC — not through Phoenix.

---

## Requirements for Voice/Video

- **HTTPS in production:** WebRTC requires a secure context. Browsers will refuse microphone/camera access on non-HTTPS pages (except `localhost`).
- **STUN server:** Required for NAT traversal. LiveKit defaults to using Google's public STUN server (`stun.l.google.com:19302`) in development.
- **TURN server:** Required when STUN is insufficient (e.g., symmetric NAT). For production deployment behind a firewall, configure a TURN server (e.g., [coturn](https://github.com/coturn/coturn)) in LiveKit's configuration.

---

## Local Development Configuration

When Phase 6 is implemented, a `livekit` service will be added to `compose.yaml` and configured at `infra/livekit/livekit.yaml`.

Environment variables to be added to `.env.example`:

```dotenv
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret_change_in_production
```

---

## Useful Resources

- [LiveKit documentation](https://docs.livekit.io/)
- [LiveKit self-hosting guide](https://docs.livekit.io/home/self-hosting/local/)
- [LiveKit JavaScript SDK](https://github.com/livekit/client-sdk-js)
- [coturn TURN server](https://github.com/coturn/coturn)
