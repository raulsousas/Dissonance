/**
 * MessageItem — renders a single message with avatar, name, timestamp,
 * content, edit/delete context menu, reactions, and reply preview.
 */

import { useState, useRef } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Pencil, Trash2, Reply, Check, X } from 'lucide-react'
import type { Message } from '@/stores/messagingStore'
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

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
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
          className={`px-4 py-0.5 flex items-start gap-3 group rounded hover:bg-white/5 transition-colors ${
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
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {message.authorName ?? 'Unknown'}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {formatDate(message.insertedAt)} at {formatTime(message.insertedAt)}
              </span>
              {message.editedAt && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  (edited)
                </span>
              )}
              {message.failed && (
                <span className="text-xs text-red-400">Failed to send</span>
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
              <p className="text-sm break-words whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
                {message.content}
              </p>
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

          {/* Quick-react / action buttons on hover */}
          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() =>
                  myReactions.has(emoji)
                    ? onRemoveReact(message.id, emoji)
                    : onReact(message.id, emoji)
                }
                className="text-base p-1 rounded hover:bg-white/10 transition-colors"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => onReply(message)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Reply"
            >
              <Reply size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            {isAuthor && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditContent(message.content) }}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
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
