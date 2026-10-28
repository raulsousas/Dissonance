/**
 * MessageItem — renders a single message with avatar, name, timestamp,
 * content, edit/delete context menu, reactions, and reply preview.
 */

import { useState, useRef } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, Trash2, Reply, Check, X, FileText, Download } from 'lucide-react'
import type { Message, Attachment } from '@/stores/messagingStore'
import { useAuth } from '@/hooks/useAuth'
// currentUser from useAuth has camelCase fields

interface Props {
  message: Message
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  onReact: (id: string, emoji: string) => void
  onRemoveReact: (id: string, emoji: string) => void
  onReply: (message: Message) => void
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

export function MessageItem({ message, onEdit, onDelete, onReact, onRemoveReact, onReply }: Props) {
  const { currentUser: user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const isAuthor = user?.id === message.authorId
  const initials = message.authorName?.[0]?.toUpperCase() ?? '?'

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

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`relative px-4 py-0.5 flex items-start gap-3 group rounded hover:bg-[#2e3035]/60 transition-colors ${
            message.pending ? 'opacity-60' : message.failed ? 'opacity-40' : ''
          }`}
        >
          {/* Avatar */}
          <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5"
            style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          >
            {message.authorAvatar ? (
              <img
                src={message.authorAvatar}
                alt={message.authorName ?? ''}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-[#00a8fc] hover:underline cursor-pointer">
                {message.authorName ?? 'Unknown'}
              </span>
              <span className="text-[11px] text-[#949ba4]">
                {formatDate(message.insertedAt)}
              </span>
              {message.editedAt && (
                <span className="text-[10px] text-[#949ba4]">
                  (editado)
                </span>
              )}
              {message.failed && (
                <span className="text-xs text-red-400">Falha ao enviar</span>
              )}
            </div>

            {/* Reply preview */}
            {message.replyToId && (
              <div
                className="text-xs mb-1 pl-2 border-l-2 italic truncate max-w-md"
                style={{
                  borderColor: 'var(--color-text-muted)',
                  color: 'var(--color-text-muted)',
                }}
              >
                ↩ Reply to a message
              </div>
            )}

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
                <p className="text-sm break-words whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
                  {message.content}
                </p>
              ) : null
            )}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-col gap-2 mt-2 max-w-lg">
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
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                        active ? 'ring-1' : ''
                      }`}
                      style={{
                        background: active
                          ? 'rgba(59,130,212,0.2)'
                          : 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        outline: active ? '1px solid var(--color-accent)' : 'none',
                      }}
                      title={`${r.count} reaction${r.count !== 1 ? 's' : ''}`}
                    >
                      <span>{r.emoji}</span>
                      <span>{r.count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick-react / action buttons on hover (Discord floating bar) */}
          <div className="hidden group-hover:flex items-center gap-0.5 absolute right-4 -top-3 z-10 bg-[#313338] border border-[#232428] rounded-md px-1 py-0.5 shadow-md">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() =>
                  myReactions.has(emoji)
                    ? onRemoveReact(message.id, emoji)
                    : onReact(message.id, emoji)
                }
                className="text-sm p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => onReply(message)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Reply"
            >
              <Reply size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            {isAuthor && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditContent(message.content) }}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Edit"
                >
                  <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Delete"
                >
                  <Trash2 size={14} className="text-red-400" />
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
                onSelect={() => onDelete(message.id)}
              >
                <Trash2 size={14} /> Delete Message
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
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
      <div className="flex flex-col justify-between p-3 rounded-lg bg-[#2b2d31] text-[#dbdee1] border border-[#1f2023] min-w-[280px] max-w-[340px]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-11 rounded bg-[#5865f2]/15 flex items-center justify-center shrink-0">
            <FileText size={24} className="text-[#8592ff]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#f2f3f5] truncate" title={attachment.filename}>
              {attachment.filename}
            </p>
            <p className="text-[11px] text-[#949ba4] mt-0.5">
              {formatFileSize(attachment.size)}
            </p>
          </div>
        </div>

        {/* Discord Progress Bar (Image 2 style) */}
        <div className="mt-3 w-full bg-[#1e1f22] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[#5865f2] h-full rounded-full transition-all duration-150"
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
        <div className="rounded-lg overflow-hidden max-w-[550px] max-h-[380px] bg-[#1e1f22] border border-[#2b2d31] inline-flex items-center justify-center">
          <img
            src={attachment.url}
            alt={attachment.filename}
            onClick={() => setModalOpen(true)}
            className="max-w-full max-h-[380px] rounded-lg object-contain cursor-pointer hover:opacity-95 transition-opacity block"
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
