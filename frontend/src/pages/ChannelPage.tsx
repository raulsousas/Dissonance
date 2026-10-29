import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { Hash, Users, Pin, X, Menu } from 'lucide-react'
import { useChannel } from '@/hooks/useChannel'
import { useUIStore } from '@/stores/uiStore'
import { useChannels, useServerDetail } from '@/hooks/useServers'
import { MessageList } from '@/components/messaging/MessageList'
import { MessageInput } from '@/components/messaging/MessageInput'
import { MessageSearch } from '@/components/messaging/MessageSearch'
import { FocusSummaryBanner } from '@/components/messaging/FocusSummaryBanner'
import { TypingIndicator } from '@/components/messaging/TypingIndicator'
import { VoiceChannelPanel } from '@/components/voice/VoiceChannelPanel'
import type { Message, Attachment } from '@/stores/messagingStore'
import { usePollStore } from '@/stores/pollStore'
import { CreatePollModal } from '@/components/modals/CreatePollModal'
import { PollDetailsModal } from '@/components/modals/PollDetailsModal'
import { PollsChannelView } from '@/components/polls/PollsChannelView'

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

  if (currentChannel?.type === 'polls') {
    return <PollsChannelView channelId={channelId} channelName={channelName} />
  }

  return (
    <TextChannelView
      serverId={serverId}
      channelId={channelId}
      channelName={channelName}
      channels={allChannels.filter((c: { type: string }) => c.type !== 'polls')}
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

  const { data: serverDetail } = useServerDetail(serverId)
  const members =
    serverDetail?.members?.map((m) => ({
      id: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
    })) ?? []


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

  const { openMobileNav, toggleMobileMembers } = useUIStore()
  const { isCreatePollOpen, closeCreatePoll, activePollModalId, closePollDetails } = usePollStore()

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div
        className="h-12 px-3 sm:px-4 flex items-center justify-between border-b border-[#3C3F48]/40 shrink-0 shadow-sm select-none bg-[#202127]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={openMobileNav}
            className="p-1 -ml-1 text-[#858B98] hover:text-[#F2F3F5] md:hidden cursor-pointer shrink-0"
            title="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <Hash size={22} className="text-[#858B98] shrink-0" />
          <span className="font-bold text-sm text-[#F2F3F5] truncate">
            {channelName}
          </span>
        </div>

        {/* Right utility icons in channel header */}
        <div className="flex items-center gap-2 sm:gap-3 text-[#B5BAC3] shrink-0">
          <button
            onClick={toggleMobileMembers}
            className="p-1 text-[#858B98] hover:text-[#F2F3F5] md:hidden cursor-pointer"
            title="Membros"
          >
            <Users size={20} />
          </button>
          {/* Pinned Messages Popover */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                title="Mensagens fixadas"
                className={`hover:text-white cursor-pointer transition-colors p-1.5 rounded relative ${
                  pinnedMessages.length > 0 ? 'text-[#F4B942]' : ''
                }`}
              >
                <Pin size={18} className={pinnedMessages.length > 0 ? 'fill-current' : ''} />
                {pinnedMessages.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#7667F5] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {pinnedMessages.length}
                  </span>
                )}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                className="w-80 max-h-96 bg-[#2B2D33] rounded-xl shadow-2xl border border-[#3C3F48] p-4 text-xs z-50 text-[#F2F3F5] flex flex-col space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[#3C3F48] pb-2 font-bold text-sm text-[#F2F3F5]">
                  <span className="flex items-center gap-1.5">
                    <Pin size={15} className="text-[#F4B942] fill-current" /> Mensagens Fixadas ({pinnedMessages.length})
                  </span>
                </div>
                <div className="overflow-y-auto space-y-2 max-h-64 py-1">
                  {pinnedMessages.length === 0 ? (
                    <p className="text-center py-6 text-[#858B98]">Nenhuma mensagem fixada ainda.</p>
                  ) : (
                    pinnedMessages.map((m) => (
                      <div key={m.id} className="p-2.5 rounded-lg bg-[#1B1C20] border border-[#3C3F48]/40 space-y-1">
                        <div className="flex items-center justify-between font-semibold text-[#F2F3F5]">
                          <span className="text-xs text-[#28A9F5]">{m.authorName || 'Membro'}</span>
                          <button
                            onClick={() => unpinMessage(m.id)}
                            className="text-[#858B98] hover:text-[#F04747] p-1 rounded transition-colors cursor-pointer"
                            title="Desafixar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className="text-[#B5BAC3] text-xs line-clamp-3">{m.content || '[Anexo / Imagem]'}</p>
                      </div>
                    ))
                  )}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <MessageSearch serverId={serverId} channelId={channelId} channelName={channelName} />
        </div>
      </div>

      {/* Focus mode: summary of what was missed while this channel was silenced */}
      <FocusSummaryBanner channelId={channelId} />

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

      {/* Interactive Polls Modals */}
      <CreatePollModal
        open={isCreatePollOpen}
        onClose={closeCreatePoll}
        channelId={channelId ?? ''}
        scope="channel"
        onPollCreated={(pollId, title) => {
          handleSend(`[POLL:${pollId}] ${title}`)
        }}
      />

      <PollDetailsModal
        pollId={activePollModalId}
        onClose={closePollDetails}
        channelName={channelName}
      />
    </div>
  )
}
