import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Check, X, MessageSquare, MoreVertical, Search, Menu, Volume2, Radio } from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'
import { useUIStore } from '@/stores/uiStore'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQueries } from '@tanstack/react-query'
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
import { useServers, apiFetch, type Category } from '@/hooks/useServers'
import { useCreateConversation } from '@/hooks/useConversations'
import { usePresence, getStatusLabel, getStatusColor, type UserPresenceInfo } from '@/hooks/usePresence'

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
    <div className="flex flex-col h-full overflow-hidden select-none bg-[#1B1C20] text-[#F2F3F5]">
      {/* Top Navigation Header */}
      <header
        className="flex items-center justify-between px-3 sm:px-4 h-12 shrink-0 border-b border-[#3C3F48]/40 shadow-sm bg-[#202127]"
      >
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
          <button
            onClick={useUIStore.getState().openMobileNav}
            className="p-1 -ml-1 text-[#858B98] hover:text-[#F2F3F5] md:hidden cursor-pointer shrink-0"
            title="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 font-bold text-sm text-[#F2F3F5] shrink-0">
            <Users size={20} className="text-[#858B98]" />
            <span>Amigos</span>
          </div>

          <div className="h-4 w-px bg-[#3C3F48]" />

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
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === 'add'
                  ? 'bg-transparent text-[#35C98A]'
                  : 'bg-[#7667F5] text-white hover:bg-[#6857ea] shadow-xs'
              }`}
            >
              Adicionar amigo
            </button>
          </div>
        </div>

        {/* Right utility icons in header */}
        <div className="flex items-center gap-3 text-[#B5BAC3]">
          <button title="Nova conversa em grupo" className="hover:text-white cursor-pointer transition-colors">
            <MessageSquare size={18} />
          </button>
          <div className="h-4 w-px bg-[#3C3F48]" />
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
              getUserStatus={getUserStatus}
            />
          )}
        </div>

        {/* Right "Ativo agora" (Active Now) Panel */}
        <ActiveNowPanel friends={friends} />
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
        active
          ? 'bg-[#34363E] text-white font-bold'
          : 'text-[#B5BAC3] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && <span className="opacity-70">({count})</span>}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span
          className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F04747] text-white"
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
  getUserStatus,
}: {
  friends: FriendUser[]
  title: string
  search: string
  setSearch: (s: string) => void
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
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#858B98] pointer-events-none"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar amigos"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm outline-none bg-[#1B1C20] text-[#F2F3F5] placeholder-[#858B98] border border-[#3C3F48]/40 focus:border-[#7667F5] transition-all"
        />
      </div>

      <h3 className="text-xs font-bold uppercase tracking-wider text-[#858B98] pt-2">
        {title}
      </h3>

      {filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm font-semibold text-[#F2F3F5]">
            Nenhum amigo encontrado.
          </p>
          <p className="text-xs max-w-sm mx-auto text-[#858B98]">
            Adicione amigos pelo e-mail ou nome para vê-los online e conversar!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#3C3F48]/30">
          {filtered.map((friend) => {
            const status = getUserStatus(friend.id)

            return (
              <div
                key={friend.id}
                className="flex items-center justify-between p-2.5 rounded-xl transition-colors group hover:bg-[#34363E]/50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar.Root className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[#2B2D33]">
                      <Avatar.Image src={friend.avatarUrl ?? undefined} alt={friend.displayName} className="w-full h-full object-cover" />
                      <Avatar.Fallback className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-[#7667F5]">
                        {friend.displayName[0]?.toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1B1C20]"
                      style={{
                        background: getStatusColor(status),
                      }}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-bold leading-tight text-[#F2F3F5]">
                      {friend.displayName}
                    </p>
                    <p className="text-xs text-[#858B98]">
                      {getStatusLabel(status)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDm(friend.id)}
                    className="w-9 h-9 rounded-full bg-[#2B2D33] hover:bg-[#3B3E47] text-[#B5BAC3] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#3C3F48]/30"
                    title="Mensagem"
                  >
                    <MessageSquare size={17} />
                  </button>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="p-2 rounded-full hover:bg-[#3B3E47] text-[#858B98] hover:text-[#F2F3F5] transition-colors cursor-pointer"
                        title="Mais opções"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-44 rounded-xl p-1.5 shadow-2xl z-50 text-xs font-semibold bg-[#2B2D33] border border-[#3C3F48]"
                      >
                        <DropdownMenu.Item
                          onSelect={() => removeFriend.mutate(friend.id)}
                          className="px-3 py-2 rounded-lg cursor-pointer outline-none hover:bg-[#F04747]/10 text-xs font-semibold text-[#F04747] transition-colors"
                        >
                          Remover Amigo
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
                className="flex items-center justify-between p-3 rounded-xl bg-[#2B2D33] border border-[#3C3F48]/40"
              >
                <div className="flex items-center gap-3">
                  <Avatar.Root className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[#1B1C20]">
                    <Avatar.Image src={req.user.avatarUrl ?? undefined} alt={req.user.displayName} className="w-full h-full object-cover" />
                    <Avatar.Fallback className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-[#7667F5]">
                      {req.user.displayName[0]?.toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div>
                    <p className="text-sm font-bold leading-tight text-[#F2F3F5]">
                      {req.user.displayName}
                    </p>
                    <p className="text-xs text-[#858B98]">
                      Solicitação recebida
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => acceptRequest.mutate(req.id)}
                    disabled={acceptRequest.isPending}
                    title="Aceitar"
                    className="p-2 rounded-full hover:bg-[#35C98A]/80 transition-colors bg-[#35C98A] text-white cursor-pointer"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => declineRequest.mutate(req.id)}
                    disabled={declineRequest.isPending}
                    title="Recusar"
                    className="p-2 rounded-full hover:bg-[#F04747]/80 transition-colors bg-[#F04747] text-white cursor-pointer"
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
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-[#858B98]">
          Solicitações enviadas — {outgoing.length}
        </h3>

        {outgoing.length === 0 ? (
          <p className="text-xs py-2 text-[#858B98]">
            Não há solicitações enviadas pendentes.
          </p>
        ) : (
          <div className="space-y-1">
            {outgoing.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#2B2D33] border border-[#3C3F48]/40"
              >
                <div className="flex items-center gap-3">
                  <Avatar.Root className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[#1B1C20]">
                    <Avatar.Image src={req.user.avatarUrl ?? undefined} alt={req.user.displayName} className="w-full h-full object-cover" />
                    <Avatar.Fallback className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-[#7667F5]">
                      {req.user.displayName[0]?.toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div>
                    <p className="text-sm font-bold leading-tight text-[#F2F3F5]">
                      {req.user.displayName}
                    </p>
                    <p className="text-xs text-[#858B98]">
                      Solicitação enviada
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
        <h2 className="text-base font-bold uppercase tracking-wide text-[#F2F3F5]">
          Adicionar Amigo
        </h2>
        <p className="text-xs mt-1 text-[#858B98]">
          Você pode adicionar amigos através do e-mail ou nome de usuário.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          className="flex items-center rounded-xl p-2 border bg-[#1B1C20] border-[#3C3F48]"
        >
          <input
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              setStatusMessage(null)
            }}
            placeholder="amigo@exemplo.com ou ID do usuário"
            className="flex-1 bg-transparent text-sm outline-none px-2 text-[#F2F3F5] placeholder-[#858B98]"
            autoFocus
          />
          <button
            type="submit"
            disabled={!target.trim() || sendRequest.isPending}
            className="px-4 py-2 rounded-lg font-bold text-xs transition-all bg-[#7667F5] hover:bg-[#6857ea] text-white disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {sendRequest.isPending ? 'Enviando...' : 'Enviar Pedido de Amizade'}
          </button>
        </div>

        {statusMessage && (
          <p
            className={`text-xs font-semibold ${
              statusMessage.type === 'success' ? 'text-[#35C98A]' : 'text-[#F04747]'
            }`}
          >
            {statusMessage.text}
          </p>
        )}
      </form>
    </div>
  )
}

function ActiveNowPanel({ friends }: { friends: FriendUser[] }) {
  const navigate = useNavigate()
  const { data: servers = [] } = useServers()
  const { onlineUsers, getUserStatus } = usePresence()
  const createConversation = useCreateConversation()

  // Query channels for all servers the user belongs to
  const serverChannelQueries = useQueries({
    queries: servers.map((s) => ({
      queryKey: ['channels', s.id],
      queryFn: () => apiFetch<Category[]>(`/api/servers/${s.id}/channels`),
      staleTime: 1000 * 30,
    })),
  })

  // Build a fast lookup map for all voice channels
  const voiceChannelMap = useMemo(() => {
    const map: Record<
      string,
      {
        channelId: string
        channelName: string
        serverId: string
        serverName: string
        serverIcon?: string | null
      }
    > = {}

    servers.forEach((server, index) => {
      const categories = serverChannelQueries[index]?.data || []
      categories.forEach((cat) => {
        cat.channels?.forEach((ch) => {
          if (ch.type === 'voice') {
            map[ch.id.toLowerCase()] = {
              channelId: ch.id,
              channelName: ch.name,
              serverId: server.id,
              serverName: server.name,
              serverIcon: server.iconUrl,
            }
          }
        })
      })
    })

    return map
  }, [servers, serverChannelQueries])

  // Group connected presence users by voice channel
  const activeVoiceChannels = useMemo(() => {
    const groups: Record<
      string,
      {
        channel: {
          channelId: string
          channelName: string
          serverId: string
          serverName: string
          serverIcon?: string | null
        }
        users: UserPresenceInfo[]
      }
    > = {}

    Object.values(onlineUsers).forEach((u) => {
      if (u.voiceChannelId) {
        const channelIdLower = String(u.voiceChannelId).toLowerCase()
        const chInfo = voiceChannelMap[channelIdLower]
        if (chInfo) {
          if (!groups[channelIdLower]) {
            groups[channelIdLower] = {
              channel: chInfo,
              users: [],
            }
          }
          groups[channelIdLower].users.push(u)
        }
      }
    })

    return Object.values(groups)
  }, [onlineUsers, voiceChannelMap])

  // Filter online/active friends
  const activeFriends = useMemo(() => {
    return friends.filter((f) => {
      const status = getUserStatus(f.id)
      return status !== 'offline' && status !== 'invisible'
    })
  }, [friends, getUserStatus])

  const hasActivity = activeVoiceChannels.length > 0 || activeFriends.length > 0

  async function handleOpenDm(userId: string) {
    try {
      const res = await createConversation.mutateAsync(userId)
      navigate(`/app/dm/${res.data.id}`)
    } catch (err) {
      console.error('Failed to open DM:', err)
    }
  }

  return (
    <aside className="w-80 shrink-0 hidden lg:flex flex-col border-l border-[#3C3F48]/40 p-4 overflow-y-auto bg-[#202127]">
      <h2 className="text-lg font-bold text-[#F2F3F5] mb-4 flex items-center justify-between">
        <span>Ativo agora</span>
        {activeVoiceChannels.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-[#35C98A] font-semibold bg-[#35C98A]/10 px-2 py-0.5 rounded-full">
            <Radio size={12} className="animate-pulse" />
            {activeVoiceChannels.length} canal de voz
          </span>
        )}
      </h2>

      {!hasActivity ? (
        <div className="flex flex-col items-center justify-center py-12 px-2 text-center text-[#858B98] space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#2B2D33] border border-[#3C3F48]/40 flex items-center justify-center text-[#858B98] mb-1">
            <Radio size={22} />
          </div>
          <p className="text-sm font-bold text-[#F2F3F5]">Por enquanto, está tudo calmo...</p>
          <p className="text-xs max-w-[200px] leading-relaxed">
            Quando membros ou amigos entrarem em canais de voz nos seus servidores, eles aparecerão aqui dinamicamente!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active Voice Channels from all servers */}
          {activeVoiceChannels.map((group) => {
            const firstUsers = group.users.slice(0, 3)
            const remainingCount = group.users.length - firstUsers.length
            const userNames = group.users.map((u) => u.displayName || 'Usuário').slice(0, 2).join(', ')
            const summary =
              remainingCount > 0
                ? `${userNames} e mais ${remainingCount}`
                : group.users.map((u) => u.displayName || 'Usuário').join(', ')

            return (
              <div
                key={group.channel.channelId}
                onClick={() =>
                  navigate(`/app/servers/${group.channel.serverId}/channels/${group.channel.channelId}`)
                }
                className="p-3.5 rounded-xl border border-[#3C3F48]/40 bg-[#2B2D33] hover:bg-[#34363E] transition-all cursor-pointer group shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#7667F5] to-indigo-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                      {group.channel.serverName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#F2F3F5] truncate group-hover:text-white">
                        {group.channel.serverName}
                      </p>
                      <p className="text-[11px] text-[#35C98A] font-semibold flex items-center gap-1 truncate mt-0.5">
                        <Volume2 size={13} className="shrink-0" />
                        <span className="truncate">{group.channel.channelName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Connected users avatar stack / badge */}
                  <div className="flex -space-x-2 shrink-0 items-center">
                    {firstUsers.map((u, i) => (
                      <div
                        key={u.userId || i}
                        className="w-7 h-7 rounded-full border-2 border-[#2B2D33] overflow-hidden bg-[#1B1C20] shrink-0"
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-[#7667F5]">
                            {u.displayName?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </div>
                    ))}
                    {remainingCount > 0 && (
                      <div className="w-7 h-7 rounded-full border-2 border-[#2B2D33] bg-[#F04747] text-[10px] font-bold text-white flex items-center justify-center shrink-0">
                        +{remainingCount}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtitle list */}
                <div className="text-[11px] text-[#858B98] truncate pt-1 border-t border-[#3C3F48]/40">
                  <span className="text-[#B5BAC3] font-medium">{summary}</span> em chamada
                </div>
              </div>
            )
          })}

          {/* Active Friends */}
          {activeFriends.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] mb-2 px-1">
                Amigos Online
              </p>
              <div className="space-y-1.5">
                {activeFriends.map((friend) => {
                  const status = getUserStatus(friend.id)
                  const statusColor = getStatusColor(status)
                  const statusLabel = getStatusLabel(status)

                  return (
                    <div
                      key={friend.id}
                      onClick={() => handleOpenDm(friend.id)}
                      className="p-2.5 rounded-xl border border-[#3C3F48]/30 bg-[#2B2D33]/60 hover:bg-[#34363E] transition-colors cursor-pointer flex items-center justify-between gap-2.5 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-[#1B1C20]">
                            <Avatar.Image src={friend.avatarUrl ?? undefined} alt={friend.displayName} className="w-full h-full object-cover" />
                            <Avatar.Fallback className="text-xs font-bold text-white bg-[#7667F5]">
                              {friend.displayName[0]?.toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#202127]"
                            style={{ background: statusColor }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#F2F3F5] truncate group-hover:text-white">
                            {friend.displayName}
                          </p>
                          <p className="text-[11px] text-[#858B98] truncate">
                            {statusLabel}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="w-7 h-7 rounded-full bg-[#1B1C20] hover:bg-[#7667F5] text-[#858B98] hover:text-white flex items-center justify-center transition-colors shrink-0"
                        title="Conversar"
                      >
                        <MessageSquare size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
