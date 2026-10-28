import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { Hash, Users, Pin, Search, Bell, Inbox, HelpCircle, X } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredMessages = searchQuery.trim()
    ? messages.filter(
        (m) =>
          m.content?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          m.authorName?.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : messages

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 shadow-sm select-none"
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
          {/* Pinned Messages Popover */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                title="Mensagens fixadas"
                className="hover:text-white cursor-pointer transition-colors p-1 rounded"
              >
                <Pin size={18} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                className="w-80 max-h-96 bg-[#2b2d31] rounded-xl shadow-2xl border border-[#1f2023] p-4 text-xs z-50 text-[#dbdee1] flex flex-col space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[#1f2023] pb-2 font-bold text-sm text-[#f2f3f5]">
                  <span className="flex items-center gap-1.5">
                    <Pin size={15} className="text-[#5865f2]" /> Mensagens Fixadas
                  </span>
                </div>
                <div className="overflow-y-auto space-y-2 max-h-64 py-1">
                  {messages.length === 0 ? (
                    <p className="text-center py-6 text-[#949ba4]">Nenhuma mensagem fixada ainda.</p>
                  ) : (
                    messages.slice(0, 3).map((m) => (
                      <div key={m.id} className="p-2.5 rounded bg-[#1e1f22] border border-[#232428] space-y-1">
                        <div className="flex items-center justify-between font-semibold text-[#f2f3f5]">
                          <span>{m.authorName || 'Membro'}</span>
                        </div>
                        <p className="text-[#dbdee1] truncate">{m.content || '[Anexo / Imagem]'}</p>
                      </div>
                    ))
                  )}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Quick search input in server header */}
          <div className="relative hidden sm:block">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar em #${channelName}`}
              className="w-40 focus:w-64 transition-all pl-2.5 pr-7 py-1 text-xs rounded bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] outline-none border border-[#1e1f22] focus:border-[#5865f2]"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-[#949ba4] hover:text-white"
              >
                <X size={12} />
              </button>
            ) : (
              <Search size={13} className="absolute right-2 top-1.5 text-[#949ba4] pointer-events-none" />
            )}
          </div>
        </div>
      </div>

      {/* Message list */}
      <MessageList
        channelName={channelName}
        messages={filteredMessages}
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
