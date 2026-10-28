/**
 * MemberPanel — right sidebar showing server members grouped by role / online status
 * with Discord-style profile popovers.
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Crown, MessageSquare, UserPlus, Check } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import * as Avatar from '@radix-ui/react-avatar'
import { useServerDetail } from '@/hooks/useServers'
import { usePresence } from '@/hooks/usePresence'
import { useAuth } from '@/hooks/useAuth'
import { useCreateConversation } from '@/hooks/useConversations'
import { useSendFriendRequest, useFriends } from '@/hooks/useFriends'

interface Props {
  serverId?: string
}

const STATUS_COLORS: Record<string, string> = {
  online: '#23a55a',
  away: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
}

export default function MemberPanel({ serverId: propServerId }: Props) {
  const { serverId: routeServerId } = useParams<{ serverId: string }>()
  const serverId = propServerId || routeServerId
  const { data: server, isLoading } = useServerDetail(serverId ?? null)
  const { onlineUsers, isUserOnline } = usePresence()

  if (!serverId || !server) {
    if (isLoading) {
      return (
        <div className="p-4 space-y-3">
          <div className="h-4 w-20 bg-[#2b2d31] rounded animate-pulse" />
          <div className="h-8 w-full bg-[#2b2d31] rounded animate-pulse" />
          <div className="h-8 w-full bg-[#2b2d31] rounded animate-pulse" />
        </div>
      )
    }
    return null
  }

  const members = server.members || []
  const ownerId = server.ownerId?.toLowerCase()

  // Categorize members
  const onlineMembers: typeof members = []
  const offlineMembers: typeof members = []

  members.forEach((m) => {
    if (isUserOnline(m.userId)) {
      onlineMembers.push(m)
    } else {
      offlineMembers.push(m)
    }
  })

  // Separate owner/admins from other online
  const ownerAndAdmins = onlineMembers.filter(
    (m) => m.userId.toLowerCase() === ownerId || m.role?.name?.toLowerCase().includes('admin')
  )
  const regularOnline = onlineMembers.filter(
    (m) => m.userId.toLowerCase() !== ownerId && !m.role?.name?.toLowerCase().includes('admin')
  )

  return (
    <div className="flex flex-col h-full py-4 px-2 space-y-4 select-none">
      {/* Admins / Owner Section */}
      {ownerAndAdmins.length > 0 && (
        <div>
          <h4 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            Dono & Admins — {ownerAndAdmins.length}
          </h4>
          <div className="space-y-0.5">
            {ownerAndAdmins.map((m) => (
              <MemberItem
                key={m.userId}
                member={m}
                isOwner={m.userId.toLowerCase() === ownerId}
                status={onlineUsers[m.userId]?.status || 'online'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Online Members Section */}
      {regularOnline.length > 0 && (
        <div>
          <h4 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            Disponível — {regularOnline.length}
          </h4>
          <div className="space-y-0.5">
            {regularOnline.map((m) => (
              <MemberItem
                key={m.userId}
                member={m}
                isOwner={false}
                status={onlineUsers[m.userId]?.status || 'online'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Offline Members Section */}
      {offlineMembers.length > 0 && (
        <div>
          <h4 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
            Offline — {offlineMembers.length}
          </h4>
          <div className="space-y-0.5 opacity-60 hover:opacity-100 transition-opacity">
            {offlineMembers.map((m) => (
              <MemberItem
                key={m.userId}
                member={m}
                isOwner={m.userId.toLowerCase() === ownerId}
                status="offline"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MemberItem({
  member,
  isOwner,
  status,
}: {
  member: {
    userId: string
    displayName: string
    avatarUrl: string | null
    role: { id: string; name: string } | null
  }
  isOwner: boolean
  status: string
}) {
  const [open, setOpen] = useState(false)
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const createConversation = useCreateConversation()
  const sendFriendRequest = useSendFriendRequest()
  const { data: friends = [] } = useFriends()

  const isMe = currentUser?.id === member.userId
  const isFriend = friends.some((f) => f.id === member.userId)
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline

  async function handleStartDm() {
    setOpen(false)
    try {
      const conv = await createConversation.mutateAsync(member.userId)
      navigate(`/app/dm/${conv.data.id}`)
    } catch (err) {
      console.error('Failed to open DM:', err)
    }
  }

  async function handleAddFriend() {
    try {
      await sendFriendRequest.mutateAsync(member.userId)
    } catch (err) {
      console.error('Failed to send friend request:', err)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="group flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-[#35373c] transition-colors cursor-pointer text-left"
        >
          {/* Avatar with Status Dot */}
          <div className="relative shrink-0">
            <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden block bg-[#2b2d31]">
              <Avatar.Image
                src={member.avatarUrl ?? undefined}
                alt={member.displayName}
                className="w-full h-full object-cover"
              />
              <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xs font-semibold text-white bg-[#5865f2]">
                {member.displayName[0]?.toUpperCase() ?? '?'}
              </Avatar.Fallback>
            </Avatar.Root>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: statusColor,
                borderColor: 'var(--color-bg-secondary)',
              }}
            />
          </div>

          {/* Name & Owner Crown */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={`text-xs font-medium truncate ${
                isOwner ? 'text-[#f0b232]' : 'text-[#dbdee1]'
              }`}
            >
              {member.displayName}
            </span>
            {isOwner && (
              <span title="Dono do servidor" className="flex items-center">
                <Crown
                  size={13}
                  className="text-[#f0b232] shrink-0 fill-[#f0b232]"
                />
              </span>
            )}
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          className="z-50 w-72 rounded-xl shadow-2xl bg-[#232428] border border-[#1f2023] overflow-hidden outline-none text-[#dbdee1]"
        >
          {/* Top Banner */}
          <div className="h-16 bg-[#5865f2]" />

          {/* Profile Header */}
          <div className="px-4 pb-4 relative">
            <div className="relative -mt-10 mb-3">
              <Avatar.Root className="w-18 h-18 rounded-full border-4 border-[#232428] overflow-hidden block bg-[#1e1f22]">
                <Avatar.Image
                  src={member.avatarUrl ?? undefined}
                  alt={member.displayName}
                  className="w-full h-full object-cover"
                />
                <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xl font-bold text-white bg-[#5865f2]">
                  {member.displayName[0]?.toUpperCase() ?? '?'}
                </Avatar.Fallback>
              </Avatar.Root>
              <span
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#232428]"
                style={{ background: statusColor }}
              />
            </div>

            <div className="p-3 rounded-lg bg-[#111214] mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-base font-bold text-[#f2f3f5] truncate">
                  {member.displayName}
                </p>
                {isOwner && <Crown size={14} className="text-[#f0b232] fill-[#f0b232]" />}
              </div>
              <p className="text-xs text-[#949ba4] capitalize">
                {status === 'online' ? 'Disponível' : status === 'offline' ? 'Offline' : status}
              </p>
            </div>

            {/* Roles */}
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#b5bac1] mb-1.5">
                Cargos
              </p>
              <div className="flex flex-wrap gap-1">
                {isOwner && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#f0b232]/20 text-[#f0b232]">
                    <Crown size={11} className="fill-[#f0b232]" /> Dono
                  </span>
                )}
                {member.role && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#2b2d31] text-[#dbdee1]">
                    {member.role.name}
                  </span>
                )}
                {!isOwner && !member.role && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#2b2d31] text-[#949ba4]">
                    Membro
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {!isMe && (
              <div className="pt-2 border-t border-[#35373c] flex gap-2">
                <button
                  onClick={handleStartDm}
                  className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-[#5865f2] hover:bg-[#4752c4] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageSquare size={14} /> Mensagem
                </button>
                {!isFriend && (
                  <button
                    onClick={handleAddFriend}
                    disabled={sendFriendRequest.isPending || sendFriendRequest.isSuccess}
                    className="py-1.5 px-3 rounded text-xs font-semibold bg-[#2b2d31] hover:bg-[#35373c] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {sendFriendRequest.isSuccess ? (
                      <>
                        <Check size={14} className="text-[#23a55a]" /> Enviado
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> Amigo
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
