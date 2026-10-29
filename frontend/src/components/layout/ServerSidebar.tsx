import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { Plus, Compass, MessageSquare } from 'lucide-react'
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
        title="Mensagens diretas"
        aria-label="Mensagens diretas"
        className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer ${
          active
            ? 'rounded-2xl bg-[#7667F5] text-white shadow-md'
            : 'rounded-[24px] bg-[#2B2D33] text-[#B5BAC3] hover:rounded-2xl hover:bg-[#7667F5] hover:text-white'
        }`}
      >
        <MessageSquare size={22} className={active ? 'fill-current text-white' : 'fill-[#B5BAC3]/40 text-[#B5BAC3]'} />

        {/* Unread notification badge bubble */}
        {badgeCount > 0 && (
          <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F04747] text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#1B1C20] shadow animate-in fade-in zoom-in duration-150">
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
            ? 'rounded-2xl bg-[#7667F5] text-white shadow-md'
            : 'rounded-[24px] bg-[#2B2D33] text-[#B5BAC3] hover:rounded-2xl hover:bg-[#7667F5] hover:text-white'
        }`}
      >
        <Avatar.Root className="w-full h-full rounded-[inherit] overflow-hidden flex items-center justify-center bg-transparent">
          <Avatar.Image src={server.iconUrl ?? undefined} alt={server.name} className="w-full h-full object-cover" />
          <Avatar.Fallback className="w-full h-full flex items-center justify-center text-sm font-bold tracking-wide text-current bg-transparent select-none">
            {server.name.split(' ').map(w => w[0]).slice(0, 3).join('').toUpperCase()}
          </Avatar.Fallback>
        </Avatar.Root>

        {/* Unread notification badge bubble */}
        {unreadCount > 0 && !active && (
          <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F04747] text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#1B1C20] shadow animate-in fade-in zoom-in duration-150">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}

function ActionButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="relative group flex items-center justify-center w-full">
      <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-2 opacity-0 group-hover:opacity-100 group-hover:h-5" />
      <button
        title={label}
        aria-label={label}
        className="w-12 h-12 rounded-[24px] bg-[#2B2D33] text-[#35C98A] flex items-center justify-center transition-all duration-200 hover:rounded-2xl hover:bg-[#35C98A] hover:text-white cursor-pointer"
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
            className="w-12 h-12 rounded-[24px] bg-[#2B2D33] text-[#35C98A] flex items-center justify-center transition-all duration-200 hover:rounded-2xl hover:bg-[#35C98A] hover:text-white cursor-pointer"
          >
            <Plus size={22} />
          </button>
        </div>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl p-6 shadow-2xl bg-[#2B2D33] border border-[#3C3F48] text-[#F2F3F5] outline-none"
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
      <Dialog.Title className="text-xl font-bold mb-1 text-[#F2F3F5]">
        Criar um Servidor
      </Dialog.Title>
      <p className="text-sm mb-6 text-[#858B98]">
        Crie seu próprio servidor ou junte-se a um já existente com um convite.
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onCreate}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all bg-[#7667F5] hover:bg-[#6857ea] text-white cursor-pointer shadow-md"
        >
          Criar meu Servidor
        </button>
        <button
          onClick={onJoin}
          className="w-full py-3 rounded-lg font-semibold text-sm border border-[#3C3F48] bg-[#1B1C20] text-[#F2F3F5] hover:bg-[#3B3E47] transition-all cursor-pointer"
        >
          <Compass size={16} className="inline mr-2 text-[#35C98A]" />
          Entrar com um Convite
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
      <Dialog.Title className="text-xl font-bold mb-1 text-[#F2F3F5]">
        Criar Servidor
      </Dialog.Title>
      <p className="text-sm mb-4 text-[#858B98]">
        Dê um nome ao seu servidor. Você pode alterá-lo quando quiser.
      </p>
      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#858B98]">
        Nome do Servidor
      </label>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        placeholder="Servidor Incrível"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-1 bg-[#1B1C20] text-[#F2F3F5] border border-[#3C3F48] focus:border-[#7667F5] transition-all"
        autoFocus
        maxLength={100}
      />
      {error && <p className="text-xs mb-3 text-[#F04747] font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={createServer.isPending}
        className="w-full mt-4 py-2.5 rounded-lg font-semibold text-sm transition-all bg-[#7667F5] hover:bg-[#6857ea] text-white disabled:opacity-50 cursor-pointer shadow-md"
      >
        {createServer.isPending ? 'Criando…' : 'Criar Servidor'}
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
      <Dialog.Title className="text-xl font-bold mb-1 text-[#F2F3F5]">
        Entrar em um Servidor
      </Dialog.Title>
      <p className="text-sm mb-4 text-[#858B98]">
        Insira o link ou código de convite.
      </p>
      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[#858B98]">
        Código ou Link de Convite
      </label>
      <input
        value={code}
        onChange={(e) => { setCode(e.target.value); setError('') }}
        placeholder="https://guilda.app/invite/aBcDeF"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-1 bg-[#1B1C20] text-[#F2F3F5] border border-[#3C3F48] focus:border-[#7667F5] transition-all"
        autoFocus
      />
      {error && <p className="text-xs mb-2 text-[#F04747] font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={join.isPending}
        className="w-full mt-4 py-2.5 rounded-lg font-semibold text-sm transition-all bg-[#7667F5] hover:bg-[#6857ea] text-white disabled:opacity-50 cursor-pointer shadow-md"
      >
        {join.isPending ? 'Entrando…' : 'Entrar no Servidor'}
      </button>
    </form>
  )
}
