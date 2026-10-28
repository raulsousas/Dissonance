import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as Avatar from '@radix-ui/react-avatar'
import FriendsPage from '@/pages/FriendsPage'
import { useConversation } from '@/hooks/useConversations'
import { useDmChannel } from '@/hooks/useDmChannel'
import { usePresence } from '@/hooks/usePresence'
import { MessageList } from '@/components/messaging/MessageList'
import { MessageInput } from '@/components/messaging/MessageInput'
import { TypingIndicator } from '@/components/messaging/TypingIndicator'
import type { Message } from '@/stores/messagingStore'

export default function DmPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()

  if (!conversationId) {
    return <FriendsPage />
  }

  return <DmChatView conversationId={conversationId} />
}

function DmChatView({ conversationId }: { conversationId: string }) {
  const { data: conversation } = useConversation(conversationId)
  const { isUserOnline, getUserStatus } = usePresence()
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  const recipient = conversation?.recipient
  const recipientName = recipient?.displayName ?? 'Friend'
  const isOnline = recipient ? isUserOnline(recipient.id) : false
  const status = recipient ? getUserStatus(recipient.id) : 'offline'

  const {
    messages,
    typing,
    loadingMore,
    hasMore,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    sendStopTyping,
    loadMore,
  } = useDmChannel(conversationId)

  const handleSend = useCallback(
    (content: string) => {
      sendMessage({ content })
    },
    [sendMessage]
  )

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg)
  }, [])

  const handleCancelReply = useCallback(() => {
    setReplyTo(null)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
      {/* DM Chat Header */}
      <header
        className="h-12 px-4 flex items-center gap-3 border-b shrink-0 select-none shadow-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
      >
        <div className="relative shrink-0">
          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-600">
            <Avatar.Image src={recipient?.avatarUrl ?? undefined} alt={recipientName} className="w-full h-full object-cover" />
            <Avatar.Fallback className="text-xs font-bold text-white">
              {recipientName[0]?.toUpperCase() ?? '?'}
            </Avatar.Fallback>
          </Avatar.Root>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{
              borderColor: 'var(--color-bg-secondary)',
              background: isOnline ? 'var(--color-online)' : 'var(--color-text-muted)',
            }}
          />
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {recipientName}
          </span>
          <span className="text-[11px] capitalize" style={{ color: 'var(--color-text-muted)' }}>
            {isOnline ? (status !== 'offline' ? status : 'Online') : 'Offline'}
          </span>
        </div>
      </header>

      {/* Message list */}
      <MessageList
        channelName={recipientName}
        messages={messages}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReact={() => {}}
        onRemoveReact={() => {}}
        onReply={handleReply}
        onVisible={() => {}}
      />

      {/* Typing indicator */}
      <TypingIndicator users={typing} />

      {/* Message input */}
      <MessageInput
        channelName={`@${recipientName}`}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
        onSend={handleSend}
        onTyping={sendTyping}
        onStopTyping={sendStopTyping}
      />
    </div>
  )
}
