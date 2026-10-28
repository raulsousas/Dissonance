/**
 * MessageList — virtualized-ish message list with scroll-to-bottom,
 * infinite scroll upward for history, and date separators.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Message } from '@/stores/messagingStore'
import { MessageItem } from './MessageItem'
import { Hash, Loader2 } from 'lucide-react'

interface Props {
  channelName: string
  messages: Message[]
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  onReact: (id: string, emoji: string) => void
  onRemoveReact: (id: string, emoji: string) => void
  onReply: (msg: Message) => void
  onVisible: (messageId: string) => void
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function DateSeparator({ iso }: { iso: string }) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  let label: string
  if (d.toDateString() === today.toDateString()) label = 'Today'
  else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
  else label = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="flex items-center gap-3 px-4 my-3">
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      <span className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
    </div>
  )
}

export function MessageList({
  channelName,
  messages,
  loadingMore,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
  onReact,
  onRemoveReact,
  onReply,
  onVisible,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef<number>(0)

  // Scroll to bottom on first load and new messages
  const isAtBottom = useRef(true)

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const threshold = 100
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  // When new messages arrive and we're at bottom, scroll down
  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages.length])

  // Preserve scroll position when prepending older messages
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (prevScrollHeight.current > 0) {
      el.scrollTop = el.scrollHeight - prevScrollHeight.current
      prevScrollHeight.current = 0
    }
  })

  // IntersectionObserver for infinite scroll trigger at top
  const handleLoadMore = useCallback(() => {
    const el = containerRef.current
    if (el) prevScrollHeight.current = el.scrollHeight
    onLoadMore()
  }, [onLoadMore])

  useEffect(() => {
    const sentinel = topRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          handleLoadMore()
        }
      },
      { root: containerRef.current, threshold: 0.1 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, handleLoadMore])

  // Mark last visible message as read
  const lastMsg = messages[messages.length - 1]
  useEffect(() => {
    if (lastMsg && isAtBottom.current) {
      onVisible(lastMsg.id)
    }
  }, [lastMsg, onVisible])

  if (messages.length === 0 && !loadingMore) {
    return (
      <div className="flex-1 flex flex-col items-center justify-end pb-8 px-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'var(--color-bg-surface)' }}
        >
          <Hash size={32} style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Welcome to #{channelName}!
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          This is the beginning of the #{channelName} channel.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto flex flex-col py-2"
      onScroll={handleScroll}
    >
      {/* Infinite scroll sentinel */}
      <div ref={topRef} className="h-1" />

      {loadingMore && (
        <div className="flex justify-center py-3">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const showDateSep = !prev || !isSameDay(prev.insertedAt, msg.insertedAt)
        return (
          <div key={msg.id}>
            {showDateSep && <DateSeparator iso={msg.insertedAt} />}
            <MessageItem
              message={msg}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              onRemoveReact={onRemoveReact}
              onReply={onReply}
            />
          </div>
        )
      })}

      <div ref={bottomRef} className="h-1" />
    </div>
  )
}
