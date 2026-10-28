/**
 * Zustand store for real-time messaging state.
 *
 * Stores messages per channel, unread counts, and typing indicators.
 */

import { create } from 'zustand'

export interface Reaction {
  emoji: string
  count: number
  userIds: string[]
}

export interface Message {
  id: string
  content: string
  channelId: string
  authorId: string
  authorName: string | null
  authorAvatar: string | null
  replyToId: string | null
  editedAt: string | null
  deleted: boolean
  reactions: Reaction[]
  insertedAt: string
  /** Optimistic: true while waiting for server ack */
  pending?: boolean
  /** Optimistic: true if send failed */
  failed?: boolean
}

export interface TypingUser {
  userId: string
  displayName: string
}

interface MessagingState {
  /** messages[channelId] = Message[] sorted oldest→newest */
  messages: Record<string, Message[]>
  /** unread[channelId] = number of unread messages */
  unread: Record<string, number>
  /** lastReadMessageId[channelId] */
  lastReadMessageId: Record<string, string | null>
  /** typing[channelId] = array of typing users */
  typing: Record<string, TypingUser[]>
  /** whether we are loading older messages for a channel */
  loadingMore: Record<string, boolean>
  /** whether there are older messages to load */
  hasMore: Record<string, boolean>

  // --- actions ---
  setMessages: (channelId: string, messages: Message[]) => void
  prependMessages: (channelId: string, messages: Message[]) => void
  appendMessage: (channelId: string, message: Message) => void
  updateMessage: (channelId: string, messageId: string, patch: Partial<Message>) => void
  removeMessage: (channelId: string, messageId: string) => void

  setUnread: (channelId: string, count: number) => void
  incrementUnread: (channelId: string) => void
  clearUnread: (channelId: string) => void

  setLastRead: (channelId: string, messageId: string | null) => void

  setTyping: (channelId: string, userId: string, displayName: string, isTyping: boolean) => void
  clearTyping: (channelId: string) => void

  setLoadingMore: (channelId: string, value: boolean) => void
  setHasMore: (channelId: string, value: boolean) => void

  /** Replace a pending message (by its temp id) with the confirmed one */
  confirmMessage: (channelId: string, tempId: string, confirmed: Message) => void
  /** Mark a pending message as failed */
  failMessage: (channelId: string, tempId: string) => void
}

export const useMessagingStore = create<MessagingState>((set) => ({
  messages: {},
  unread: {},
  lastReadMessageId: {},
  typing: {},
  loadingMore: {},
  hasMore: {},

  setMessages: (channelId, messages) =>
    set((s) => ({ messages: { ...s.messages, [channelId]: messages } })),

  prependMessages: (channelId, older) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...older, ...(s.messages[channelId] ?? [])],
      },
    })),

  appendMessage: (channelId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...(s.messages[channelId] ?? []), message],
      },
    })),

  updateMessage: (channelId, messageId, patch) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) =>
          m.id === messageId ? { ...m, ...patch } : m
        ),
      },
    })),

  removeMessage: (channelId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).filter((m) => m.id !== messageId),
      },
    })),

  setUnread: (channelId, count) =>
    set((s) => ({ unread: { ...s.unread, [channelId]: count } })),

  incrementUnread: (channelId) =>
    set((s) => ({
      unread: { ...s.unread, [channelId]: (s.unread[channelId] ?? 0) + 1 },
    })),

  clearUnread: (channelId) =>
    set((s) => ({ unread: { ...s.unread, [channelId]: 0 } })),

  setLastRead: (channelId, messageId) =>
    set((s) => ({
      lastReadMessageId: { ...s.lastReadMessageId, [channelId]: messageId },
    })),

  setTyping: (channelId, userId, displayName, isTyping) =>
    set((s) => {
      const current = s.typing[channelId] ?? []
      const filtered = current.filter((t) => t.userId !== userId)
      const next = isTyping ? [...filtered, { userId, displayName }] : filtered
      return { typing: { ...s.typing, [channelId]: next } }
    }),

  clearTyping: (channelId) =>
    set((s) => ({ typing: { ...s.typing, [channelId]: [] } })),

  setLoadingMore: (channelId, value) =>
    set((s) => ({ loadingMore: { ...s.loadingMore, [channelId]: value } })),

  setHasMore: (channelId, value) =>
    set((s) => ({ hasMore: { ...s.hasMore, [channelId]: value } })),

  confirmMessage: (channelId, tempId, confirmed) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) =>
          m.id === tempId ? confirmed : m
        ),
      },
    })),

  failMessage: (channelId, tempId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) =>
          m.id === tempId ? { ...m, failed: true, pending: false } : m
        ),
      },
    })),
}))
