/**
 * UserProfilePopover — profile card opened by clicking a user's name/avatar in chat.
 * Shows "add friend" for strangers and "message" (+ gentle nudge) for friends.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import * as Avatar from '@radix-ui/react-avatar'
import { Crown, MessageSquare, UserPlus, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useServerDetail } from '@/hooks/useServers'
import { useCreateConversation } from '@/hooks/useConversations'
import { useFriends, usePendingRequests, useSendFriendRequest } from '@/hooks/useFriends'
import { usePresenceStore, getStatusColor, getStatusLabel } from '@/stores/presenceStore'
import { toast } from '@/stores/toastStore'
import { NudgeButton } from '@/components/ui/NudgeButton'

interface Props {
  userId: string
  displayName: string
  avatarUrl?: string | null
  children: ReactNode
}

export function UserProfilePopover({ userId, displayName, avatarUrl, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-72 rounded-xl shadow-2xl bg-[#2B2D33] border border-[#3C3F48] overflow-hidden outline-none text-[#F2F3F5]"
        >
          <ProfileCard
            userId={userId}
            displayName={displayName}
            avatarUrl={avatarUrl ?? null}
            onClose={() => setOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ProfileCard({
  userId,
  displayName,
  avatarUrl,
  onClose,
}: {
  userId: string
  displayName: string
  avatarUrl: string | null
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { serverId } = useParams<{ serverId: string }>()
  const { data: server } = useServerDetail(serverId ?? null)
  const { data: friends = [] } = useFriends()
  const { data: pending } = usePendingRequests()
  const createConversation = useCreateConversation()
  const sendFriendRequest = useSendFriendRequest()

  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const presence = onlineUsers[userId.toLowerCase()] || onlineUsers[userId]
  const status = presence?.status ?? 'offline'
  const statusColor = getStatusColor(status)

  const isMe = currentUser?.id === userId
  const friend = friends.find((f) => f.id === userId)
  const isFriend = Boolean(friend)
  const requestSent =
    sendFriendRequest.isSuccess || Boolean(pending?.outgoing.some((r) => r.user.id === userId))
  const requestReceived = Boolean(pending?.incoming.some((r) => r.user.id === userId))

  const isOwner = Boolean(server && server.ownerId.toLowerCase() === userId.toLowerCase())
  const memberRole = server?.members.find((m) => m.userId.toLowerCase() === userId.toLowerCase())?.role

  async function handleMessage() {
    try {
      const conv = await createConversation.mutateAsync(userId)
      onClose()
      navigate(`/app/dm/${conv.data.id}`)
    } catch (err) {
      console.error('Failed to open DM:', err)
      toast.error('Não foi possível abrir a conversa')
    }
  }

  async function handleAddFriend() {
    try {
      await sendFriendRequest.mutateAsync(userId)
      toast.success(`Pedido de amizade enviado para ${displayName}`)
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível enviar o pedido')
    }
  }

  return (
    <>
      <div className="h-16 bg-[#7667F5]" />

      <div className="px-4 pb-4 relative">
        <div className="relative -mt-10 mb-3 w-fit">
          <Avatar.Root className="w-18 h-18 rounded-full border-4 border-[#2B2D33] overflow-hidden block bg-[#1B1C20]">
            <Avatar.Image src={avatarUrl ?? undefined} alt={displayName} className="w-full h-full object-cover" />
            <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xl font-bold text-white bg-[#7667F5]">
              {displayName[0]?.toUpperCase() ?? '?'}
            </Avatar.Fallback>
          </Avatar.Root>
          <span
            className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#2B2D33]"
            style={{ background: statusColor }}
          />
        </div>

        <div className="p-3 rounded-lg bg-[#1B1C20] border border-[#3C3F48]/40 mb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-base font-bold text-[#F2F3F5] truncate">{displayName}</p>
            {isOwner && <Crown size={14} className="text-[#F4B942] fill-[#F4B942]" />}
          </div>
          <p className="text-xs text-[#858B98]">{getStatusLabel(status)}</p>
        </div>

        {server && (isOwner || memberRole) && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B5BAC3] mb-1.5">Cargos</p>
            <div className="flex flex-wrap gap-1">
              {isOwner && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F4B942]/20 text-[#F4B942]">
                  <Crown size={11} className="fill-[#F4B942]" /> Dono
                </span>
              )}
              {memberRole && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#34363E] text-[#B5BAC3]">
                  {memberRole.name}
                </span>
              )}
            </div>
          </div>
        )}

        {isMe ? (
          <p className="pt-2 border-t border-[#3C3F48] text-xs text-[#858B98]">Este é o seu perfil.</p>
        ) : (
          <div className="pt-2 border-t border-[#3C3F48] flex gap-2">
            {isFriend ? (
              <>
                <button
                  onClick={handleMessage}
                  disabled={createConversation.isPending}
                  className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-[#7667F5] hover:bg-[#6554E6] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow disabled:opacity-50"
                >
                  <MessageSquare size={14} /> Mensagem
                </button>
                <NudgeButton friendId={userId} friendName={displayName} allowNudges={friend?.allowNudges ?? true} />
              </>
            ) : requestReceived ? (
              <p className="flex-1 text-xs text-[#B5BAC3] py-1.5">
                {displayName} te enviou um pedido de amizade. Veja na aba Amigos.
              </p>
            ) : (
              <button
                onClick={handleAddFriend}
                disabled={sendFriendRequest.isPending || requestSent}
                className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-[#7667F5] hover:bg-[#6554E6] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow disabled:opacity-60 disabled:cursor-default"
              >
                {requestSent ? (
                  <>
                    <Check size={14} /> Pedido enviado
                  </>
                ) : (
                  <>
                    <UserPlus size={14} /> Adicionar como amigo
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
