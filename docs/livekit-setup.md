# Configuração do LiveKit (Canais de Voz e Vídeo)

O Guilda utiliza o [LiveKit](https://livekit.io/) como servidor SFU (Selective Forwarding Unit) WebRTC open-source para transmissão de áudio, vídeo e compartilhamento de tela com baixa latência.

---

## 1. Arquitetura Local (Podman / Docker)

O LiveKit roda como um serviço conteinerizado no `compose.yaml`:

```yaml
livekit:
  image: docker.io/livekit/livekit-server:latest
  command: --config /etc/livekit.yaml
  ports:
    - "7880:7880"         # WebSocket / HTTP API
    - "7881:7881"         # WebRTC TCP fallback
    - "50000-50020:50000-50020/udp" # WebRTC UDP Media Ports
  volumes:
    - ./infra/livekit.yaml:/etc/livekit.yaml:ro
```

---

## 2. Configuração de Variáveis de Ambiente

No `.env`:

```bash
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secretsecretsecretsecretsecretsecret
```

---

## 3. Fluxo de Conexão em Canais de Voz

1. **Entrada no Canal:** O usuário clica em um canal do tipo `voice` no Discord/Guilda.
2. **Geração do Token:** O frontend faz requisição `POST /api/channels/:id/voice/token` para o backend Phoenix.
3. **Validação:** O backend valida permissões do usuário no servidor e gera um JWT assinado com `LIVEKIT_API_SECRET` contendo as claims da sala (`room: channel_id`, identidade do usuário, permissões de publicação de áudio/vídeo).
4. **Conexão WebRTC:** O frontend inicializa `livekit-client` (`Room.connect(url, token)`), conectando microfone, câmera ou compartilhamento de tela.
5. **Presence & Mute State:** Estados de fala (speaking indicator), microfone mutado e ensurdecimento são sincronizados em tempo real via Phoenix Channel e LiveKit track events.

---

## 4. Requisitos para Produção (TURN / STUN)

Em ambiente de produção atrás de NAT restritivo ou firewall corporativo:
- É necessário configurar um servidor **STUN/TURN** (como coturn ou o serviço TURN do próprio LiveKit Cloud).
- Abrir a faixa de portas UDP (padrão: `50000-60000/udp`) no firewall/security group do provedor de nuvem.
