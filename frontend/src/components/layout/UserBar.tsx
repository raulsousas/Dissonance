import { Mic, Headphones, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import * as Avatar from '@radix-ui/react-avatar'

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--color-online)',
  away: 'var(--color-idle)',
  dnd: 'var(--color-dnd)',
  invisible: 'var(--color-offline)',
  offline: 'var(--color-offline)',
}

/**
 * Bottom-left bar showing the current user's avatar, name, status, and audio controls.
 */
export default function UserBar() {
  const { currentUser, logout } = useAuth()

  if (!currentUser) return null

  const statusColor = STATUS_COLORS[currentUser.status] ?? STATUS_COLORS.offline

  return (
    <div
      className="shrink-0 h-14 px-2 flex items-center gap-1"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
        <div className="relative shrink-0">
          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden block">
            <Avatar.Image
              src={currentUser.avatarUrl ?? undefined}
              alt={currentUser.displayName}
              className="w-full h-full object-cover"
            />
            <Avatar.Fallback
              className="w-full h-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ background: 'var(--color-accent)' }}
            >
              {currentUser.displayName[0]?.toUpperCase()}
            </Avatar.Fallback>
          </Avatar.Root>
          {/* Status dot */}
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
            style={{
              background: statusColor,
              borderColor: 'var(--color-bg-primary)',
            }}
            aria-label={`Status: ${currentUser.status}`}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className="text-xs font-semibold truncate leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {currentUser.displayName}
          </span>
          <span
            className="text-xs truncate leading-tight capitalize"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {currentUser.status}
          </span>
        </div>
      </div>

      {/* Audio controls */}
      <div className="flex items-center shrink-0">
        <ControlButton label="Toggle mute" onClick={() => {}}>
          <Mic size={16} />
        </ControlButton>
        <ControlButton label="Toggle deafen" onClick={() => {}}>
          <Headphones size={16} />
        </ControlButton>
        <ControlButton label="User settings" onClick={logout}>
          <Settings size={16} />
        </ControlButton>
      </div>
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded transition-colors"
      style={{ color: 'var(--color-text-muted)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
    >
      {children}
    </button>
  )
}
