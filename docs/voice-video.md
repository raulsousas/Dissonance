# Voice and Video Architecture

> **Note:** Voice and video (Phase 6) are not yet implemented. This document describes the planned architecture.

---

## Approach

Guilda uses [LiveKit](https://livekit.io/) as the self-hosted WebRTC infrastructure. This avoids implementing a custom SFU from scratch while keeping the infrastructure under your control.

- **Media transport:** WebRTC, managed by LiveKit.
- **Signalling and room events:** Phoenix Channels (WebSocket) for participant join/leave events visible in the UI.
- **Authorization:** Phoenix backend issues short-lived LiveKit JWT tokens. Only users with the `CONNECT_VOICE` permission for a given channel may obtain a token.

## What is NOT used for media

Phoenix Channels and WebSocket messages are used for signalling (participant lists, mute events, etc.) — **not** for carrying audio or video data. All media bytes go directly from browser to LiveKit via WebRTC.

## Planned Features

- Join/leave voice channels
- Participant list with speaking indicators
- Mute/unmute microphone
- Deafen (stop receiving audio)
- Per-participant volume control
- Device selection (microphone, speakers)
- Video toggle
- Screen sharing (requires `VIDEO` permission)
- Reconnection handling

## Browser Requirements

- HTTPS in production (mandatory for microphone/camera access)
- Permission prompt: browser will ask for microphone (and camera for video)
- Modern browser with WebRTC support (all current browsers qualify)

## Testing

Voice and video will only be marked as complete after successful testing between two real devices on separate networks.
