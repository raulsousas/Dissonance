import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Hash, Users } from 'lucide-react'
import { useChannel } from '@/hooks/useChannel'
import { useChannels } from '@/hooks/useServers'
import { MessageList } from '@/components/messaging/MessageList'
import { MessageInput } from '@/components/messaging/MessageInput'
import { TypingIndicator } from '@/components/messaging/TypingIndicator'
import type { Message } from '@/stores/messagingStore'

export default function ChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>()
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // Resolve channel name from server channel list
  const { data: categories = [] } = useChannels(serverId ?? null)
  const allChannels = categories.flatMap((cat: { channels: { id: string; name: string }[] }) => cat.channels)
  const currentChannel = allChannels.find((c: { id: string }) => c.id === channelId)
  const channelName = currentChannel?.name ?? channelId ?? 'channel'

  const {
    messages,
    typing,
    loadingMore,
    hasMore,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    sendTyping,
    sendStopTyping,
    loadMore,
    markRead,
  } = useChannel(channelId)

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      sendMessage({ content, replyToId })
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
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div
        className="h-12 px-4 flex items-center gap-2 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Hash size={20} style={{ color: 'var(--color-text-muted)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {channelName}
        </span>
        <div className="flex-1" />
        <button
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="Member list"
          aria-label="Toggle member list"
        >
          <Users size={20} style={{ color: 'var(--color-text-muted)' }} />
        </button>
      </div>

      {/* Message list */}
      <MessageList
        channelName={channelName}
        messages={messages}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReact={addReaction}
        onRemoveReact={removeReaction}
        onReply={handleReply}
        onVisible={markRead}
      />

      {/* Typing indicator */}
      <TypingIndicator users={typing} />

      {/* Message input */}
      <MessageInput
        channelName={channelName}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
        onSend={handleSend}
        onTyping={sendTyping}
        onStopTyping={sendStopTyping}
      />
    </div>
  )
}
