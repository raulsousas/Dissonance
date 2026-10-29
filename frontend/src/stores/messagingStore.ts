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

export interface Attachment {
  id: string
  url: string
  filename: string
  size: number
  contentType: string
  width?: number | null
  height?: number | null
  progress?: number
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
  pinned?: boolean
  /** "welcome" = automatic greeting posted by the server when someone joins. */
  kind?: 'user' | 'welcome'
  reactions: Reaction[]
  attachments?: Attachment[]
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
  /** unread[channelId or conversationId] = number of unread messages */
  unread: Record<string, number>
  /** channelToServer[channelId] = serverId */
  channelToServer: Record<string, string>
  /** dmConversations[conversationId] = true */
  dmConversations: Record<string, boolean>
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

  registerChannel: (channelId: string, serverId: string) => void
  registerDm: (conversationId: string) => void
  getServerUnread: (serverId: string) => number
  getTotalDmUnread: () => number

  setUnread: (channelId: string, count: number) => void
  incrementUnread: (channelId: string, serverId?: string) => void
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

export const useMessagingStore = create<MessagingState>((set, get) => ({
  messages: {},
  unread: {},
  channelToServer: {},
  dmConversations: {},
  lastReadMessageId: {},
  typing: {},
  loadingMore: {},
  hasMore: {},

  registerChannel: (channelId, serverId) =>
    set((s) => ({
      channelToServer: { ...s.channelToServer, [channelId]: serverId },
    })),

  registerDm: (conversationId) =>
    set((s) => ({
      dmConversations: { ...s.dmConversations, [conversationId]: true },
    })),

  getServerUnread: (serverId) => {
    const { unread, channelToServer } = get()
    let count = 0
    for (const [chId, unreadCount] of Object.entries(unread)) {
      if (channelToServer[chId] === serverId) {
        count += unreadCount
      }
    }
    return count
  },

  getTotalDmUnread: () => {
    const { unread, channelToServer } = get()
    let count = 0
    for (const [id, unreadCount] of Object.entries(unread)) {
      // If not belonging to any server, it's a DM conversation
      if (!channelToServer[id]) {
        count += unreadCount
      }
    }
    return count
  },

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
    set((s) => {
      const current = s.messages[channelId] ?? []

      if (!message.pending) {
        // 1. If already in list with same id, update in place
        const existingById = current.findIndex((m) => m.id === message.id)
        if (existingById !== -1) {
          const updated = [...current]
          updated[existingById] = { ...current[existingById], ...message, pending: false }
          return { messages: { ...s.messages, [channelId]: updated } }
        }

        // 2. Replace matching pending optimistic message from the same author
        const msgContent = (message.content ?? '').trim()
        const pendingIdx = current.findIndex((m) => {
          if (!m.pending || m.authorId !== message.authorId) return false
          const mContent = (m.content ?? '').trim()
          if (mContent === msgContent) return true
          if ((m.attachments?.length ?? 0) > 0 && (message.attachments?.length ?? 0) > 0) return true
          return false
        })

        if (pendingIdx !== -1) {
          const updated = [...current]
          updated[pendingIdx] = { ...message, pending: false }
          return { messages: { ...s.messages, [channelId]: updated } }
        }
      } else {
        // Avoid duplicate temp messages
        if (current.some((m) => m.id === message.id)) {
          return s
        }
      }

      return {
        messages: {
          ...s.messages,
          [channelId]: [...current, message],
        },
      }
    }),

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

  incrementUnread: (channelId, serverId) =>
    set((s) => {
      const channelToServer = serverId
        ? { ...s.channelToServer, [channelId]: serverId }
        : s.channelToServer
      return {
        channelToServer,
        unread: { ...s.unread, [channelId]: (s.unread[channelId] ?? 0) + 1 },
      }
    }),

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
