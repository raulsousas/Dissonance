import { useNavigate } from 'react-router-dom'
import { PhoneOff, Mic, MicOff, Headphones, Video, VideoOff, ScreenShare, Radio } from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'

export function VoiceControlsBar() {
  const navigate = useNavigate()
  const {
    isConnected,
    isConnecting,
    activeChannelId,
    activeServerId,
    activeChannelName,
    isMuted,
    isDeafened,
    isVideoEnabled,
    isScreenSharing,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
  } = useVoice()

  if (!isConnected && !isConnecting) return null

  return (
    <div
      className="p-2 border-b flex flex-col gap-2 select-none"
      style={{
        background: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (activeServerId && activeChannelId) {
              navigate(`/app/servers/${activeServerId}/channels/${activeChannelId}`)
            }
          }}
          className="flex items-center gap-2 text-left hover:underline truncate"
        >
          <Radio size={16} className="shrink-0 animate-pulse" style={{ color: 'var(--color-online)' }} />
          <div className="truncate">
            <p className="text-[11px] font-bold leading-tight" style={{ color: 'var(--color-online)' }}>
              {isConnecting ? 'RTC Connecting...' : 'Voice Connected'}
            </p>
            <p className="text-xs truncate font-medium opacity-80" style={{ color: 'var(--color-text-primary)' }}>
              {activeChannelName || 'Voice Channel'}
            </p>
          </div>
        </button>

        <button
          onClick={leaveVoice}
          title="Disconnect"
          aria-label="Disconnect"
          className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
          style={{ color: 'var(--color-danger)' }}
        >
          <PhoneOff size={18} />
        </button>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-around pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          style={{ color: isMuted ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          style={{ color: isDeafened ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
        >
          <Headphones size={16} />
        </button>

        <button
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          aria-label={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          style={{ color: isVideoEnabled ? 'var(--color-online)' : 'var(--color-text-muted)' }}
        >
          {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
        </button>

        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          style={{ color: isScreenSharing ? 'var(--color-online)' : 'var(--color-text-muted)' }}
        >
          <ScreenShare size={16} />
        </button>
      </div>
    </div>
  )
}
