/**
 * MemberPanel — right sidebar showing server members grouped by role / online status
 * with Discord-style profile popovers.
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Crown, MessageSquare, UserPlus, Check, ChevronDown, ChevronRight } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import * as Avatar from '@radix-ui/react-avatar'
import { useServerDetail } from '@/hooks/useServers'
import { usePresence, getStatusLabel, getStatusColor } from '@/hooks/usePresence'
import { useAuth } from '@/hooks/useAuth'
import { useCreateConversation } from '@/hooks/useConversations'
import { useSendFriendRequest, useFriends } from '@/hooks/useFriends'
import { NudgeButton } from '@/components/ui/NudgeButton'

interface Props {
  serverId?: string
}

export default function MemberPanel({ serverId: propServerId }: Props) {
  const { serverId: routeServerId } = useParams<{ serverId: string }>()
  const serverId = propServerId || routeServerId
  const { data: server, isLoading } = useServerDetail(serverId ?? null)
  const { isUserOnline, getUserStatus } = usePresence()

  // Track collapsed state for each section
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))
  }

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
  const moderators = onlineMembers.filter(
    (m) =>
      m.userId.toLowerCase() !== ownerId &&
      !m.role?.name?.toLowerCase().includes('admin') &&
      m.role?.name?.toLowerCase().includes('mod')
  )
  const regularOnline = onlineMembers.filter(
    (m) =>
      m.userId.toLowerCase() !== ownerId &&
      !m.role?.name?.toLowerCase().includes('admin') &&
      !m.role?.name?.toLowerCase().includes('mod')
  )

  return (
    <div className="flex flex-col h-full py-4 px-2 space-y-4 select-none overflow-y-auto">
      {/* Admins / Owner Section */}
      {ownerAndAdmins.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('admins')}
            className="flex items-center justify-between w-full px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#F4B942] hover:text-[#F8C85C] transition-colors cursor-pointer group"
          >
            <span>Dono & Admins — {ownerAndAdmins.length}</span>
            {collapsed['admins'] ? (
              <ChevronRight size={14} className="text-[#F4B942]" />
            ) : (
              <ChevronDown size={14} className="text-[#F4B942]" />
            )}
          </button>
          {!collapsed['admins'] && (
            <div className="space-y-0.5 transition-all">
              {ownerAndAdmins.map((m) => (
                <MemberItem
                  key={m.userId}
                  member={m}
                  isOwner={m.userId.toLowerCase() === ownerId}
                  status={getUserStatus(m.userId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Moderators Section */}
      {moderators.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('moderators')}
            className="flex items-center justify-between w-full px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#7667F5] hover:text-[#9084F8] transition-colors cursor-pointer group"
          >
            <span>Moderadores — {moderators.length}</span>
            {collapsed['moderators'] ? (
              <ChevronRight size={14} className="text-[#7667F5]" />
            ) : (
              <ChevronDown size={14} className="text-[#7667F5]" />
            )}
          </button>
          {!collapsed['moderators'] && (
            <div className="space-y-0.5 transition-all">
              {moderators.map((m) => (
                <MemberItem
                  key={m.userId}
                  member={m}
                  isOwner={false}
                  status={getUserStatus(m.userId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Online Members Section */}
      {regularOnline.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('online')}
            className="flex items-center justify-between w-full px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#858B98] hover:text-[#F2F3F5] transition-colors cursor-pointer group"
          >
            <span>Disponível — {regularOnline.length}</span>
            {collapsed['online'] ? (
              <ChevronRight size={14} className="text-[#858B98]" />
            ) : (
              <ChevronDown size={14} className="text-[#858B98]" />
            )}
          </button>
          {!collapsed['online'] && (
            <div className="space-y-0.5 transition-all">
              {regularOnline.map((m) => (
                <MemberItem
                  key={m.userId}
                  member={m}
                  isOwner={false}
                  status={getUserStatus(m.userId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Offline Members Section */}
      {offlineMembers.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('offline')}
            className="flex items-center justify-between w-full px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#858B98] hover:text-[#F2F3F5] transition-colors cursor-pointer group"
          >
            <span>Offline — {offlineMembers.length}</span>
            {collapsed['offline'] ? (
              <ChevronRight size={14} className="text-[#858B98]" />
            ) : (
              <ChevronDown size={14} className="text-[#858B98]" />
            )}
          </button>
          {!collapsed['offline'] && (
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
          )}
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
  const friend = friends.find((f) => f.id === member.userId)
  const isFriend = Boolean(friend)
  const statusColor = getStatusColor(status)

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
          className="group flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#3B3E47]/50 transition-colors cursor-pointer text-left"
        >
          {/* Avatar with Status Dot */}
          <div className="relative shrink-0">
            <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden block bg-[#2B2D33]">
              <Avatar.Image
                src={member.avatarUrl ?? undefined}
                alt={member.displayName}
                className="w-full h-full object-cover"
              />
              <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xs font-semibold text-white bg-[#7667F5]">
                {member.displayName[0]?.toUpperCase() ?? '?'}
              </Avatar.Fallback>
            </Avatar.Root>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: statusColor,
                borderColor: '#202127',
              }}
            />
          </div>

          {/* Name & Owner Crown */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={`text-xs font-medium truncate ${
                isOwner ? 'text-[#F4B942]' : 'text-[#B5BAC3] group-hover:text-[#F2F3F5]'
              }`}
            >
              {member.displayName}
            </span>
            {isOwner && (
              <span title="Dono do servidor" className="flex items-center">
                <Crown
                  size={13}
                  className="text-[#F4B942] shrink-0 fill-[#F4B942]"
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
          className="z-50 w-72 rounded-xl shadow-2xl bg-[#2B2D33] border border-[#3C3F48] overflow-hidden outline-none text-[#F2F3F5]"
        >
          {/* Top Banner */}
          <div className="h-16 bg-[#7667F5]" />

          {/* Profile Header */}
          <div className="px-4 pb-4 relative">
            <div className="relative -mt-10 mb-3">
              <Avatar.Root className="w-18 h-18 rounded-full border-4 border-[#2B2D33] overflow-hidden block bg-[#1B1C20]">
                <Avatar.Image
                  src={member.avatarUrl ?? undefined}
                  alt={member.displayName}
                  className="w-full h-full object-cover"
                />
                <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xl font-bold text-white bg-[#7667F5]">
                  {member.displayName[0]?.toUpperCase() ?? '?'}
                </Avatar.Fallback>
              </Avatar.Root>
              <span
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#2B2D33]"
                style={{ background: statusColor }}
              />
            </div>

            <div className="p-3 rounded-lg bg-[#1B1C20] border border-[#3C3F48]/40 mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-base font-bold text-[#F2F3F5] truncate">
                  {member.displayName}
                </p>
                {isOwner && <Crown size={14} className="text-[#F4B942] fill-[#F4B942]" />}
              </div>
              <p className="text-xs text-[#858B98]">
                {getStatusLabel(status)}
              </p>
            </div>

            {/* Roles */}
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#B5BAC3] mb-1.5">
                Cargos
              </p>
              <div className="flex flex-wrap gap-1">
                {isOwner && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F4B942]/20 text-[#F4B942]">
                    <Crown size={11} className="fill-[#F4B942]" /> Dono
                  </span>
                )}
                {member.role && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#34363E] text-[#B5BAC3]">
                    {member.role.name}
                  </span>
                )}
                {!isOwner && !member.role && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#34363E] text-[#858B98]">
                    Membro
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {!isMe && (
              <div className="pt-2 border-t border-[#3C3F48] flex gap-2">
                <button
                  onClick={handleStartDm}
                  className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-[#7667F5] hover:bg-[#6554E6] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
                >
                  <MessageSquare size={14} /> Mensagem
                </button>
                {isFriend && (
                  <NudgeButton
                    friendId={member.userId}
                    friendName={member.displayName}
                    allowNudges={friend?.allowNudges ?? true}
                  />
                )}
                {!isFriend && (
                  <button
                    onClick={handleAddFriend}
                    disabled={sendFriendRequest.isPending || sendFriendRequest.isSuccess}
                    className="py-1.5 px-3 rounded text-xs font-semibold bg-[#34363E] hover:bg-[#3B3E47] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {sendFriendRequest.isSuccess ? (
                      <>
                        <Check size={14} className="text-[#35C98A]" /> Enviado
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
