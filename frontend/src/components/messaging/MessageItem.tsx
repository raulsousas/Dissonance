/**
 * MessageItem — renders a single message with avatar, name, timestamp,
 * content, edit/delete context menu, reactions, and reply preview.
 */

import { useState, useRef } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, Trash2, Reply, CornerUpLeft, Check, X, FileText, Download, Pin, BellRing, ChevronRight } from 'lucide-react'
import type { Message, Attachment } from '@/stores/messagingStore'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/stores/toastStore'
import { createReminder, reminderErrorMessage, reminderPresets } from '@/lib/reminders'
import { FormattedMessage } from './FormattedMessage'
import { PollMessageCard } from './PollMessageCard'
import { UserProfilePopover } from './UserProfilePopover'
import { usePollStore } from '@/stores/pollStore'
// currentUser from useAuth has camelCase fields

interface Props {
  message: Message
  repliedMessage?: Message | null
  isHighlighted?: boolean
  onScrollToMessage?: (id: string) => void
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  onReact: (id: string, emoji: string) => void
  onRemoveReact: (id: string, emoji: string) => void
  onReply: (message: Message) => void
  onPin?: (id: string) => void
  onUnpin?: (id: string) => void
  /** Whether the message belongs to a server channel (default) or a DM conversation. */
  scope?: 'channel' | 'dm'
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return `Hoje às ${formatTime(iso)}`
  if (d.toDateString() === yesterday.toDateString()) return `Ontem às ${formatTime(iso)}`
  return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${formatTime(iso)}`
}

/** Server greeting for a new member: a system-style line, not a chat bubble. */
function WelcomeMessage({ message, isHighlighted }: { message: Message; isHighlighted?: boolean }) {
  return (
    <div
      id={`message-${message.id}`}
      className={`mx-4 my-1 px-3 py-2 flex items-center gap-3 rounded-lg border border-[#7667F5]/30 bg-[#7667F5]/[0.08] transition-all duration-300 ${
        isHighlighted ? 'ring-2 ring-[#7667F5]' : ''
      }`}
    >
      <span className="text-lg shrink-0" aria-hidden="true">👋</span>
      <div className="min-w-0 flex-1 text-sm text-[#F2F3F5]">
        <FormattedMessage content={message.content} />
      </div>
      <span className="text-[11px] text-[#858B98] shrink-0">{formatTime(message.insertedAt)}</span>
    </div>
  )
}

export function MessageItem({
  message,
  repliedMessage,
  isHighlighted,
  onScrollToMessage,
  onEdit,
  onDelete,
  onReact,
  onRemoveReact,
  onReply,
  onPin,
  onUnpin,
  scope = 'channel',
}: Props) {
  const { currentUser: user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const isAuthor = user?.id === message.authorId
  const initials = message.authorName?.[0]?.toUpperCase() ?? '?'

  async function handleRemind(at: Date, label: string) {
    const result = await createReminder({ scope, messageId: message.id, remindAt: at })
    if (result.ok) {
      toast.success('Lembrete criado', label)
    } else {
      toast.error(reminderErrorMessage(result.status))
    }
  }

  function handleEditSubmit() {
    const trimmed = editContent.trim()
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed)
    }
    setEditing(false)
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setEditContent(message.content)
    }
  }

  const myReactions = new Set(
    message.reactions.filter((r) => r.userIds.includes(user?.id ?? '')).map((r) => r.emoji)
  )

  const isMentioned = Boolean(
    user &&
    message.content &&
    (
      (user.displayName && message.content.includes(`@${user.displayName}`)) ||
      message.content.includes('@everyone') ||
      message.content.includes('@here')
    )
  )

  if (message.deleted) {
    return (
      <div className="px-4 py-0.5 flex items-start gap-3 group opacity-50">
        <div className="w-10 shrink-0" />
        <span className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
          [message deleted]
        </span>
      </div>
    )
  }

  if (message.kind === 'welcome') {
    return <WelcomeMessage message={message} isHighlighted={isHighlighted} />
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          id={`message-${message.id}`}
          className={`relative px-4 py-1 flex flex-col group rounded-md transition-all duration-300 ${
            isHighlighted
              ? 'bg-[#7667F5]/25 ring-2 ring-[#7667F5] shadow-lg'
              : isMentioned
              ? 'bg-[#7667F5]/[0.08] hover:bg-[#7667F5]/[0.14] border-l-2 border-[#7667F5]'
              : 'hover:bg-[#2B2D33]/40'
          } ${
            message.pending ? 'opacity-60' : message.failed ? 'opacity-40' : ''
          }`}
        >
          {/* Discord Reply Spine & Header */}
          {message.replyToId && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                if (message.replyToId && onScrollToMessage) {
                  onScrollToMessage(message.replyToId)
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  if (message.replyToId && onScrollToMessage) {
                    onScrollToMessage(message.replyToId)
                  }
                }
              }}
              className="flex items-center gap-1.5 mb-1 pl-7 text-xs text-[#858B98] hover:text-[#F2F3F5] transition-colors cursor-pointer select-none max-w-full truncate group/reply"
              title="Clique para ir até a mensagem respondida"
            >
              <div className="flex items-center text-[#858B98] group-hover/reply:text-[#F2F3F5] mr-0.5">
                <CornerUpLeft size={13} className="shrink-0" />
              </div>

              {repliedMessage?.authorAvatar ? (
                <img
                  src={repliedMessage.authorAvatar}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : repliedMessage?.authorName ? (
                <div className="w-4 h-4 rounded-full bg-[#7667F5] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                  {repliedMessage.authorName[0]?.toUpperCase()}
                </div>
              ) : null}

              <span className="font-semibold text-[#28A9F5] group-hover/reply:underline shrink-0 text-xs">
                {repliedMessage?.authorName ? `@${repliedMessage.authorName}` : 'Mensagem'}
              </span>

              <span className="truncate text-xs text-[#858B98] group-hover/reply:text-[#B5BAC3] font-normal">
                {repliedMessage
                  ? repliedMessage.content || (repliedMessage.attachments?.length ? '📷 [Anexo / Imagem]' : '[Mensagem]')
                  : 'Mensagem original não encontrada'}
              </span>
            </div>
          )}

          <div className="flex items-start gap-3 w-full">
            {/* Avatar */}
            {(() => {
              const avatar = (
                <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5 bg-[#2B2D33] text-[#F2F3F5] overflow-hidden"
                >
                  {message.authorAvatar ? (
                    <img
                      src={message.authorAvatar}
                      alt={message.authorName ?? ''}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-[#7667F5] text-white font-bold">
                      {initials}
                    </span>
                  )}
                </div>
              )
              return message.authorId ? (
                <UserProfilePopover
                  userId={message.authorId}
                  displayName={message.authorName ?? 'Unknown'}
                  avatarUrl={message.authorAvatar}
                >
                  <button type="button" className="shrink-0 rounded-full cursor-pointer self-start">
                    {avatar}
                  </button>
                </UserProfilePopover>
              ) : (
                avatar
              )
            })()}

            {/* Body */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                {message.authorId ? (
                  <UserProfilePopover
                    userId={message.authorId}
                    displayName={message.authorName ?? 'Unknown'}
                    avatarUrl={message.authorAvatar}
                  >
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#28A9F5] hover:underline cursor-pointer text-left"
                    >
                      {message.authorName ?? 'Unknown'}
                    </button>
                  </UserProfilePopover>
                ) : (
                  <span className="text-sm font-semibold text-[#28A9F5]">
                    {message.authorName ?? 'Unknown'}
                  </span>
                )}
                <span className="text-[11px] text-[#858B98]">
                  {formatDate(message.insertedAt)}
                </span>
                {message.editedAt && (
                  <span className="text-[10px] text-[#858B98]">
                    (editado)
                  </span>
                )}
                {message.pinned && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] text-[#F4B942] bg-[#F4B942]/10 px-1.5 py-0.5 rounded font-medium"
                    title="Mensagem fixada"
                  >
                    <Pin size={10} className="fill-current" /> Fixada
                  </span>
                )}
                {message.failed && (
                  <span className="text-xs text-[#F04747]">Falha ao enviar</span>
                )}
              </div>

            {/* Content / edit mode */}
            {editing ? (
              <div className="flex flex-col gap-1">
                <textarea
                  ref={editRef}
                  className="w-full rounded px-3 py-2 text-sm resize-none outline-none"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <button
                    className="flex items-center gap-1 hover:text-green-400 transition-colors"
                    onClick={handleEditSubmit}
                  >
                    <Check size={12} /> Save
                  </button>
                  <button
                    className="flex items-center gap-1 hover:text-red-400 transition-colors"
                    onClick={() => { setEditing(false); setEditContent(message.content) }}
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              message.content ? (
                (() => {
                  const pollMatch = message.content.match(/\[POLL:([a-zA-Z0-9_\-]+)\]/)
                  if (pollMatch) {
                    const pollId = pollMatch[1]
                    const cleanText = message.content.replace(/\[POLL:[a-zA-Z0-9_\-]+\]\s*/, '').trim()
                    return (
                      <div className="space-y-1">
                        {cleanText && <FormattedMessage content={cleanText} />}
                        <PollMessageCard
                          pollId={pollId}
                          onOpenDetails={usePollStore.getState().openPollDetails}
                        />
                      </div>
                    )
                  }
                  return <FormattedMessage content={message.content} />
                })()
              ) : null
            )}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-col items-start gap-2 mt-2 max-w-lg">
                {message.attachments.map((att) => (
                  <AttachmentView
                    key={att.id || att.url}
                    attachment={att}
                    messagePending={message.pending}
                  />
                ))}
              </div>
            )}

            {/* Reactions */}
            {message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {message.reactions.map((r) => {
                  const active = myReactions.has(r.emoji)
                  return (
                    <button
                      key={r.emoji}
                      onClick={() =>
                        active
                          ? onRemoveReact(message.id, r.emoji)
                          : onReact(message.id, r.emoji)
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#7667F5]/20 text-[#7667F5] border border-[#7667F5]'
                          : 'bg-[#2B2D33] hover:bg-[#3B3E47] text-[#B5BAC3] border border-[#3C3F48]/50'
                      }`}
                      title={`${r.count} reaction${r.count !== 1 ? 's' : ''}`}
                    >
                      <span>{r.emoji}</span>
                      <span className="font-semibold text-[11px]">{r.count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

          {/* Quick-react / action buttons on hover (Maiahi floating bar) */}
          <div className="hidden group-hover:flex items-center gap-0.5 absolute right-4 -top-3.5 z-10 bg-[#2B2D33] border border-[#3C3F48] rounded-lg px-1.5 py-0.5 shadow-xl">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() =>
                  myReactions.has(emoji)
                    ? onRemoveReact(message.id, emoji)
                    : onReact(message.id, emoji)
                }
                className="text-sm p-1 rounded hover:bg-[#3B3E47] transition-colors cursor-pointer"
                title={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => onReply(message)}
              className="p-1.5 rounded hover:bg-[#3B3E47] text-[#858B98] hover:text-[#F2F3F5] transition-colors cursor-pointer"
              title="Responder"
            >
              <Reply size={14} />
            </button>
            {(onPin || onUnpin) && (
              <button
                onClick={() => (message.pinned ? onUnpin?.(message.id) : onPin?.(message.id))}
                className={`p-1.5 rounded hover:bg-[#3B3E47] transition-colors cursor-pointer ${
                  message.pinned ? 'text-[#F4B942]' : 'text-[#858B98] hover:text-[#F2F3F5]'
                }`}
                title={message.pinned ? 'Desafixar Mensagem' : 'Fixar Mensagem'}
              >
                <Pin size={14} className={message.pinned ? 'fill-current' : ''} />
              </button>
            )}
            {isAuthor && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditContent(message.content) }}
                  className="p-1.5 rounded hover:bg-[#3B3E47] text-[#858B98] hover:text-[#F2F3F5] transition-colors cursor-pointer"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="p-1.5 rounded hover:bg-[#3B3E47] text-[#858B98] hover:text-[#F04747] transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>

      {/* Right-click context menu */}
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="z-50 min-w-[160px] rounded-md p-1 shadow-lg text-sm"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
        >
          <ContextMenu.Item
            className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-white/10 outline-none"
            onSelect={() => onReply(message)}
          >
            <Reply size={14} /> Reply
          </ContextMenu.Item>
          {(onPin || onUnpin) && (
            <ContextMenu.Item
              className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-white/10 outline-none text-[#dbdee1]"
              onSelect={() => (message.pinned ? onUnpin?.(message.id) : onPin?.(message.id))}
            >
              <Pin size={14} className={message.pinned ? 'text-[#f0b232] fill-current' : ''} />
              {message.pinned ? 'Desafixar Mensagem' : 'Fixar Mensagem'}
            </ContextMenu.Item>
          )}
          {!message.deleted && !message.pending && !message.id.startsWith('temp-') && (
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-white/10 outline-none data-[state=open]:bg-white/10">
                <BellRing size={14} /> Lembrar-me
                <ChevronRight size={14} className="ml-auto" />
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent
                  className="z-50 min-w-[170px] rounded-md p-1 shadow-lg text-sm"
                  style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                >
                  {reminderPresets().map((preset) => (
                    <ContextMenu.Item
                      key={preset.id}
                      className="px-3 py-1.5 rounded cursor-pointer hover:bg-white/10 outline-none"
                      onSelect={() => void handleRemind(preset.at, preset.label)}
                    >
                      {preset.label}
                    </ContextMenu.Item>
                  ))}
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
          )}
          {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
            <ContextMenu.Item
              key={emoji}
              className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-white/10 outline-none"
              onSelect={() =>
                myReactions.has(emoji)
                  ? onRemoveReact(message.id, emoji)
                  : onReact(message.id, emoji)
              }
            >
              {emoji}
            </ContextMenu.Item>
          ))}
          {isAuthor && (
            <>
              <ContextMenu.Separator className="my-1 h-px" style={{ background: 'var(--color-border)' }} />
              <ContextMenu.Item
                className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-white/10 outline-none"
                onSelect={() => { setEditing(true); setEditContent(message.content) }}
              >
                <Pencil size={14} /> Edit Message
              </ContextMenu.Item>
              <ContextMenu.Item
                className="px-3 py-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-white/10 outline-none text-red-400"
                onSelect={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 size={14} /> Delete Message
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
      {/* Delete confirmation modal */}
      <Dialog.Root open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#2B2D33] text-[#F2F3F5] rounded-2xl border border-[#3C3F48] p-5 shadow-2xl z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-base font-bold text-[#F2F3F5]">
              Excluir mensagem
            </Dialog.Title>
            <Dialog.Description className="text-xs text-[#B5BAC3] mt-2 leading-relaxed">
              Tem certeza de que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </Dialog.Description>

            {/* Message preview snippet */}
            <div className="mt-3 p-3 rounded-xl bg-[#1B1C20] border border-[#3C3F48]/50 text-xs text-[#858B98] line-clamp-3">
              {message.content?.includes('[POLL:')
                ? '📊 [Enquete]'
                : message.content || (message.attachments?.length ? '📷 [Arquivo / Anexo]' : '[Mensagem]')}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#B5BAC3] hover:text-white hover:bg-[#3B3E47] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  onDelete(message.id)
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F04747] hover:bg-[#d83c3c] text-white transition-colors cursor-pointer shadow-md"
              >
                Excluir
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ContextMenu.Root>
  )
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function AttachmentView({ attachment, messagePending }: { attachment: Attachment; messagePending?: boolean }) {
  const isUploading = messagePending && (attachment.progress === undefined || attachment.progress < 100)

  if (isUploading) {
    return (
      <div className="flex flex-col justify-between p-3 rounded-lg bg-[#2B2D33] text-[#F2F3F5] border border-[#3C3F48] min-w-[280px] max-w-[340px]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-11 rounded bg-[#7667F5]/15 flex items-center justify-center shrink-0">
            <FileText size={24} className="text-[#7667F5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#F2F3F5] truncate" title={attachment.filename}>
              {attachment.filename}
            </p>
            <p className="text-[11px] text-[#858B98] mt-0.5">
              {formatFileSize(attachment.size)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 w-full bg-[#1B1C20] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[#7667F5] h-full rounded-full transition-all duration-150"
            style={{ width: `${Math.max(attachment.progress ?? 10, 10)}%` }}
          />
        </div>
      </div>
    )
  }

  const isImage = attachment.contentType?.startsWith('image/')
  const [modalOpen, setModalOpen] = useState(false)

  if (isImage) {
    return (
      <>
        <div className="rounded-lg overflow-hidden w-fit max-w-full">
          <img
            src={attachment.url}
            alt={attachment.filename}
            onClick={() => setModalOpen(true)}
            className="w-auto h-auto max-w-full max-h-[380px] rounded-lg cursor-pointer hover:opacity-95 transition-opacity block"
            loading="lazy"
          />
        </div>

        {/* Full Image Preview Modal */}
        <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <Dialog.Content className="relative max-w-4xl max-h-[90vh] flex flex-col items-center outline-none">
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="max-w-full max-h-[80vh] rounded-md object-contain"
                />
                <div className="flex items-center justify-between w-full pt-3 text-xs text-[#dbdee1]">
                  <span className="truncate max-w-[300px]">{attachment.filename}</span>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    download={attachment.filename}
                    className="text-[#5865f2] hover:underline"
                  >
                    Abrir original / Download
                  </a>
                </div>
              </Dialog.Content>
            </Dialog.Overlay>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    )
  }

  // Non-image file card
  const formattedSize = formatFileSize(attachment.size)

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#2b2d31] border border-[#1e1f22] max-w-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="p-2 rounded bg-[#1e1f22] text-[#949ba4]">
          <FileText size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            download={attachment.filename}
            className="text-xs font-semibold text-[#00a8fc] hover:underline truncate block"
          >
            {attachment.filename}
          </a>
          <span className="text-[11px] text-[#949ba4]">{formattedSize}</span>
        </div>
      </div>
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        download={attachment.filename}
        className="p-1.5 rounded text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors ml-2"
        title="Download"
      >
        <Download size={18} />
      </a>
    </div>
  )
}
