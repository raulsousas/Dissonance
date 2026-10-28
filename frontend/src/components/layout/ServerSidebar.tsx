import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { Plus, Compass } from 'lucide-react'
import logoVetorizada from '@/images/logo_vetorizada.png'
import { useServers, useCreateServer, useJoinServer, type Server } from '@/hooks/useServers'
import { useMessagingStore } from '@/stores/messagingStore'
import { usePendingRequests } from '@/hooks/useFriends'

interface Props {
  selectedServerId: string | null
}

export default function ServerSidebar({ selectedServerId }: Props) {
  const { data: servers = [] } = useServers()
  const navigate = useNavigate()
  const unread = useMessagingStore((s) => s.unread)
  const channelToServer = useMessagingStore((s) => s.channelToServer)
  const { data: pendingRequests } = usePendingRequests()
  const pendingFriendsCount = pendingRequests?.incoming?.length || 0

  const totalDmUnread = Object.entries(unread).reduce((acc, [id, count]) => {
    return !channelToServer[id] ? acc + count : acc
  }, 0)

  const totalHomeBadge = totalDmUnread + pendingFriendsCount

  return (
    <nav
      className="flex flex-col items-center gap-2 py-3 w-full min-h-full select-none"
      style={{ background: 'var(--color-bg-primary)' }}
      aria-label="Servers"
    >
      {/* Discord / DM Home button */}
      <HomePillButton
        active={!selectedServerId}
        badgeCount={totalHomeBadge}
        onClick={() => navigate('/app/dm')}
      />

      <div className="w-8 h-[2px] mx-auto rounded my-0.5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Server list */}
      <div className="flex flex-col items-center gap-2 w-full">
        {servers.map((s) => {
          const serverUnread = Object.entries(unread).reduce((acc, [chId, count]) => {
            return channelToServer[chId] === s.id ? acc + count : acc
          }, 0)

          return (
            <ServerIcon
              key={s.id}
              server={s}
              unreadCount={serverUnread}
              active={s.id === selectedServerId}
              onClick={() => navigate(`/app/servers/${s.id}`)}
            />
          )
        })}
      </div>

      <div className="w-8 h-[2px] mx-auto rounded my-0.5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Add server */}
      <AddServerButton />

      {/* Explore Compass */}
      <ActionButton
        label="Explore Discoverable Servers"
        icon={<Compass size={20} />}
        hoverColor="var(--color-online)"
      />
    </nav>
  )
}

function HomePillButton({
  active,
  badgeCount,
  onClick,
}: {
  active: boolean
  badgeCount: number
  onClick: () => void
}) {
  return (
    <div className="relative group flex items-center justify-center w-full">
      {/* Sliding white indicator pill */}
      <span
        className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
          active
            ? 'h-10 opacity-100'
            : badgeCount > 0
            ? 'h-2 opacity-100 group-hover:h-5'
            : 'h-2 opacity-0 group-hover:opacity-100 group-hover:h-5'
        }`}
      />
      <button
        onClick={onClick}
        title="Direct Messages"
        aria-label="Direct Messages"
        className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden ${
          active
            ? 'rounded-2xl bg-[#5865f2] text-white shadow-md'
            : 'rounded-[24px] bg-[#313338] text-[#dbdee1] hover:rounded-2xl hover:bg-[#5865f2] hover:text-white'
        }`}
      >
        <img
          src={logoVetorizada}
          alt="Dissonance"
          className="w-7 h-7 object-contain"
        />

        {/* Unread notification badge bubble */}
        {badgeCount > 0 && (
          <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#f23f43] text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#1e1f22] shadow animate-in fade-in zoom-in duration-150">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>
    </div>
  )
}

function ServerIcon({
  server,
  unreadCount,
  active,
  onClick,
}: {
  server: Server
  unreadCount: number
  active: boolean
  onClick: () => void
}) {
  return (
    <div className="relative group flex items-center justify-center w-full">
      {/* Sliding white indicator pill */}
      <span
        className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
          active
            ? 'h-10 opacity-100'
            : unreadCount > 0
            ? 'h-2 opacity-100 group-hover:h-5'
            : 'h-2 opacity-0 group-hover:opacity-100 group-hover:h-5'
        }`}
      />
      <button
        onClick={onClick}
        title={server.name}
        aria-label={server.name}
        aria-current={active ? 'page' : undefined}
        className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer overflow-visible ${
          active
            ? 'rounded-2xl bg-[#5865f2] text-white shadow-md'
            : 'rounded-[24px] bg-[#313338] text-[#dbdee1] hover:rounded-2xl hover:bg-[#5865f2] hover:text-white'
        }`}
      >
        <Avatar.Root className="w-full h-full rounded-[inherit] overflow-hidden flex items-center justify-center">
          <Avatar.Image src={server.iconUrl ?? undefined} alt={server.name} className="w-full h-full object-cover" />
          <Avatar.Fallback className="text-sm font-semibold tracking-wide">
            {server.name.split(' ').map(w => w[0]).slice(0, 3).join('').toUpperCase()}
          </Avatar.Fallback>
        </Avatar.Root>

        {/* Unread notification badge bubble */}
        {unreadCount > 0 && !active && (
          <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#f23f43] text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#1e1f22] shadow animate-in fade-in zoom-in duration-150">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}

function ActionButton({ label, icon, hoverColor }: { label: string; icon: React.ReactNode; hoverColor: string }) {
  return (
    <div className="relative group flex items-center justify-center w-full">
      <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-2 opacity-0 group-hover:opacity-100 group-hover:h-5" />
      <button
        title={label}
        aria-label={label}
        className="w-12 h-12 rounded-[24px] bg-[#313338] text-[#23a55a] flex items-center justify-center transition-all duration-200 hover:rounded-2xl hover:bg-[#23a55a] hover:text-white cursor-pointer"
        style={{ color: hoverColor }}
      >
        {icon}
      </button>
    </div>
  )
}

function AddServerButton() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode('choose') }}>
      <Dialog.Trigger asChild>
        <div className="relative group flex items-center justify-center w-full">
          <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-2 opacity-0 group-hover:opacity-100 group-hover:h-5" />
          <button
            title="Add a server"
            aria-label="Add a server"
            className="w-12 h-12 rounded-[24px] bg-[#313338] text-[#23a55a] flex items-center justify-center transition-all duration-200 hover:rounded-2xl hover:bg-[#23a55a] hover:text-white cursor-pointer"
          >
            <Plus size={22} />
          </button>
        </div>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.7)' }} />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg p-6 shadow-2xl"
          style={{ background: 'var(--color-bg-tertiary)' }}
        >
          {mode === 'choose' && <ChooseMode onCreate={() => setMode('create')} onJoin={() => setMode('join')} />}
          {mode === 'create' && <CreateServerForm onDone={() => setOpen(false)} />}
          {mode === 'join' && <JoinServerForm onDone={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ChooseMode({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="text-center">
      <Dialog.Title className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        Add a Server
      </Dialog.Title>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Create your own or join an existing one with an invite.
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onCreate}
          className="w-full py-3 rounded-md font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          Create a Server
        </button>
        <button
          onClick={onJoin}
          className="w-full py-3 rounded-md font-semibold text-sm border transition-opacity hover:opacity-90"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <Compass size={14} className="inline mr-2" />
          Join with an Invite
        </button>
      </div>
    </div>
  )
}

function CreateServerForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const createServer = useCreateServer()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Server name is required'); return }
    try {
      const server = await createServer.mutateAsync({ name: name.trim() })
      onDone()
      navigate(`/app/servers/${server.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create server')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Dialog.Title className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        Create a Server
      </Dialog.Title>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Give your server a name. You can always change it later.
      </p>
      <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
        Server Name
      </label>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        placeholder="My Awesome Server"
        className="w-full px-3 py-2 rounded-md text-sm outline-none mb-1"
        style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        autoFocus
        maxLength={100}
      />
      {error && <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      <button
        type="submit"
        disabled={createServer.isPending}
        className="w-full mt-4 py-2 rounded-md font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        {createServer.isPending ? 'Creating…' : 'Create Server'}
      </button>
    </form>
  )
}

function JoinServerForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const join = useJoinServer()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const raw = code.trim().split('/').pop() ?? ''
    if (!raw) { setError('Enter an invite code or link'); return }
    try {
      const server = await join.mutateAsync(raw)
      onDone()
      navigate(`/app/servers/${server.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Invalid or expired invite')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Dialog.Title className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        Join a Server
      </Dialog.Title>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Enter an invite code or link.
      </p>
      <label className="block text-xs font-semibold uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
        Invite Code or Link
      </label>
      <input
        value={code}
        onChange={(e) => { setCode(e.target.value); setError('') }}
        placeholder="https://guilda.app/invite/aBcDeF"
        className="w-full px-3 py-2 rounded-md text-sm outline-none mb-1"
        style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        autoFocus
      />
      {error && <p className="text-xs mb-2" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      <button
        type="submit"
        disabled={join.isPending}
        className="w-full mt-4 py-2 rounded-md font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        {join.isPending ? 'Joining…' : 'Join Server'}
      </button>
    </form>
  )
}
