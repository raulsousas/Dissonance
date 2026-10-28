/**
 * MessageInput — textarea with send, Shift+Enter for newline,
 * file attachment button, reply preview, and character counter.
 */

import { useState, useRef, useCallback } from 'react'
import { Paperclip, SendHorizonal, X } from 'lucide-react'
import type { Message } from '@/stores/messagingStore'

interface Props {
  channelName: string
  disabled?: boolean
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string, replyToId?: string) => void
  onTyping: () => void
  onStopTyping: () => void
}

const MAX_LENGTH = 4000

export function MessageInput({
  channelName,
  disabled,
  replyTo,
  onCancelReply,
  onSend,
  onTyping,
  onStopTyping,
}: Props) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed || trimmed.length > MAX_LENGTH) return
    onSend(trimmed, replyTo?.id)
    setContent('')
    onCancelReply()
    onStopTyping()
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [content, replyTo, onSend, onCancelReply, onStopTyping])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    onTyping()
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const overLimit = content.length > MAX_LENGTH

  return (
    <div className="px-4 pb-6 shrink-0">
      {/* Reply preview */}
      {replyTo && (
        <div
          className="mb-1 mx-1 px-3 py-1.5 rounded-t-lg flex items-center gap-2 text-xs"
          style={{
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-muted)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span className="flex-1 truncate">
            ↩ Replying to <strong>{replyTo.authorName ?? 'Unknown'}</strong>: {replyTo.content}
          </span>
          <button
            onClick={onCancelReply}
            className="hover:opacity-70 transition-opacity ml-1"
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className={`flex items-end gap-2 rounded-lg px-3 py-2 ${replyTo ? 'rounded-t-none' : ''}`}
        style={{ background: 'var(--color-bg-surface)' }}
      >
        {/* File attachment stub */}
        <button
          disabled={disabled}
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Attach file (coming soon)"
          aria-label="Attach file"
        >
          <Paperclip size={20} style={{ color: 'var(--color-text-muted)' }} />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm py-1"
          style={{ color: 'var(--color-text-primary)', maxHeight: '200px' }}
          placeholder={disabled ? 'You do not have permission to send messages here.' : `Message #${channelName}`}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onStopTyping}
          disabled={disabled}
          maxLength={MAX_LENGTH + 1}
          aria-label="Message input"
        />

        {/* Character counter when near limit */}
        {content.length > MAX_LENGTH - 200 && (
          <span
            className="text-xs shrink-0"
            style={{ color: overLimit ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}

        <button
          onClick={handleSend}
          disabled={!content.trim() || overLimit || disabled}
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
          title="Send message"
          aria-label="Send"
        >
          <SendHorizonal
            size={20}
            style={{ color: content.trim() && !overLimit ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          />
        </button>
      </div>
    </div>
  )
}
