import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Check, X, MessageSquare, MoreVertical, Search } from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  useFriends,
  usePendingRequests,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  type FriendUser,
  type FriendRequest,
} from '@/hooks/useFriends'
import { useCreateConversation } from '@/hooks/useConversations'
import { usePresence, getStatusLabel, getStatusColor } from '@/hooks/usePresence'

type Tab = 'online' | 'all' | 'pending' | 'add'

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>('online')
  const [search, setSearch] = useState('')

  const { data: friends = [] } = useFriends()
  const { data: pending } = usePendingRequests()
  const { isUserOnline, getUserStatus } = usePresence()

  const onlineFriends = friends.filter((f) => isUserOnline(f.id))
  const incomingCount = pending?.incoming.length ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden select-none" style={{ background: 'var(--color-bg-tertiary)' }}>
      {/* Top Navigation Header */}
      <header
        className="flex items-center justify-between px-4 h-12 shrink-0 border-b shadow-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#f2f3f5]">
            <Users size={20} className="text-[#949ba4]" />
            <span>Amigos</span>
          </div>

          <div className="h-4 w-px bg-[#3f4248]" />

          <div className="flex items-center gap-2 text-sm font-medium">
            <TabButton
              active={tab === 'online'}
              onClick={() => setTab('online')}
              label="Disponível"
            />
            <TabButton
              active={tab === 'all'}
              onClick={() => setTab('all')}
              label="Todos"
            />
            <TabButton
              active={tab === 'pending'}
              onClick={() => setTab('pending')}
              label="Pendente"
              badgeCount={incomingCount}
            />
            <button
              onClick={() => setTab('add')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                tab === 'add'
                  ? 'bg-transparent text-[#23a55a] font-bold'
                  : 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
              }`}
            >
              Adicionar amigo
            </button>
          </div>
        </div>

        {/* Right utility icons in header */}
        <div className="flex items-center gap-3 text-[#b5bac1]">
          <button title="Nova conversa em grupo" className="hover:text-white cursor-pointer transition-colors">
            <MessageSquare size={18} />
          </button>
          <div className="h-4 w-px bg-[#3f4248]" />
          <button title="Ajuda" className="hover:text-white cursor-pointer transition-colors text-sm font-bold">
            ?
          </button>
        </div>
      </header>

      {/* Main Content Area with Friends List + Active Now Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Friends View (Center) */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'add' && <AddFriendView />}

          {tab === 'pending' && (
            <PendingView
              incoming={pending?.incoming ?? []}
              outgoing={pending?.outgoing ?? []}
            />
          )}

          {(tab === 'online' || tab === 'all') && (
            <FriendsListView
              friends={tab === 'online' ? onlineFriends : friends}
              title={tab === 'online' ? `Disponível — ${onlineFriends.length}` : `Todos os amigos — ${friends.length}`}
              search={search}
              setSearch={setSearch}
              isUserOnline={isUserOnline}
              getUserStatus={getUserStatus}
            />
          )}
        </div>

        {/* Right "Ativo agora" (Active Now) Panel */}
        <aside
          className="w-80 shrink-0 hidden lg:flex flex-col border-l p-4 overflow-y-auto"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
        >
          <h2 className="text-xl font-extrabold text-[#f2f3f5] mb-4">
            Ativo agora
          </h2>

          <div className="space-y-3">
            {/* Active Now Cards */}
            <div className="p-3.5 rounded-lg border border-[#1f2023] bg-[#2b2d31] hover:bg-[#313338] transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    SA
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#f2f3f5]">
                      Saulo, Anderson e 2 outros
                    </p>
                    <p className="text-[11px] text-[#949ba4] mt-0.5">
                      🎮 AION 2 – 10h
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded bg-[#1e1f22] flex items-center justify-center text-[10px] font-bold text-sky-400 shrink-0 border border-[#3f4248]">
                  AION
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-[#1f2023] bg-[#2b2d31] hover:bg-[#313338] transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    👴🏽
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#f2f3f5]">
                      Depressivos 👴🏽
                    </p>
                    <p className="text-[11px] text-[#949ba4] mt-0.5 flex items-center gap-1">
                      <span>🔊</span> Burro com Asas
                    </p>
                  </div>
                </div>
                <div className="flex -space-x-1.5 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-amber-600 border-2 border-[#2b2d31] text-[9px] flex items-center justify-center font-bold text-white">R</div>
                  <div className="w-6 h-6 rounded-full bg-rose-600 border-2 border-[#2b2d31] text-[9px] flex items-center justify-center font-bold text-white">+2</div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-[#1f2023] bg-[#2b2d31] hover:bg-[#313338] transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-[#1e1f22] flex items-center justify-center text-[11px] font-bold text-sky-400 shrink-0 border border-[#3f4248]">
                    AION
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#f2f3f5]">
                      AION 2
                    </p>
                    <p className="text-[11px] text-[#949ba4] mt-0.5">
                      1 pessoa jogando
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
  badgeCount,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  badgeCount?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
        active
          ? 'bg-[#3f4248] text-white font-semibold'
          : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && <span className="opacity-70">({count})</span>}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span
          className="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
          style={{ background: 'var(--color-danger)', color: '#fff' }}
        >
          {badgeCount}
        </span>
      )}
    </button>
  )
}

function FriendsListView({
  friends,
  title,
  search,
  setSearch,
  isUserOnline,
  getUserStatus,
}: {
  friends: FriendUser[]
  title: string
  search: string
  setSearch: (s: string) => void
  isUserOnline: (id: string) => boolean
  getUserStatus: (id: string) => string
}) {
  const navigate = useNavigate()
  const createConversation = useCreateConversation()
  const removeFriend = useRemoveFriend()

  const filtered = friends.filter(
    (f) =>
      f.displayName.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handleOpenDm(userId: string) {
    try {
      const res = await createConversation.mutateAsync(userId)
      navigate(`/app/dm/${res.data.id}`)
    } catch (err) {
      console.error('Failed to open DM:', err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-muted)' }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar"
          className="w-full pl-9 pr-3 py-2 rounded text-sm outline-none placeholder-[#949ba4]"
          style={{
            background: '#1e1f22',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <h3 className="text-xs font-bold uppercase tracking-wider text-[#949ba4] pt-2">
        {title}
      </h3>

      {filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm font-medium text-[#f2f3f5]">
            Nenhum amigo encontrado.
          </p>
          <p className="text-xs max-w-sm mx-auto text-[#949ba4]">
            Adicione amigos pelo e-mail ou nome para vê-los online e conversar!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#35373c]/50">
          {filtered.map((friend) => {
            const online = isUserOnline(friend.id)
            const status = getUserStatus(friend.id)

            return (
              <div
                key={friend.id}
                className="flex items-center justify-between p-2.5 rounded-lg transition-colors group hover:bg-[#3f4248]/40 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar.Root className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-600">
                      <Avatar.Image src={friend.avatarUrl ?? undefined} alt={friend.displayName} className="w-full h-full object-cover" />
                      <Avatar.Fallback className="text-sm font-bold text-white">
                        {friend.displayName[0]?.toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                      style={{
                        borderColor: 'var(--color-bg-tertiary)',
                        background: getStatusColor(status),
                      }}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold leading-tight text-[#f2f3f5]">
                      {friend.displayName}
                    </p>
                    <p className="text-xs text-[#949ba4]">
                      {getStatusLabel(status)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDm(friend.id)}
                    className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#111214] text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Mensagem"
                  >
                    <MessageSquare size={17} />
                  </button>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="p-2 rounded-full hover:bg-black/20 transition-colors"
                        title="More Options"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <MoreVertical size={18} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-40 rounded p-1 shadow-lg z-50 text-sm"
                        style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
                      >
                        <DropdownMenu.Item
                          onSelect={() => removeFriend.mutate(friend.id)}
                          className="px-3 py-1.5 rounded cursor-pointer outline-none hover:bg-red-500/10 text-xs font-medium"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          Remove Friend
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PendingView({
  incoming,
  outgoing,
}: {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}) {
  const acceptRequest = useAcceptFriendRequest()
  const declineRequest = useDeclineFriendRequest()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Incoming Requests */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Incoming Friend Requests — {incoming.length}
        </h3>

        {incoming.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
            There are no pending incoming friend requests.
          </p>
        ) : (
          <div className="space-y-1">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                <div className="flex items-center gap-3">
                  <Avatar.Root className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-600">
                    <Avatar.Image src={req.user.avatarUrl ?? undefined} alt={req.user.displayName} className="w-full h-full object-cover" />
                    <Avatar.Fallback className="text-sm font-bold text-white">
                      {req.user.displayName[0]?.toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                      {req.user.displayName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Incoming Friend Request
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => acceptRequest.mutate(req.id)}
                    disabled={acceptRequest.isPending}
                    title="Accept"
                    className="p-2 rounded-full hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--color-online)', color: '#fff' }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => declineRequest.mutate(req.id)}
                    disabled={declineRequest.isPending}
                    title="Decline"
                    className="p-2 rounded-full hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--color-danger)', color: '#fff' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing Requests */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Outgoing Friend Requests — {outgoing.length}
        </h3>

        {outgoing.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
            There are no pending outgoing friend requests.
          </p>
        ) : (
          <div className="space-y-1">
            {outgoing.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                <div className="flex items-center gap-3">
                  <Avatar.Root className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-600">
                    <Avatar.Image src={req.user.avatarUrl ?? undefined} alt={req.user.displayName} className="w-full h-full object-cover" />
                    <Avatar.Fallback className="text-sm font-bold text-white">
                      {req.user.displayName[0]?.toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                      {req.user.displayName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Outgoing Friend Request
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => declineRequest.mutate(req.id)}
                  disabled={declineRequest.isPending}
                  title="Cancel"
                  className="p-2 rounded-full hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--color-bg-primary)', color: 'var(--color-danger)' }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AddFriendView() {
  const [target, setTarget] = useState('')
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const sendRequest = useSendFriendRequest()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target.trim()) return

    setStatusMessage(null)
    try {
      await sendRequest.mutateAsync(target.trim())
      setStatusMessage({ type: 'success', text: `Friend request sent to ${target.trim()}!` })
      setTarget('')
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send friend request.' })
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <h2 className="text-base font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
          Add Friend
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          You can add friends with their email or user ID.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          className="flex items-center rounded-lg p-2 border"
          style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}
        >
          <input
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              setStatusMessage(null)
            }}
            placeholder="friend@example.com or user ID"
            className="flex-1 bg-transparent text-sm outline-none px-2"
            style={{ color: 'var(--color-text-primary)' }}
            autoFocus
          />
          <button
            type="submit"
            disabled={!target.trim() || sendRequest.isPending}
            className="px-4 py-1.5 rounded font-semibold text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {sendRequest.isPending ? 'Sending...' : 'Send Friend Request'}
          </button>
        </div>

        {statusMessage && (
          <p
            className="text-xs font-medium"
            style={{
              color: statusMessage.type === 'success' ? 'var(--color-online)' : 'var(--color-danger)',
            }}
          >
            {statusMessage.text}
          </p>
        )}
      </form>
    </div>
  )
}
