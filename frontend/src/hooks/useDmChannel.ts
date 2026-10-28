import { useEffect, useRef, useCallback } from 'react'
import type { Channel } from 'phoenix'
import { getSocket } from '@/lib/socket'
import { useMessagingStore, type Message, type TypingUser } from '@/stores/messagingStore'
import { useAuth, type CurrentUser } from '@/hooks/useAuth'

const HISTORY_LIMIT = 50
const EMPTY_MESSAGES: Message[] = []
const EMPTY_TYPING: TypingUser[] = []

interface SendMessageOpts {
  content: string
}

export function useDmChannel(conversationId: string | undefined) {
  const { currentUser: user } = useAuth()
  const channelRef = useRef<Channel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messages = useMessagingStore(
    (s) => (conversationId ? s.messages[conversationId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES)
  )
  const typing = useMessagingStore(
    (s) => (conversationId ? s.typing[conversationId] ?? EMPTY_TYPING : EMPTY_TYPING)
  )
  const loadingMore = useMessagingStore(
    (s) => (conversationId ? s.loadingMore[conversationId] ?? false : false)
  )
  const hasMore = useMessagingStore(
    (s) => (conversationId ? s.hasMore[conversationId] ?? false : false)
  )

  // ---------------------------------------------------------------------------
  // Load initial history via REST
  // ---------------------------------------------------------------------------
  const loadHistory = useCallback(
    async (targetConversationId: string, beforeId?: string) => {
      const store = useMessagingStore.getState()
      if (!beforeId) {
        store.setLoadingMore(targetConversationId, false)
      } else {
        store.setLoadingMore(targetConversationId, true)
      }

      try {
        const params = new URLSearchParams()
        params.set('limit', String(HISTORY_LIMIT))
        if (beforeId) params.set('before', beforeId)

        const res = await fetch(`/api/dm/${targetConversationId}/messages?${params}`, {
          credentials: 'include',
        })
        if (!res.ok) return

        const data = await res.json()
        const msgs: Message[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          content: m.content,
          channelId: targetConversationId,
          authorId: m.authorId,
          authorName: m.authorName || 'Unknown',
          authorAvatar: m.authorAvatar ?? null,
          replyToId: null,
          editedAt: m.editedAt ?? null,
          deleted: m.deleted ?? false,
          reactions: [],
          insertedAt: m.insertedAt,
        }))

        if (beforeId) {
          store.prependMessages(targetConversationId, msgs)
        } else {
          store.setMessages(targetConversationId, msgs)
        }
        store.setHasMore(targetConversationId, data.has_more ?? false)
      } finally {
        store.setLoadingMore(targetConversationId, false)
      }
    },
    []
  )

  const loadMore = useCallback(() => {
    if (!conversationId) return
    const currentMsgs = useMessagingStore.getState().messages[conversationId]
    const oldest = currentMsgs?.[0]
    if (oldest) {
      loadHistory(conversationId, oldest.id)
    }
  }, [conversationId, loadHistory])

  // ---------------------------------------------------------------------------
  // Join Phoenix channel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!conversationId || !user) return

    const socket = getSocket(user.token)
    socket.connect()

    const channel = socket.channel(`dm:${conversationId}`, {})
    channelRef.current = channel

    channel
      .join()
      .receive('ok', () => {
        console.info(`[Guilda:DM] Joined dm:${conversationId} successfully`)
        loadHistory(conversationId)
      })
      .receive('error', (err: unknown) => {
        console.error(`[Guilda:DM] Failed to join dm:${conversationId}:`, err)
      })

    // ---- incoming events ----
    channel.on('new_message', (payload: any) => {
      console.info(`[Guilda:DM] Incoming message in dm:${conversationId}:`, payload)
      const msg: Message = {
        id: payload.id,
        content: payload.content,
        channelId: conversationId,
        authorId: payload.authorId,
        authorName: payload.authorName || 'Unknown',
        authorAvatar: payload.authorAvatar ?? null,
        replyToId: null,
        editedAt: payload.editedAt ?? null,
        deleted: payload.deleted ?? false,
        reactions: [],
        insertedAt: payload.insertedAt,
      }
      useMessagingStore.getState().appendMessage(conversationId, msg)
    })

    channel.on('message_edited', (payload: { id: string; content: string; editedAt: string }) => {
      useMessagingStore.getState().updateMessage(conversationId, payload.id, {
        content: payload.content,
        editedAt: payload.editedAt,
      })
    })

    channel.on('message_deleted', (payload: { id: string }) => {
      useMessagingStore.getState().updateMessage(conversationId, payload.id, {
        deleted: true,
        content: '[deleted]',
      })
    })

    channel.on(
      'typing',
      (payload: { userId: string; displayName: string; typing: boolean }) => {
        useMessagingStore.getState().setTyping(conversationId, payload.userId, payload.displayName, payload.typing)
      }
    )

    return () => {
      channel.leave()
      channelRef.current = null
      useMessagingStore.getState().clearTyping(conversationId)
    }
  }, [conversationId, user?.id, loadHistory])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    ({ content }: SendMessageOpts) => {
      const channel = channelRef.current
      if (!channel || !conversationId || !user) return

      const store = useMessagingStore.getState()
      const tempId = `temp-${Date.now()}`
      const optimistic: Message = {
        id: tempId,
        content,
        channelId: conversationId,
        authorId: user.id,
        authorName: (user as CurrentUser).displayName,
        authorAvatar: (user as CurrentUser).avatarUrl ?? null,
        replyToId: null,
        editedAt: null,
        deleted: false,
        reactions: [],
        insertedAt: new Date().toISOString(),
        pending: true,
      }

      store.appendMessage(conversationId, optimistic)

      channel
        .push('new_message', { content })
        .receive('ok', (resp: { id: string }) => {
          store.updateMessage(conversationId, tempId, {
            id: resp.id,
            pending: false,
          })
        })
        .receive('error', () => {
          store.failMessage(conversationId, tempId)
        })
    },
    [conversationId, user]
  )

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      const channel = channelRef.current
      if (!channel) return

      channel.push('edit_message', { message_id: messageId, content })
    },
    []
  )

  const deleteMessage = useCallback(
    (messageId: string) => {
      const channel = channelRef.current
      if (!channel) return

      channel.push('delete_message', { message_id: messageId })
    },
    []
  )

  const sendTyping = useCallback(() => {
    const channel = channelRef.current
    if (!channel) return

    channel.push('typing_start', {})

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      channel.push('typing_stop', {})
    }, 3000)
  }, [])

  const sendStopTyping = useCallback(() => {
    const channel = channelRef.current
    if (!channel) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    channel.push('typing_stop', {})
  }, [])

  return {
    messages,
    typing,
    loadingMore,
    hasMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    sendStopTyping,
  }
}
