import { useEffect, useRef, useState } from 'react'
import * as Avatar from '@radix-ui/react-avatar'
import * as Popover from '@radix-ui/react-popover'
import { MicOff, Headphones, Volume2, Sliders } from 'lucide-react'
import type { VoiceParticipant } from '@/stores/voiceStore'

export function ParticipantTile({
  participant,
  displayName,
  avatarUrl,
  isSpotlight = false,
  fitMode = 'contain',
}: {
  participant: VoiceParticipant
  displayName?: string
  avatarUrl?: string | null
  isSpotlight?: boolean
  fitMode?: 'contain' | 'cover'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const screenAudioRef = useRef<HTMLAudioElement>(null)
  const [volume, setVolume] = useState(100)
  const nameToDisplay = displayName || participant.name || 'Usuário'

  const isSpeaking = participant.isSpeaking && !participant.isMuted && !participant.isDeafened
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

  // Attach and play remote screen share audio track if present
  useEffect(() => {
    const audioEl = screenAudioRef.current
    if (audioEl && participant.screenAudioTrack && !participant.isLocal) {
      participant.screenAudioTrack.attach(audioEl)
      audioEl.play().catch((err) => console.warn('Screen audio play error:', err))
      return () => {
        participant.screenAudioTrack?.detach(audioEl)
      }
    }
  }, [participant.screenAudioTrack, participant.isLocal])

  function handleVolumeChange(val: number) {
    setVolume(val)
    // Adjust remote audio elements for this participant's microphone
    const audioElements = document.querySelectorAll(
      `audio[data-participant-id="${participant.identity}"]`
    )
    audioElements.forEach((el) => {
      ;(el as HTMLAudioElement).volume = Math.min(Math.max(val / 100, 0), 1)
    })
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl overflow-hidden transition-all duration-75 shadow-md group select-none ${
        isSpotlight ? 'w-full h-full flex-1 min-h-0' : 'aspect-video w-full'
      } ${
        isSpeaking
          ? 'border-2 border-[#23a55a] shadow-[0_0_20px_rgba(35,165,90,0.6)] ring-2 ring-[#23a55a]'
          : 'border-2 border-transparent'
      }`}
      style={{
        background: 'var(--color-bg-secondary)',
      }}
    >
      {/* Hidden audio element for screen share stream audio */}
      {!participant.isLocal && participant.screenAudioTrack && (
        <audio ref={screenAudioRef} autoPlay playsInline />
      )}

      {activeVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${
            participant.screenTrack
              ? fitMode === 'cover'
                ? 'object-cover'
                : 'object-contain'
              : 'object-cover'
          }`}
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Avatar.Root
            className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-gray-600 transition-all duration-75 shadow-inner ${
              isSpeaking ? 'ring-4 ring-[#23a55a] shadow-[0_0_16px_rgba(35,165,90,0.8)] scale-105' : ''
            }`}
          >
            <Avatar.Image src={avatarUrl ?? undefined} alt={nameToDisplay} className="w-full h-full object-cover" />
            <Avatar.Fallback className="text-2xl font-bold text-white bg-[#5865f2]">
              {nameToDisplay[0]?.toUpperCase() ?? '?'}
            </Avatar.Fallback>
          </Avatar.Root>

          {/* Sound Wave Animation when speaking */}
          {isSpeaking && (
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
        <span className="truncate max-w-[120px]">{nameToDisplay}</span>
        {participant.isLocal && <span className="opacity-60 text-[10px]">(Você)</span>}

        <div className="flex items-center gap-1.5 ml-1">
          {participant.isMuted && (
            <MicOff size={13} className="text-[#f23f43]" />
          )}
          {participant.isDeafened && (
            <Headphones size={13} className="text-[#f23f43]" />
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
