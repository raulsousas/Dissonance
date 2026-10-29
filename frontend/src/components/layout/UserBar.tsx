import { useState, useEffect } from 'react'
import { Mic, MicOff, Headphones, Settings, Smile, Check, ChevronDown, Bell } from 'lucide-react'
import { useAuth, type CurrentUser } from '@/hooks/useAuth'
import { useVoice } from '@/hooks/useVoice'
import { getStatusLabel, getStatusColor } from '@/stores/presenceStore'
import { useMessagingStore } from '@/stores/messagingStore'
import * as Avatar from '@radix-ui/react-avatar'
import * as Popover from '@radix-ui/react-popover'
import { UserSettingsModal } from '@/components/modals/UserSettingsModal'

interface StatusOption {
  value: CurrentUser['status']
  label: string
  desc: string
  color: string
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'online',
    label: 'Disponível',
    desc: 'Visível e online para todos',
    color: '#23a55a',
  },
  {
    value: 'away',
    label: 'Ausente',
    desc: 'Aparece ausente para outros membros',
    color: '#f0b232',
  },
  {
    value: 'dnd',
    label: 'Não Perturbe',
    desc: 'Ocupado, sem notificações de som',
    color: '#f23f43',
  },
  {
    value: 'invisible',
    label: 'Invisível',
    desc: 'Aparece offline, mas tem acesso total',
    color: '#80848e',
  },
]

/**
 * Bottom-left bar showing the current user's avatar, name, status, and audio controls.
 */
export default function UserBar() {
  const { currentUser, updateStatus } = useAuth()
  const { isMuted, isDeafened, toggleMute, toggleDeafen } = useVoice()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [customStatus, setCustomStatus] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('guilda-custom-status') || '' : '')
  )

  useEffect(() => {
    function handleCustomStatusChange() {
      setCustomStatus(localStorage.getItem('guilda-custom-status') || '')
    }
    window.addEventListener('storage', handleCustomStatusChange)
    window.addEventListener('guilda-custom-status-updated', handleCustomStatusChange)
    return () => {
      window.removeEventListener('storage', handleCustomStatusChange)
      window.removeEventListener('guilda-custom-status-updated', handleCustomStatusChange)
    }
  }, [])

  if (!currentUser) return null

  const currentStatus = currentUser.status || 'online'
  const statusColor = getStatusColor(currentStatus)
  const statusLabel = getStatusLabel(currentStatus)
  const subtitle = customStatus ? customStatus : statusLabel

  async function handleSelectStatus(status: CurrentUser['status']) {
    try {
      await updateStatus(status)
      setPopoverOpen(false)
    } catch (err) {
      console.error('Failed to change status:', err)
    }
  }

  const unreadMap = useMessagingStore((s) => s.unread)
  const totalUnread = Object.values(unreadMap).reduce((acc, c) => acc + c, 0)

  return (
    <div
      className="shrink-0 h-[56px] px-3 flex items-center justify-between border-t select-none bg-[#111214] border-[#1f2023]"
    >
      {/* Avatar + name with Discord status menu */}
      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger asChild>
          <button
            title="Menu do Usuário"
            className="flex items-center gap-2.5 flex-1 min-w-0 p-1 -ml-1 rounded-xl hover:bg-[#2b2d31]/50 transition-colors cursor-pointer text-left"
          >
            <div className="relative shrink-0">
              <Avatar.Root className="w-9 h-9 rounded-full overflow-hidden block bg-[#2b2d31]">
                <Avatar.Image
                  src={currentUser.avatarUrl ?? undefined}
                  alt={currentUser.displayName}
                  className="w-full h-full object-cover"
                />
                <Avatar.Fallback
                  className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-[#5865f2]"
                >
                  {currentUser.displayName[0]?.toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              {/* Status dot */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                style={{
                  background: statusColor,
                  borderColor: '#111214',
                }}
                aria-label={`Status: ${statusLabel}`}
              />
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold truncate text-[#f2f3f5]">
                  {currentUser.displayName}
                </span>
                <ChevronDown size={14} className="shrink-0 text-[#949ba4]" />
              </div>
              <span className="text-[11px] truncate text-[#949ba4]">
                {subtitle}
              </span>
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={10}
            className="z-50 w-72 rounded-xl shadow-2xl bg-[#232428] border border-[#1f2023] overflow-hidden outline-none text-[#dbdee1] animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Banner preview */}
            <div
              className="h-12 w-full"
              style={{
                background: localStorage.getItem('guilda-banner-color') || '#5865f2',
              }}
            />

            {/* Profile summary */}
            <div className="px-3 pb-3 relative">
              <div className="flex items-end justify-between -mt-6 mb-2">
                <div className="relative">
                  <Avatar.Root className="w-14 h-14 rounded-full border-4 border-[#232428] overflow-hidden block bg-[#1e1f22]">
                    <Avatar.Image
                      src={currentUser.avatarUrl ?? undefined}
                      alt={currentUser.displayName}
                      className="w-full h-full object-cover"
                    />
                    <Avatar.Fallback className="w-full h-full flex items-center justify-center text-lg font-bold text-white bg-[#5865f2]">
                      {currentUser.displayName[0]?.toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <span
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#232428]"
                    style={{ background: statusColor }}
                  />
                </div>
              </div>

              <div className="mb-2">
                <p className="text-sm font-bold text-[#f2f3f5] truncate">
                  {currentUser.displayName}
                </p>
                <p className="text-[11px] text-[#949ba4] truncate">{currentUser.email}</p>
                {customStatus && (
                  <p className="text-xs mt-1 text-[#dbdee1] bg-[#111214] px-2 py-1 rounded truncate flex items-center gap-1.5">
                    <Smile size={13} className="text-[#949ba4] shrink-0" />
                    <span className="truncate">{customStatus}</span>
                  </p>
                )}
              </div>

              {/* Status options list */}
              <div className="pt-2 border-t border-[#35373c] space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] px-2 py-1">
                  Mudar Status
                </p>
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = currentStatus === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelectStatus(opt.value)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#35373c] text-white' : 'hover:bg-[#2b2d31] text-[#dbdee1]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: opt.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-[#949ba4] leading-tight truncate">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-[#5865f2] shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* Actions footer */}
              <div className="pt-2 mt-2 border-t border-[#35373c] flex flex-col gap-1">
                <button
                  onClick={() => {
                    setPopoverOpen(false)
                    setSettingsOpen(true)
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#dbdee1] hover:bg-[#2b2d31] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Settings size={14} />
                  <span>Configurações do Perfil</span>
                </button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Right controls / Notification Bell in Discord mobile style */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setSettingsOpen(true)}
          title="Notificações e Configurações"
          className="relative px-2.5 py-1.5 rounded-2xl bg-[#232428] hover:bg-[#35373c] text-[#dbdee1] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Bell size={16} className="text-[#dbdee1]" />
          {totalUnread > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#f23f43] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>

        <div className="hidden md:flex items-center gap-0.5">
          <ControlButton
            label={isMuted ? 'Desmutar microfone' : 'Mutar microfone'}
            onClick={toggleMute}
            active={isMuted}
          >
            {isMuted ? <MicOff size={16} className="text-[#f23f43]" /> : <Mic size={16} />}
          </ControlButton>

          <ControlButton
            label={isDeafened ? 'Desensurdecer' : 'Ensurdecer'}
            onClick={toggleDeafen}
            active={isDeafened}
          >
            <Headphones size={16} className={isDeafened ? 'text-[#f23f43]' : ''} />
          </ControlButton>
        </div>
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
