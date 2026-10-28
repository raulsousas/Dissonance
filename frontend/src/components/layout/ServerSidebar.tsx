import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { Plus, Hash, Compass } from 'lucide-react'
import { useServers, useCreateServer, useJoinServer, type Server } from '@/hooks/useServers'

interface Props {
  selectedServerId: string | null
}

export default function ServerSidebar({ selectedServerId }: Props) {
  const { data: servers = [] } = useServers()
  const navigate = useNavigate()

  return (
    <nav
      className="flex flex-col items-center gap-2 py-3 w-full"
      style={{ background: 'var(--color-bg-primary)' }}
      aria-label="Servers"
    >
      {/* DM button */}
      <SidebarIcon
        label="Direct Messages"
        active={!selectedServerId}
        onClick={() => navigate('/app/dm')}
      >
        <Hash size={20} />
      </SidebarIcon>

      <div className="w-8 h-px mx-auto" style={{ background: 'var(--color-border)' }} />

      {/* Server list */}
      {servers.map((s) => (
        <ServerIcon
          key={s.id}
          server={s}
          active={s.id === selectedServerId}
          onClick={() => navigate(`/app/servers/${s.id}`)}
        />
      ))}

      <div className="w-8 h-px mx-auto" style={{ background: 'var(--color-border)' }} />

      {/* Add / join server */}
      <AddServerButton />
    </nav>
  )
}

function ServerIcon({ server, active, onClick }: { server: Server; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={server.name}
      aria-label={server.name}
      aria-current={active ? 'page' : undefined}
      className="group relative flex items-center"
    >
      {/* Active indicator */}
      <span
        className="absolute left-0 w-1 rounded-r transition-all"
        style={{
          background: 'var(--color-text-primary)',
          height: active ? '36px' : '8px',
          opacity: active ? 1 : 0,
        }}
      />
      <Avatar.Root
        className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center transition-all group-hover:rounded-2xl"
        style={{
          background: active ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          borderRadius: active ? '16px' : '50%',
          transition: 'border-radius 0.15s ease, background 0.15s ease',
        }}
      >
        <Avatar.Image src={server.iconUrl ?? undefined} alt={server.name} className="w-full h-full object-cover" />
        <Avatar.Fallback
          className="text-sm font-bold"
          style={{ color: active ? '#fff' : 'var(--color-text-primary)' }}
        >
          {server.name[0]?.toUpperCase()}
        </Avatar.Fallback>
      </Avatar.Root>
    </button>
  )
}

function SidebarIcon({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:rounded-2xl"
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
        color: active ? '#fff' : 'var(--color-text-muted)',
        borderRadius: active ? '16px' : '50%',
        transition: 'border-radius 0.15s ease, background 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

function AddServerButton() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode('choose') }}>
      <Dialog.Trigger asChild>
        <button
          title="Add a server"
          aria-label="Add a server"
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:rounded-2xl"
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-online)',
            borderRadius: '50%',
            transition: 'border-radius 0.15s ease',
          }}
        >
          <Plus size={24} />
        </button>
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
