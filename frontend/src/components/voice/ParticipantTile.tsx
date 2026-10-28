import { useEffect, useRef, useState } from 'react'
import * as Avatar from '@radix-ui/react-avatar'
import * as Popover from '@radix-ui/react-popover'
import { MicOff, VolumeX, Volume2, Sliders } from 'lucide-react'
import type { VoiceParticipant } from '@/stores/voiceStore'

export function ParticipantTile({ participant }: { participant: VoiceParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [volume, setVolume] = useState(100)

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

  function handleVolumeChange(val: number) {
    setVolume(val)
    // Adjust remote audio elements for this participant
    const audioElements = document.querySelectorAll(`audio`)
    audioElements.forEach((el) => {
      // Scale standard 0.0 to 1.0 (with max 2.0 via web audio if needed)
      el.volume = Math.min(Math.max(val / 100, 0), 1)
    })
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl overflow-hidden aspect-video transition-all shadow-md group select-none"
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
            <Avatar.Fallback className="text-2xl font-bold text-white bg-[#5865f2]">
              {participant.name[0]?.toUpperCase() ?? '?'}
            </Avatar.Fallback>
          </Avatar.Root>

          {/* Sound Wave Animation when speaking */}
          {participant.isSpeaking && (
            <div className="flex items-center gap-1 h-3 mt-1">
              <span className="w-1 bg-[#23a55a] rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
              <span className="w-1 bg-[#23a55a] rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
              <span className="w-1 bg-[#23a55a] rounded-full animate-bounce [animation-delay:0s] h-2" />
              <span className="w-1 bg-[#23a55a] rounded-full animate-bounce [animation-delay:-0.2s] h-4" />
            </div>
          )}
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
        {participant.isLocal && <span className="opacity-60 text-[10px]">(Você)</span>}

        <div className="flex items-center gap-1 ml-1">
          {participant.isMuted && (
            <MicOff size={13} style={{ color: 'var(--color-danger)' }} />
          )}
          {participant.isDeafened && (
            <VolumeX size={13} style={{ color: 'var(--color-danger)' }} />
          )}
        </div>
      </div>

      {/* Volume slider control popover for remote participants */}
      {!participant.isLocal && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer backdrop-blur-md"
                title="Ajustar volume do participante"
              >
                <Sliders size={14} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                className="w-48 bg-[#1e1f22] border border-[#2b2d31] p-3 rounded-lg shadow-xl text-xs space-y-2 z-50 text-[#dbdee1]"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1 text-[#f2f3f5]">
                    <Volume2 size={14} className="text-[#5865f2]" /> Volume do Usuário
                  </span>
                  <span className="text-[11px] text-[#949ba4] font-mono">{volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-[#5865f2] cursor-pointer"
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}
    </div>
  )
}
