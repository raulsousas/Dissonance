import { useEffect, useState, type ReactNode } from 'react'
import type { Room } from 'livekit-client'
import { PING_COLORS, classifyPing, formatPing } from '@/lib/ping'

/** Shows the current signalling round-trip time while the pointer is over `children`. */
export function VoicePing({ room, children }: { room: Room | null; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  const [ping, setPing] = useState<number | null>(null)

  useEffect(() => {
    if (!hovered || !room) return
    const read = () => setPing(room.engine?.client?.rtt ?? null)
    read()
    const timer = setInterval(read, 1000)
    return () => clearInterval(timer)
  }, [hovered, room])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <span
          role="tooltip"
          className="absolute left-0 bottom-full mb-1.5 z-50 whitespace-nowrap rounded-md bg-[#111214] px-2 py-1 text-[11px] font-semibold text-[#F2F3F5] shadow-lg border border-[#3C3F48]/60 pointer-events-none"
        >
          Ping: <span style={{ color: PING_COLORS[classifyPing(ping)] }}>{formatPing(ping)}</span>
        </span>
      )}
    </span>
  )
}
