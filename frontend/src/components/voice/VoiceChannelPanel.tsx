import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Headphones,
  Video,
  VideoOff,
  ScreenShare,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Tv,
  PencilLine,
  Scaling,
  Cast,
  Menu,
  Users,
} from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'
import * as Popover from '@radix-ui/react-popover'
import { useVoice } from '@/hooks/useVoice'
import { usePresence } from '@/hooks/usePresence'
import { useServerDetail } from '@/hooks/useServers'
import { useUIStore } from '@/stores/uiStore'
import { useVoiceStore } from '@/stores/voiceStore'
import { ParticipantTile } from '@/components/voice/ParticipantTile'
import { ScreenShareAnnotation } from '@/components/voice/ScreenShareAnnotation'

interface Props {
  channelId: string
  serverId: string
  channelName: string
}

export function VoiceChannelPanel({ channelId, serverId, channelName }: Props) {
  const {
    activeChannelId,
    isConnected,
    isConnecting,
    participants,
    error,
    currentRoom,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    isMuted,
    isDeafened,
    isVideoEnabled,
    isScreenSharing,
  } = useVoice()

  const { getUsersInVoiceChannel, onlineUsers } = usePresence()
  const { data: serverDetail } = useServerDetail(serverId)
  const connectedPresenceUsers = getUsersInVoiceChannel(channelId)

  const membersMap = useMemo(() => {
    const map: Record<string, { displayName: string; avatarUrl: string | null }> = {}
    if (serverDetail?.members) {
      serverDetail.members.forEach((m) => {
        if (m.userId) {
          map[m.userId.toLowerCase()] = {
            displayName: m.displayName,
            avatarUrl: m.avatarUrl,
          }
        }
      })
    }
    return map
  }, [serverDetail?.members])

  const inThisChannel = activeChannelId === channelId && (isConnected || isConnecting)

  // In-app fullscreen theater mode & layout options
  const [isInAppFullscreen, setIsInAppFullscreen] = useState(false)
  const [screenFocusMode, setScreenFocusMode] = useState<'exclusive' | 'stage'>('exclusive')
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain')
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [streamVolume, setStreamVolume] = useState(100)

  // Multi-stream focus selection
  const [selectedSharerId, setSelectedSharerId] = useState<string | null>(null)

  // A live clicked in the sidebar ("AO VIVO"): focus it once, then clear the request.
  const focusSharerId = useVoiceStore((s) => s.focusSharerId)
  const setFocusSharer = useVoiceStore((s) => s.setFocusSharer)

  const panelRef = useRef<HTMLDivElement>(null)

  const allScreenSharers = participants.filter((p) => p.screenTrack)

  useEffect(() => {
    if (!focusSharerId) return
    // Wait until the stream has arrived; if the sharer stopped, drop the request.
    if (participants.some((p) => p.identity === focusSharerId && p.screenTrack)) {
      setSelectedSharerId(focusSharerId)
      setFocusSharer(null)
    } else if (inThisChannel && isConnected && !participants.some((p) => p.identity === focusSharerId)) {
      setFocusSharer(null)
    }
  }, [focusSharerId, participants, inThisChannel, isConnected, setFocusSharer])

  // Determine active focused screen sharer
  const activeSharer =
    allScreenSharers.find((p) => p.identity === selectedSharerId) ||
    allScreenSharers[0] ||
    null

  function handleStreamVolumeChange(val: number) {
    setStreamVolume(val)
    if (!activeSharer) return
    const audioEl = document.querySelector(
      `audio[data-participant-id="${activeSharer.identity}"][data-track-source="screen_share_audio"]`
    ) as HTMLAudioElement
    if (audioEl) {
      audioEl.volume = Math.min(Math.max(val / 100, 0), 1)
    } else {
      const elements = document.querySelectorAll(`audio[data-track-source="screen_share_audio"]`)
      elements.forEach((el) => {
        ;(el as HTMLAudioElement).volume = Math.min(Math.max(val / 100, 0), 1)
      })
    }
  }

  // Handle ESC key to exit in-app fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInAppFullscreen) {
        setIsInAppFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isInAppFullscreen])

  return (
    <div
      ref={panelRef}
      className={`flex flex-col select-none transition-all duration-150 ${
        isInAppFullscreen
          ? 'fixed inset-0 z-50 bg-[#111214]'
          : 'h-full overflow-hidden'
      }`}
      style={{ background: isInAppFullscreen ? '#111214' : 'var(--color-bg-tertiary)' }}
    >
      {/* Top Header */}
      <header
        className="h-12 px-3 sm:px-4 flex items-center justify-between border-b shrink-0 shadow-sm z-30 bg-[#2b2d31]"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            onClick={useUIStore.getState().openMobileNav}
            className="p-1 -ml-1 text-[#949ba4] hover:text-[#f2f3f5] md:hidden cursor-pointer shrink-0"
            title="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <Volume2 size={20} className="text-[#23a55a] shrink-0" />
          <span className="font-semibold text-sm shrink-0 text-[#f2f3f5]">
            {channelName}
          </span>
          {inThisChannel && (
            <span
              className="ml-1 px-2 py-0.5 rounded text-[11px] font-bold shrink-0"
              style={{ background: 'var(--color-online)', color: '#fff' }}
            >
              {isConnecting ? 'Conectando...' : 'Conectado'}
            </span>
          )}

          {/* Single Stream or Multi-Stream Selector */}
          {allScreenSharers.length === 1 && activeSharer && (
            <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-bold bg-[#f23f43] text-white flex items-center gap-1 animate-pulse shrink-0">
              <Tv size={12} /> AO VIVO: {activeSharer.name}
            </span>
          )}

          {allScreenSharers.length > 1 && (
            <div className="flex items-center gap-1 ml-2 bg-[#1e1f22] p-0.5 rounded-lg border border-[#2b2d31] shrink-0">
              <span className="text-[10px] font-bold text-[#949ba4] px-1.5 uppercase">Lives:</span>
              {allScreenSharers.map((s) => {
                const isSelected = activeSharer?.identity === s.identity
                return (
                  <button
                    key={s.identity}
                    type="button"
                    onClick={() => setSelectedSharerId(s.identity)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#5865f2] text-white shadow'
                        : 'text-[#949ba4] hover:text-[#f2f3f5] hover:bg-[#2b2d31]'
                    }`}
                    title={`Trocar foco para a transmissão de ${s.name}`}
                  >
                    <Tv size={11} className={isSelected ? 'text-[#f23f43]' : ''} />
                    <span className="truncate max-w-[90px]">{s.name}</span>
                    {isSelected && <span className="text-[10px] font-normal opacity-80">(Foco)</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={useUIStore.getState().toggleMobileMembers}
            className="p-1 text-[#949ba4] hover:text-[#f2f3f5] md:hidden cursor-pointer"
            title="Membros"
          >
            <Users size={20} />
          </button>
          {inThisChannel && activeSharer && (
            <>
              {/* Toggle Exclusive vs Stage View */}
              <button
                type="button"
                onClick={() =>
                  setScreenFocusMode(screenFocusMode === 'exclusive' ? 'stage' : 'exclusive')
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
                title={
                  screenFocusMode === 'exclusive'
                    ? 'Mostrar miniaturas dos outros participantes'
                    : 'Modo Foco Total (Apenas a Live)'
                }
              >
                {screenFocusMode === 'exclusive' ? <LayoutGrid size={14} /> : <Tv size={14} />}
                <span className="hidden sm:inline">
                  {screenFocusMode === 'exclusive' ? 'Exibir Outros' : 'Foco na Live'}
                </span>
              </button>

              {/* Stream Volume Popover (for viewers) */}
              {!activeSharer.isLocal && (
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
                      title="Volume do Áudio da Transmissão"
                    >
                      {streamVolume === 0 ? (
                        <VolumeX size={14} className="text-[#f23f43]" />
                      ) : (
                        <Volume2 size={14} />
                      )}
                      <span className="hidden sm:inline">Som da Live ({streamVolume}%)</span>
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      side="bottom"
                      align="end"
                      className="w-52 bg-[#1e1f22] border border-[#2b2d31] p-3 rounded-lg shadow-xl text-xs space-y-2 z-50 text-[#dbdee1]"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1 text-[#f2f3f5]">
                          <Volume2 size={14} className="text-[#5865f2]" /> Som da Transmissão ({activeSharer.name})
                        </span>
                        <span className="text-[11px] text-[#949ba4] font-mono">{streamVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={streamVolume}
                        onChange={(e) => handleStreamVolumeChange(Number(e.target.value))}
                        className="w-full accent-[#5865f2] cursor-pointer"
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              )}

              {/* Fit / Fill toggle button */}
              <button
                type="button"
                onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
                title={
                  fitMode === 'contain'
                    ? 'Preencher tela (Pode cortar bordas)'
                    : 'Ajustar à tela (Ver imagem inteira)'
                }
              >
                <Scaling size={14} />
                <span className="hidden sm:inline">
                  {fitMode === 'contain' ? 'Ajustar' : 'Preencher'}
                </span>
              </button>

              {/* Toggle Screen Annotations Toolbar */}
              <button
                type="button"
                onClick={() => setShowAnnotations(!showAnnotations)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  showAnnotations
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'
                }`}
                title="Ativar/Desativar riscos na live (Atalhos: Ctrl+P / Ctrl+L)"
              >
                <PencilLine size={14} />
                <span className="hidden sm:inline">Riscar (Ctrl+P)</span>
              </button>

              {/* In-App Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => setIsInAppFullscreen(!isInAppFullscreen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
                title={isInAppFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia no Dissonance'}
              >
                {isInAppFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span className="hidden sm:inline">
                  {isInAppFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                </span>
              </button>
            </>
          )}

          {!inThisChannel ? (
            <button
              onClick={() => joinVoice(channelId, serverId, channelName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: 'var(--color-online)', color: '#fff' }}
            >
              <PhoneCall size={14} />
              Entrar na Voz
            </button>
          ) : (
            <button
              onClick={leaveVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: 'var(--color-danger)', color: '#fff' }}
            >
              <PhoneOff size={14} />
              Desconectar
            </button>
          )}
        </div>
      </header>

      {/* Main Stage View */}
      <div className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col items-center justify-center relative min-h-0">
        {error && (
          <div
            className="mb-4 px-4 py-2 rounded-lg text-xs font-semibold z-20"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}
          >
            {error}
          </div>
        )}

        {inThisChannel ? (
          <div className="w-full h-full flex flex-col justify-center min-h-0">
            {activeSharer ? (
              <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 h-full w-full">
                {/* Spotlight Screen Share with Slack-style Annotation Overlay */}
                <div className="flex-1 rounded-2xl overflow-hidden bg-black flex items-center justify-center relative min-h-0 h-full w-full shadow-2xl border border-[#1f2023] group">
                  <div className="w-full h-full flex-1 flex items-center justify-center relative">
                    <ParticipantTile
                      key={`spotlight-${activeSharer.identity}`}
                      participant={activeSharer}
                      isSpotlight={true}
                      fitMode={fitMode}
                    />

                    {/* Live Screen Annotation Canvas */}
                    {showAnnotations && (
                      <ScreenShareAnnotation
                        key={`annotation-${activeSharer.identity}`}
                        room={currentRoom}
                        enabled={showAnnotations}
                        isSharer={activeSharer.isLocal}
                        targetSharerId={activeSharer.identity}
                      />
                    )}
                  </div>
                </div>

                {/* Thumbnails Strip (shown if not in exclusive mode) */}
                {screenFocusMode === 'stage' && (
                  <div className="lg:w-60 flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto shrink-0 max-h-[160px] lg:max-h-full py-1">
                    {participants
                      .filter((p) => p.identity !== activeSharer.identity)
                      .map((p) => (
                        <div
                          key={p.identity}
                          onClick={() => {
                            if (p.screenTrack) {
                              setSelectedSharerId(p.identity)
                            }
                          }}
                          className={`w-44 lg:w-full shrink-0 aspect-video relative rounded-xl overflow-hidden transition-all ${
                            p.screenTrack
                              ? 'cursor-pointer ring-2 ring-[#5865f2] hover:scale-[1.02]'
                              : ''
                          }`}
                        >
                          <ParticipantTile participant={p} />
                          {p.screenTrack && (
                            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-bold bg-[#f23f43] text-white flex items-center gap-1 shadow">
                              <Cast size={10} /> Live: Clique p/ Focar
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`w-full h-full max-w-6xl mx-auto flex items-center justify-center p-2`}
              >
                <div
                  className={`w-full grid gap-3 max-h-full overflow-y-auto ${
                    participants.length <= 1
                      ? 'grid-cols-1 max-w-xl mx-auto'
                      : participants.length === 2
                      ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
                      : participants.length <= 4
                      ? 'grid-cols-2 max-w-4xl mx-auto'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}
                >
                  {participants.map((p) => {
                    const idLower = p.identity.toLowerCase()
                    const member = membersMap[idLower]
                    const presenceInfo = onlineUsers[idLower] || onlineUsers[p.identity]
                    const displayName = member?.displayName || presenceInfo?.displayName || p.name
                    const avatarUrl = member?.avatarUrl ?? presenceInfo?.avatarUrl ?? null

                    return (
                      <ParticipantTile
                        key={p.identity}
                        participant={p}
                        displayName={displayName}
                        avatarUrl={avatarUrl}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4 max-w-md w-full p-8 rounded-2xl bg-[#2b2d31] border border-[#1f2023] shadow-xl">
            {connectedPresenceUsers.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center -space-x-3 overflow-hidden py-1">
                  {connectedPresenceUsers.map((u) => {
                    const member = membersMap[u.userId.toLowerCase()]
                    const displayName = member?.displayName || u.displayName || 'Usuário'
                    const avatarUrl = member?.avatarUrl ?? u.avatarUrl

                    return (
                      <Avatar.Root
                        key={u.userId}
                        className="w-14 h-14 rounded-full border-4 border-[#2b2d31] overflow-hidden bg-[#1e1f22] shadow"
                      >
                        <Avatar.Image
                          src={avatarUrl ?? undefined}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                        <Avatar.Fallback className="w-full h-full flex items-center justify-center font-bold text-white bg-[#5865f2] text-lg">
                          {displayName[0]?.toUpperCase() ?? '?'}
                        </Avatar.Fallback>
                      </Avatar.Root>
                    )
                  })}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#f2f3f5]">{channelName}</h3>
                  <p className="text-xs text-[#949ba4] mt-1">
                    {connectedPresenceUsers.length === 1
                      ? `${connectedPresenceUsers[0].displayName || '1 usuário'} está conectado nesta sala de voz.`
                      : `${connectedPresenceUsers.length} usuários conectados nesta sala de voz.`}
                  </p>
                </div>

                <button
                  onClick={() => joinVoice(channelId, serverId, channelName)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold bg-[#23a55a] hover:bg-[#1f914f] text-white transition-all transform hover:scale-[1.02] cursor-pointer shadow-lg"
                >
                  <PhoneCall size={18} />
                  <span>Entrar na Sala de Voz</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Volume2 size={48} className="mx-auto opacity-50 text-[#949ba4]" />
                <h3 className="text-base font-bold text-[#f2f3f5]">{channelName}</h3>
                <p className="text-xs max-w-xs mx-auto text-[#949ba4]">
                  Ninguém está conectado nesta sala de voz no momento. Clique abaixo para iniciar a conversa.
                </p>
                <button
                  onClick={() => joinVoice(channelId, serverId, channelName)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-[#23a55a] hover:bg-[#1f914f] text-white transition-all transform hover:scale-[1.02] cursor-pointer shadow"
                >
                  <PhoneCall size={16} />
                  <span>Conectar à Voz</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar when in channel */}
      {inThisChannel && (
        <div
          className="p-3.5 flex items-center justify-center gap-3 border-t shrink-0 z-30"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <button
            onClick={toggleMute}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow cursor-pointer"
            style={{
              background: isMuted ? 'var(--color-danger)' : 'var(--color-bg-primary)',
              color: isMuted ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleDeafen}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow cursor-pointer"
            style={{
              background: isDeafened ? 'var(--color-danger)' : 'var(--color-bg-primary)',
              color: isDeafened ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isDeafened ? 'Ativar Áudio' : 'Desativar Áudio'}
          >
            <Headphones size={20} />
          </button>

          <button
            onClick={toggleVideo}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow cursor-pointer"
            style={{
              background: isVideoEnabled ? 'var(--color-online)' : 'var(--color-bg-primary)',
              color: isVideoEnabled ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isVideoEnabled ? 'Desligar Câmera' : 'Ligar Câmera'}
          >
            {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={toggleScreenShare}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow cursor-pointer"
            style={{
              background: isScreenSharing ? 'var(--color-danger)' : 'var(--color-bg-primary)',
              color: isScreenSharing ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
          >
            <ScreenShare size={20} />
          </button>

          <button
            onClick={leaveVoice}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow cursor-pointer"
            style={{
              background: 'var(--color-danger)',
              color: '#fff',
            }}
            title="Desconectar"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
