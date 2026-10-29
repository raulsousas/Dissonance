import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Plus, MessageSquare } from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'
import * as Dialog from '@radix-ui/react-dialog'
import { useConversations, useCreateConversation, type Conversation } from '@/hooks/useConversations'
import { useFriends, usePendingRequests } from '@/hooks/useFriends'
import { usePresence, getStatusLabel, getStatusColor } from '@/hooks/usePresence'
import { useMessagingStore } from '@/stores/messagingStore'

export default function DmSidebar() {
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const { data: conversations = [] } = useConversations()
  const { data: pendingRequests } = usePendingRequests()
  const { getUserStatus } = usePresence()
  const [newDmOpen, setNewDmOpen] = useState(false)

  const pendingCount = (pendingRequests?.incoming.length ?? 0)

  return (
    <div className="flex flex-col h-full select-none bg-[#1e1f22] text-[#dbdee1]">
      {/* Top search bar button */}
      <div className="h-13 px-3 flex items-center border-b border-[#1f2023]/40 shrink-0">
        <button
          onClick={() => setNewDmOpen(true)}
          className="w-full h-8 px-3 rounded-lg text-xs text-left transition-colors flex items-center justify-start cursor-pointer bg-[#111214] text-[#949ba4] hover:text-[#dbdee1]"
        >
          <span className="truncate text-xs font-medium">Encontre ou comece uma conversa</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {/* Friends Item */}
        <button
          onClick={() => navigate('/app/dm')}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            !conversationId
              ? 'bg-[#35373c] text-white font-semibold'
              : 'text-[#949ba4] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
          }`}
        >
          <Users size={18} className="shrink-0" />
          <span className="flex-1 text-left text-sm font-medium">Amigos</span>
          {pendingCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-[#f23f43] text-white"
            >
              {pendingCount}
            </span>
          )}
        </button>

        {/* Section Header */}
        <div className="flex items-center justify-between pt-4 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-[#949ba4] hover:text-[#dbdee1]">
          <span>Mensagens diretas</span>
          <button
            onClick={() => setNewDmOpen(true)}
            className="hover:text-white transition-colors cursor-pointer"
            title="Criar mensagem"
            aria-label="Criar mensagem"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Conversation list */}
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-xs text-center text-[#949ba4]">
            Nenhuma conversa ainda. Clique em + para iniciar uma nova conversa.
          </div>
        ) : (
          conversations.map((conv) => {
            const active = conv.id === conversationId
            const status = getUserStatus(conv.recipient.id)
            return (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                active={active}
                status={status}
                onClick={() => navigate(`/app/dm/${conv.id}`)}
              />
            )
          })
        )}
      </div>

      <NewDmModal open={newDmOpen} onClose={() => setNewDmOpen(false)} />
    </div>
  )
}

function ConversationItem({
  conversation,
  active,
  status,
  onClick,
}: {
  conversation: Conversation
  active: boolean
  status: string
  onClick: () => void
}) {
  const { recipient, lastMessage } = conversation
  const statusColor = getStatusColor(status)
  const statusLabel = getStatusLabel(status)
  const unread = useMessagingStore((s) => s.unread[conversation.id] || 0)

  return (
    <button
      onClick={onClick}
      className={`group flex items-center justify-between gap-3 w-full px-2.5 py-2 rounded text-sm transition-colors text-left cursor-pointer ${
        active
          ? 'bg-[#3f4248] text-white font-semibold'
          : unread > 0
          ? 'text-[#f2f3f5] font-semibold hover:bg-[#35373c]'
          : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative shrink-0">
          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-600">
            <Avatar.Image src={recipient.avatarUrl ?? undefined} alt={recipient.displayName} className="w-full h-full object-cover" />
            <Avatar.Fallback className="text-xs font-bold text-white">
              {recipient.displayName[0]?.toUpperCase() ?? '?'}
            </Avatar.Fallback>
          </Avatar.Root>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{
              borderColor: 'var(--color-bg-secondary)',
              background: statusColor,
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${active || unread > 0 ? 'text-white font-semibold' : 'text-[#dbdee1]'}`}>
            {recipient.displayName}
          </p>
          <p className="text-xs truncate text-[#949ba4]">
            {lastMessage?.content || statusLabel}
          </p>
        </div>
      </div>

      {unread > 0 && !active && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f23f43] text-white shrink-0 shadow animate-in fade-in zoom-in duration-150">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

function NewDmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: friends = [] } = useFriends()
  const createConversation = useCreateConversation()
  const { isUserOnline } = usePresence()
  const [search, setSearch] = useState('')

  const filtered = friends.filter((f) =>
    f.displayName.toLowerCase().includes(search.toLowerCase()) ||
    f.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSelect(userId: string) {
    try {
      const res = await createConversation.mutateAsync(userId)
      onClose()
      navigate(`/app/dm/${res.data.id}`)
    } catch (err) {
      console.error('Failed to create DM:', err)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.7)' }} />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg p-5 shadow-2xl"
          style={{ background: 'var(--color-bg-tertiary)' }}
        >
          <Dialog.Title className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Select Friend
          </Dialog.Title>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            You can start a conversation with any of your friends.
          </p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="w-full px-3 py-2 rounded text-sm outline-none mb-3"
            style={{
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
            autoFocus
          />

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                {friends.length === 0 ? 'No friends found. Add friends first!' : 'No matching friends.'}
              </p>
            ) : (
              filtered.map((friend) => {
                const online = isUserOnline(friend.id)
                return (
                  <button
                    key={friend.id}
                    onClick={() => handleSelect(friend.id)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm hover:opacity-90 transition-all text-left"
                    style={{ background: 'var(--color-bg-secondary)' }}
                  >
                    <div className="relative shrink-0">
                      <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-600">
                        <Avatar.Image src={friend.avatarUrl ?? undefined} alt={friend.displayName} className="w-full h-full object-cover" />
                        <Avatar.Fallback className="text-xs font-bold text-white">
                          {friend.displayName[0]?.toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                        style={{
                          borderColor: 'var(--color-bg-secondary)',
                          background: online ? 'var(--color-online)' : 'var(--color-text-muted)',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {friend.displayName}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {friend.email}
                      </p>
                    </div>
                    <MessageSquare size={16} style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                )
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
