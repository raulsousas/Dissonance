import { useEffect, useRef } from 'react'
import * as Avatar from '@radix-ui/react-avatar'
import { MicOff, VolumeX } from 'lucide-react'
import type { VoiceParticipant } from '@/stores/voiceStore'

export function ParticipantTile({ participant }: { participant: VoiceParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const activeVideoTrack = participant.screenTrack || participant.videoTrack

  useEffect(() => {
    const el = videoRef.current
    if (el && activeVideoTrack) {
      activeVideoTrack.attach(el)
      return () => {
        activeVideoTrack.detach(el)
      }
    }
  }, [activeVideoTrack])

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl overflow-hidden aspect-video transition-all shadow-md group"
      style={{
        background: 'var(--color-bg-secondary)',
        border: participant.isSpeaking ? '2px solid var(--color-online)' : '2px solid transparent',
      }}
    >
      {activeVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Avatar.Root
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-gray-600 transition-all shadow-inner"
            style={{
              boxShadow: participant.isSpeaking ? '0 0 0 4px var(--color-online)' : 'none',
            }}
          >
            <Avatar.Fallback className="text-2xl font-bold text-white">
              {participant.name[0]?.toUpperCase() ?? '?'}
            </Avatar.Fallback>
          </Avatar.Root>
        </div>
      )}

      {/* Participant name and status badges */}
      <div
        className="absolute bottom-2 left-2 flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur-md"
        style={{
          background: 'rgba(0, 0, 0, 0.65)',
          color: '#fff',
        }}
      >
        <span className="truncate max-w-[120px]">{participant.name}</span>
        {participant.isLocal && <span className="opacity-60 text-[10px]">(You)</span>}

        <div className="flex items-center gap-1 ml-1">
          {participant.isMuted && (
            <MicOff size={13} style={{ color: 'var(--color-danger)' }} />
          )}
          {participant.isDeafened && (
            <VolumeX size={13} style={{ color: 'var(--color-danger)' }} />
          )}
        </div>
      </div>
    </div>
  )
}
