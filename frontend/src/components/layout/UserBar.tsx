import { useState } from 'react'
import { Mic, MicOff, Headphones, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useVoice } from '@/hooks/useVoice'
import * as Avatar from '@radix-ui/react-avatar'
import { UserSettingsModal } from '@/components/modals/UserSettingsModal'

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
  const { currentUser } = useAuth()
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoice()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!currentUser) return null

  const statusColor = STATUS_COLORS[currentUser.status] ?? STATUS_COLORS.online

  return (
    <div
      className="shrink-0 h-[52px] px-2 flex items-center justify-between border-t select-none"
      style={{ background: '#232428', borderColor: 'var(--color-border)' }}
    >
      {/* Avatar + name */}
      <button
        onClick={() => setSettingsOpen(true)}
        title="Configurações do usuário"
        className="flex items-center gap-2 flex-1 min-w-0 p-1 -ml-1 rounded hover:bg-[#35373c] transition-colors cursor-pointer text-left"
      >
        <div className="relative shrink-0">
          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden block bg-gray-600">
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
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{
              background: statusColor,
              borderColor: '#232428',
            }}
            aria-label={`Status: ${currentUser.status}`}
          />
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-xs font-semibold truncate text-[#f2f3f5]">
            {currentUser.displayName}
          </span>
          <span className="text-[11px] truncate text-[#949ba4]">
            {localStorage.getItem('guilda-custom-status') || 'Disponível'}
          </span>
        </div>
      </button>

      {/* Audio & Settings controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <ControlButton
          label={isMuted ? 'Desmutar microfone' : 'Mutar microfone'}
          onClick={toggleMute}
          active={isMuted}
        >
          {isMuted ? <MicOff size={17} className="text-[#f23f43]" /> : <Mic size={17} />}
        </ControlButton>
        <ControlButton
          label={isDeafened ? 'Desensurdecer' : 'Ensurdecer'}
          onClick={toggleDeafen}
          active={isDeafened}
        >
          <Headphones size={17} className={isDeafened ? 'text-[#f23f43]' : ''} />
        </ControlButton>
        <ControlButton label="Configurações do usuário" onClick={() => setSettingsOpen(true)}>
          <Settings size={17} />
        </ControlButton>
      </div>

      <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
        active
          ? 'text-[#f23f43] hover:bg-[#35373c]'
          : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]'
      }`}
    >
      {children}
    </button>
  )
}
