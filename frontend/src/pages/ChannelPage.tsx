import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { Hash, Users, Pin, Search, Bell, Inbox, HelpCircle, X } from 'lucide-react'
import { useChannel } from '@/hooks/useChannel'
import { useChannels, useServerDetail } from '@/hooks/useServers'
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

  return (
    <TextChannelView
      serverId={serverId}
      channelId={channelId}
      channelName={channelName}
      channels={allChannels}
    />
  )
}

function TextChannelView({
  serverId,
  channelId,
  channelName,
  channels,
}: {
  serverId: string
  channelId: string
  channelName: string
  channels: { id: string; name: string; type: string }[]
}) {
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: serverDetail } = useServerDetail(serverId)
  const members =
    serverDetail?.members?.map((m) => ({
      id: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
    })) ?? []

  const [searchFocused, setSearchFocused] = useState(false)

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
    pinMessage,
    unpinMessage,
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

  const pinnedMessages = messages.filter((m) => m.pinned)

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const tokens = searchQuery.trim().split(/\s+/)
        return tokens.every((token) => {
          if (token.startsWith('from:')) {
            const author = token.slice(5).toLowerCase()
            return m.authorName?.toLowerCase().includes(author)
          }
          if (token === 'has:link') {
            return Boolean(m.content?.match(/https?:\/\/|www\./i))
          }
          if (token === 'has:image' || token === 'has:file') {
            return Boolean(
              (m.attachments && m.attachments.length > 0) ||
              m.content?.match(/\.(png|jpe?g|gif|webp)/i)
            )
          }
          if (token === 'pinned:true' || token === 'is:pinned') {
            return Boolean(m.pinned)
          }
          const lower = token.toLowerCase()
          return (
            m.content?.toLowerCase().includes(lower) ||
            m.authorName?.toLowerCase().includes(lower)
          )
        })
      })
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
                className={`hover:text-white cursor-pointer transition-colors p-1.5 rounded relative ${
                  pinnedMessages.length > 0 ? 'text-[#f0b232]' : ''
                }`}
              >
                <Pin size={18} className={pinnedMessages.length > 0 ? 'fill-current' : ''} />
                {pinnedMessages.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#5865f2] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {pinnedMessages.length}
                  </span>
                )}
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
                    <Pin size={15} className="text-[#f0b232] fill-current" /> Mensagens Fixadas ({pinnedMessages.length})
                  </span>
                </div>
                <div className="overflow-y-auto space-y-2 max-h-64 py-1">
                  {pinnedMessages.length === 0 ? (
                    <p className="text-center py-6 text-[#949ba4]">Nenhuma mensagem fixada ainda.</p>
                  ) : (
                    pinnedMessages.map((m) => (
                      <div key={m.id} className="p-2.5 rounded bg-[#1e1f22] border border-[#232428] space-y-1">
                        <div className="flex items-center justify-between font-semibold text-[#f2f3f5]">
                          <span className="text-xs text-[#00a8fc]">{m.authorName || 'Membro'}</span>
                          <button
                            onClick={() => unpinMessage(m.id)}
                            className="text-[#949ba4] hover:text-[#f23f43] p-1 rounded transition-colors cursor-pointer"
                            title="Desafixar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className="text-[#dbdee1] text-xs line-clamp-3">{m.content || '[Anexo / Imagem]'}</p>
                      </div>
                    ))
                  )}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Quick search input with filter helper */}
          <div className="relative hidden sm:block">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder={`Buscar em #${channelName}`}
              className="w-44 focus:w-64 transition-all pl-2.5 pr-7 py-1 text-xs rounded bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] outline-none border border-[#1e1f22] focus:border-[#5865f2]"
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

            {/* Search filter helper popover */}
            {searchFocused && !searchQuery && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#2b2d31] rounded-lg shadow-2xl border border-[#1f2023] p-2 z-50 text-[11px] text-[#dbdee1] space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-[#949ba4] tracking-wider block px-1">
                  Filtros de Busca
                </span>
                <div className="space-y-1">
                  <button
                    type="button"
                    onMouseDown={() => setSearchQuery('from:')}
                    className="w-full text-left px-2 py-1 rounded hover:bg-[#35373c] flex items-center justify-between cursor-pointer"
                  >
                    <span><strong className="text-[#00a8fc]">from:</strong> autor</span>
                    <span className="text-[10px] text-[#949ba4]">de um usuário</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => setSearchQuery('has:link')}
                    className="w-full text-left px-2 py-1 rounded hover:bg-[#35373c] flex items-center justify-between cursor-pointer"
                  >
                    <span><strong className="text-[#23a55a]">has:link</strong></span>
                    <span className="text-[10px] text-[#949ba4]">com links</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => setSearchQuery('has:image')}
                    className="w-full text-left px-2 py-1 rounded hover:bg-[#35373c] flex items-center justify-between cursor-pointer"
                  >
                    <span><strong className="text-[#f0b232]">has:image</strong></span>
                    <span className="text-[10px] text-[#949ba4]">com imagens</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => setSearchQuery('is:pinned')}
                    className="w-full text-left px-2 py-1 rounded hover:bg-[#35373c] flex items-center justify-between cursor-pointer"
                  >
                    <span><strong className="text-[#f23f43]">is:pinned</strong></span>
                    <span className="text-[10px] text-[#949ba4]">mensagens fixadas</span>
                  </button>
                </div>
              </div>
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
        onPin={pinMessage}
        onUnpin={unpinMessage}
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
        members={members}
        channels={channels}
      />
    </div>
  )
}
