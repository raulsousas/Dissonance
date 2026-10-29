import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as Avatar from '@radix-ui/react-avatar'
import * as Popover from '@radix-ui/react-popover'
import { Pin, Search, X, Menu, Phone, Video } from 'lucide-react'
import FriendsPage from '@/pages/FriendsPage'
import { useUIStore } from '@/stores/uiStore'
import { useConversation } from '@/hooks/useConversations'
import { useDmChannel } from '@/hooks/useDmChannel'
import { usePresence } from '@/hooks/usePresence'
import { MessageList } from '@/components/messaging/MessageList'
import { MessageInput } from '@/components/messaging/MessageInput'
import { TypingIndicator } from '@/components/messaging/TypingIndicator'
import type { Message, Attachment } from '@/stores/messagingStore'
import { usePollStore } from '@/stores/pollStore'
import { CreatePollModal } from '@/components/modals/CreatePollModal'
import { PollDetailsModal } from '@/components/modals/PollDetailsModal'

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
  const [searchQuery, setSearchQuery] = useState('')
  const { isCreatePollOpen, closeCreatePoll, activePollModalId, closePollDetails } = usePollStore()

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
    pinMessage,
    unpinMessage,
    sendTyping,
    sendStopTyping,
    loadMore,
  } = useDmChannel(conversationId)

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
    ? messages.filter((m) =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        m.authorName?.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : messages

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1B1C20]">
      {/* DM Chat Header */}
      <header
        className="h-12 px-3 sm:px-4 flex items-center justify-between border-b border-[#3C3F48]/40 shrink-0 select-none shadow-sm bg-[#202127]"
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={useUIStore.getState().openMobileNav}
            className="p-1 -ml-1 text-[#858B98] hover:text-[#F2F3F5] md:hidden cursor-pointer shrink-0"
            title="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="relative shrink-0">
            <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-[#2B2D33]">
              <Avatar.Image src={recipient?.avatarUrl ?? undefined} alt={recipientName} className="w-full h-full object-cover" />
              <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-[#7667F5]">
                {recipientName[0]?.toUpperCase() ?? '?'}
              </Avatar.Fallback>
            </Avatar.Root>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#202127]"
              style={{
                background: isOnline ? '#35C98A' : '#858B98',
              }}
            />
          </div>

          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight text-[#F2F3F5]">
              {recipientName}
            </span>
            <span className="text-[11px] capitalize text-[#858B98]">
              {isOnline ? (status !== 'offline' ? status : 'Disponível') : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-[#B5BAC3]">
          <button
            title="Iniciar chamada de voz"
            className="p-1.5 rounded-lg hover:bg-[#34363E] text-[#B5BAC3] hover:text-[#F2F3F5] transition-colors cursor-pointer"
          >
            <Phone size={18} />
          </button>
          <button
            title="Iniciar chamada de vídeo"
            className="p-1.5 rounded-lg hover:bg-[#34363E] text-[#B5BAC3] hover:text-[#F2F3F5] transition-colors cursor-pointer"
          >
            <Video size={18} />
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

          {/* Quick search input */}
          <div className="relative hidden sm:block">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar na conversa`}
              className="w-36 focus:w-56 transition-all pl-2.5 pr-7 py-1 text-xs rounded-lg bg-[#1B1C20] text-[#F2F3F5] placeholder-[#858B98] outline-none border border-[#3C3F48]/40 focus:border-[#7667F5]"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-[#858B98] hover:text-white"
              >
                <X size={12} />
              </button>
            ) : (
              <Search size={13} className="absolute right-2 top-1.5 text-[#858B98] pointer-events-none" />
            )}
          </div>
        </div>
      </header>

      {/* Message list */}
      <MessageList
        channelName={recipientName}
        messages={filteredMessages}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReact={() => {}}
        onRemoveReact={() => {}}
        onReply={handleReply}
        onVisible={() => {}}
        onPin={pinMessage}
        onUnpin={unpinMessage}
        scope="dm"
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
        members={
          recipient
            ? [
                {
                  id: recipient.id,
                  displayName: recipient.displayName,
                  avatarUrl: recipient.avatarUrl,
                },
              ]
            : []
        }
      />

      {/* Interactive Polls Modals */}
      <CreatePollModal
        open={isCreatePollOpen}
        onClose={closeCreatePoll}
        channelId={conversationId}
        scope="dm"
        onPollCreated={(pollId, title) => {
          handleSend(`[POLL:${pollId}] ${title}`)
        }}
      />

      <PollDetailsModal
        pollId={activePollModalId}
        onClose={closePollDetails}
        channelName={`@${recipientName}`}
      />
    </div>
  )
}
