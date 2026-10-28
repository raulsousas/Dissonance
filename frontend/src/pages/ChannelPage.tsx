import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Hash, Users } from 'lucide-react'
import { useChannel } from '@/hooks/useChannel'
import { useChannels } from '@/hooks/useServers'
import { MessageList } from '@/components/messaging/MessageList'
import { MessageInput } from '@/components/messaging/MessageInput'
import { TypingIndicator } from '@/components/messaging/TypingIndicator'
import { VoiceChannelPanel } from '@/components/voice/VoiceChannelPanel'
import type { Message, Attachment } from '@/stores/messagingStore'

export default function ChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>()

  // Resolve channel name and type from server channel list
  const { data: categories = [] } = useChannels(serverId ?? null)
  const allChannels = categories.flatMap((cat: { channels: { id: string; name: string; type: string }[] }) => cat.channels)
  const currentChannel = allChannels.find((c: { id: string }) => c.id === channelId)
  const channelName = currentChannel?.name ?? channelId ?? 'channel'
  const isVoice = currentChannel?.type === 'voice'

  if (!channelId || !serverId) return null

  if (isVoice) {
    return <VoiceChannelPanel channelId={channelId} serverId={serverId} channelName={channelName} />
  }

  return <TextChannelView channelId={channelId} channelName={channelName} />
}

function TextChannelView({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [replyTo, setReplyTo] = useState<Message | null>(null)

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
    (content: string, replyToId?: string, attachments?: Attachment[], files?: File[]) => {
      sendMessage({ content, replyToId, attachments, files })
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
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 shadow-sm"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
      >
        <div className="flex items-center gap-2">
          <Hash size={22} className="text-[#80848e]" />
          <span className="font-bold text-sm text-[#f2f3f5]">
            {channelName}
          </span>
        </div>

        {/* Right utility icons in channel header */}
        <div className="flex items-center gap-3 text-[#b5bac1]">
          <button title="Notificações" className="hover:text-white cursor-pointer transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </button>
          <button title="Mensagens fixadas" className="hover:text-white cursor-pointer transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
          </button>
          <button
            className="p-1 rounded text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
            title="Lista de membros"
            aria-label="Toggle member list"
          >
            <Users size={18} />
          </button>

          {/* Quick search input in server header */}
          <div className="relative hidden sm:block">
            <input
              placeholder={`Buscar`}
              className="w-36 focus:w-60 transition-all px-2 py-1 text-xs rounded bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] outline-none"
            />
            <span className="absolute right-2 top-1.5 text-[#949ba4] pointer-events-none">
              🔍
            </span>
          </div>

          <button title="Caixa de entrada" className="hover:text-white cursor-pointer transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
          </button>
          <button title="Ajuda" className="hover:text-white cursor-pointer transition-colors text-sm font-bold p-1">
            ?
          </button>
        </div>
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
