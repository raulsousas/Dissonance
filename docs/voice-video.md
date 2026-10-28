# Arquitetura de Canais de Voz e Vídeo (WebRTC + LiveKit)

Este documento descreve como o áudio, vídeo, compartilhamento de tela e controles de voz funcionam no Guilda.

---

## 1. Visão Geral da Arquitetura

O Guilda adota um modelo híbrido:
1. **Sinalização e Metadados:** Trafegam via Phoenix Channels (`ChannelChannel` e `UserSocket`) para sincronizar a lista de membros conectados na sala, status de microfone (mutado/desmutado), ensurdecimento e permissões.
2. **Mídia de Alta Performance (SFU):** Trafega diretamente entre o navegador do usuário e o servidor LiveKit via WebRTC (UDP).

```
   [ Usuário A ] ── WebRTC (Opus/VP8/H.264) ──► [ LiveKit SFU ] ── WebRTC ──► [ Usuário B ]
         │                                                                            ▲
         │                                                                            │
         └──── Phoenix Channels (Presença, Mute, Volume, Ações) ──────────────────────┘
```

---

## 2. Controles de Áudio do Usuário

Na barra inferior (`UserBar.tsx` e `VoiceControlsBar.tsx`):
- **Mutar / Desmutar Microfone:** Controla localmente a track de microfone (`audioTrack.mute() / unmute()`) e emite o evento para os demais membros.
- **Ensurdecer (Deafen):** Muta o microfone e suspende o áudio recebido de todos os outros participantes.
- **Indicador de Fala (Green Ring):** O LiveKit emite eventos de `activeSpeakerObserver` com medição de decibéis em tempo real, acionando o anel verde luminoso ao redor do avatar do participante que está falando.

---

## 3. Compartilhamento de Tela e Câmera

- O botão de vídeo ativa a captura de `navigator.mediaDevices.getUserMedia({ video: true })` e publica a faixa de vídeo para o LiveKit.
- O botão de compartilhamento de tela ativa `navigator.mediaDevices.getDisplayMedia()` e transmite o stream com resolução adaptativa e áudio do sistema operacional compartilhado.
