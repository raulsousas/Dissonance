import { Volume2, PhoneCall, PhoneOff, Mic, MicOff, Headphones, Video, VideoOff, ScreenShare } from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'
import { useVoice } from '@/hooks/useVoice'
import { usePresence } from '@/hooks/usePresence'
import { ParticipantTile } from '@/components/voice/ParticipantTile'

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

  const { getUsersInVoiceChannel } = usePresence()
  const connectedPresenceUsers = getUsersInVoiceChannel(channelId)

  const inThisChannel = activeChannelId === channelId && (isConnected || isConnecting)


  return (
    <div className="flex flex-col h-full overflow-hidden select-none" style={{ background: 'var(--color-bg-tertiary)' }}>
      {/* Top Header */}
      <header
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 shadow-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
      >
        <div className="flex items-center gap-2">
          <Volume2 size={20} style={{ color: 'var(--color-text-muted)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {channelName}
          </span>
          {inThisChannel && (
            <span
              className="ml-2 px-2 py-0.5 rounded text-[11px] font-bold"
              style={{ background: 'var(--color-online)', color: '#fff' }}
            >
              {isConnecting ? 'Connecting...' : 'Connected'}
            </span>
          )}
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2">
          {!inThisChannel ? (
            <button
              onClick={() => joinVoice(channelId, serverId, channelName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-online)', color: '#fff' }}
            >
              <PhoneCall size={14} />
              Join Voice
            </button>
          ) : (
            <button
              onClick={leaveVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-danger)', color: '#fff' }}
            >
              <PhoneOff size={14} />
              Disconnect
            </button>
          )}
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
        {error && (
          <div
            className="mb-4 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}
          >
            {error}
          </div>
        )}

        {inThisChannel ? (
          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {participants.map((p) => (
              <ParticipantTile key={p.identity} participant={p} />
            ))}
          </div>
        ) : (
          <div className="text-center space-y-4 max-w-md w-full p-8 rounded-2xl bg-[#2b2d31] border border-[#1f2023] shadow-xl">
            {connectedPresenceUsers.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center -space-x-3 overflow-hidden py-1">
                  {connectedPresenceUsers.map((u) => (
                    <Avatar.Root
                      key={u.userId}
                      className="w-14 h-14 rounded-full border-4 border-[#2b2d31] overflow-hidden bg-[#1e1f22] shadow"
                    >
                      <Avatar.Image
                        src={u.avatarUrl ?? undefined}
                        alt={u.displayName}
                        className="w-full h-full object-cover"
                      />
                      <Avatar.Fallback className="w-full h-full flex items-center justify-center font-bold text-white bg-[#5865f2] text-lg">
                        {u.displayName?.[0]?.toUpperCase() ?? '?'}
                      </Avatar.Fallback>
                    </Avatar.Root>
                  ))}
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
                <h3 className="text-base font-bold text-[#f2f3f5]">
                  {channelName}
                </h3>
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
        <div className="p-4 flex items-center justify-center gap-3 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <button
            onClick={toggleMute}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow"
            style={{
              background: isMuted ? 'var(--color-danger)' : 'var(--color-bg-primary)',
              color: isMuted ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleDeafen}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow"
            style={{
              background: isDeafened ? 'var(--color-danger)' : 'var(--color-bg-primary)',
              color: isDeafened ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <Headphones size={20} />
          </button>

          <button
            onClick={toggleVideo}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow"
            style={{
              background: isVideoEnabled ? 'var(--color-online)' : 'var(--color-bg-primary)',
              color: isVideoEnabled ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={toggleScreenShare}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow"
            style={{
              background: isScreenSharing ? 'var(--color-online)' : 'var(--color-bg-primary)',
              color: isScreenSharing ? '#fff' : 'var(--color-text-primary)',
            }}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <ScreenShare size={20} />
          </button>

          <button
            onClick={leaveVoice}
            className="p-3 rounded-full hover:opacity-90 transition-all shadow"
            style={{
              background: 'var(--color-danger)',
              color: '#fff',
            }}
            title="Disconnect"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
