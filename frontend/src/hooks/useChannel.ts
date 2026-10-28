/**
 * useChannel — connects to a Phoenix channel for a text channel, loads
 * history, and wires all real-time events into the messaging store.
 *
 * Usage:
 *   const { sendMessage, editMessage, deleteMessage, addReaction, removeReaction,
 *           sendTyping, sendStopTyping } = useChannel(channelId)
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Channel } from 'phoenix'
import { getSocket } from '@/lib/socket'
import { useMessagingStore, type Message } from '@/stores/messagingStore'
import { useAuth, type CurrentUser } from '@/hooks/useAuth'

const HISTORY_LIMIT = 50

interface SendMessageOpts {
  content: string
  replyToId?: string
}

export function useChannel(channelId: string | undefined) {
  const { currentUser: user } = useAuth()
  const channelRef = useRef<Channel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const store = useMessagingStore()

  // ---------------------------------------------------------------------------
  // Load initial history via REST
  // ---------------------------------------------------------------------------
  const loadHistory = useCallback(
    async (channelId: string, beforeId?: string) => {
      if (!beforeId) {
        store.setLoadingMore(channelId, false)
      } else {
        store.setLoadingMore(channelId, true)
      }

      try {
        const params = new URLSearchParams()
        params.set('limit', String(HISTORY_LIMIT))
        if (beforeId) params.set('before', beforeId)

        const res = await fetch(`/api/channels/${channelId}/messages?${params}`, {
          credentials: 'include',
        })
        if (!res.ok) return

        const data = await res.json()
        const msgs: Message[] = data.messages

        if (beforeId) {
          store.prependMessages(channelId, msgs)
        } else {
          store.setMessages(channelId, msgs)
        }
        store.setHasMore(channelId, data.has_more)
      } finally {
        store.setLoadingMore(channelId, false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ---------------------------------------------------------------------------
  // Load more (older) messages
  // ---------------------------------------------------------------------------
  const loadMore = useCallback(() => {
    if (!channelId) return
    const messages = useMessagingStore.getState().messages[channelId]
    const oldest = messages?.[0]
    if (oldest) {
      loadHistory(channelId, oldest.id)
    }
  }, [channelId, loadHistory])

  // ---------------------------------------------------------------------------
  // Join Phoenix channel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!channelId || !user) return

    const socket = getSocket()
    socket.connect()

    const channel = socket.channel(`channel:${channelId}`, {})
    channelRef.current = channel

    channel
      .join()
      .receive('ok', (resp: { last_read_message_id: string | null }) => {
        store.setLastRead(channelId, resp.last_read_message_id)
        loadHistory(channelId)
      })
      .receive('error', (err: unknown) => {
        console.error('Channel join error:', err)
      })

    // ---- incoming events ----

    channel.on('new_message', (msg: Message) => {
      store.appendMessage(channelId, msg)
      // If the window is not focused or the channel is not the active one,
      // increment unread — the ChannelPage will call clearUnread on mount.
    })

    channel.on('message_edited', (payload: { id: string; content: string; editedAt: string }) => {
      store.updateMessage(channelId, payload.id, {
        content: payload.content,
        editedAt: payload.editedAt,
      })
    })

    channel.on('message_deleted', (payload: { id: string }) => {
      store.updateMessage(channelId, payload.id, {
        deleted: true,
        content: '[deleted]',
      })
    })

    channel.on(
      'reaction_added',
      (payload: { messageId: string; emoji: string; userId: string; count: number }) => {
        const messages = useMessagingStore.getState().messages[channelId] ?? []
        const msg = messages.find((m) => m.id === payload.messageId)
        if (!msg) return
        const reactions = msg.reactions.filter((r) => r.emoji !== payload.emoji)
        const existing = msg.reactions.find((r) => r.emoji === payload.emoji)
        const userIds = existing
          ? [...existing.userIds, payload.userId]
          : [payload.userId]
        reactions.push({ emoji: payload.emoji, count: payload.count, userIds })
        store.updateMessage(channelId, payload.messageId, { reactions })
      }
    )

    channel.on(
      'reaction_removed',
      (payload: { messageId: string; emoji: string; userId: string; count: number }) => {
        const messages = useMessagingStore.getState().messages[channelId] ?? []
        const msg = messages.find((m) => m.id === payload.messageId)
        if (!msg) return
        const reactions = msg.reactions
          .map((r) =>
            r.emoji === payload.emoji
              ? { ...r, count: payload.count, userIds: r.userIds.filter((id) => id !== payload.userId) }
              : r
          )
          .filter((r) => r.count > 0)
        store.updateMessage(channelId, payload.messageId, { reactions })
      }
    )

    channel.on(
      'typing',
      (payload: { userId: string; displayName: string; typing: boolean }) => {
        store.setTyping(channelId, payload.userId, payload.displayName, payload.typing)
      }
    )

    return () => {
      channel.leave()
      channelRef.current = null
      store.clearTyping(channelId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, user?.id])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    ({ content, replyToId }: SendMessageOpts) => {
      const channel = channelRef.current
      if (!channel || !channelId || !user) return

      // Optimistic insert
      const tempId = `temp-${Date.now()}`
      const optimistic: Message = {
        id: tempId,
        content,
        channelId,
        authorId: user.id,
        authorName: (user as CurrentUser).displayName,
        authorAvatar: (user as CurrentUser).avatarUrl ?? null,
        replyToId: replyToId ?? null,
        editedAt: null,
        deleted: false,
        reactions: [],
        insertedAt: new Date().toISOString(),
        pending: true,
      }
      store.appendMessage(channelId, optimistic)

      channel
        .push('new_message', { content, reply_to_id: replyToId })
        .receive('ok', (resp: { id: string }) => {
          // Replace temp message with confirmed one from the broadcast
          // (broadcast delivers full message; just remove pending flag)
          store.updateMessage(channelId, tempId, { id: resp.id, pending: false })
          // Mark read
          channel.push('mark_read', { message_id: resp.id })
        })
        .receive('error', () => {
          store.failMessage(channelId, tempId)
        })
    },
    [channelId, user, store]
  )

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      channelRef.current?.push('edit_message', { message_id: messageId, content })
    },
    []
  )

  const deleteMessage = useCallback(
    (messageId: string) => {
      channelRef.current?.push('delete_message', { message_id: messageId })
    },
    []
  )

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      channelRef.current?.push('add_reaction', { message_id: messageId, emoji })
    },
    []
  )

  const removeReaction = useCallback(
    (messageId: string, emoji: string) => {
      channelRef.current?.push('remove_reaction', { message_id: messageId, emoji })
    },
    []
  )

  const sendTyping = useCallback(() => {
    if (!channelRef.current) return
    channelRef.current.push('typing_start', {})
    // Auto-stop after 3 s
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.push('typing_stop', {})
    }, 3000)
  }, [])

  const sendStopTyping = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    channelRef.current?.push('typing_stop', {})
  }, [])

  const markRead = useCallback(
    (messageId: string) => {
      if (!channelId) return
      channelRef.current?.push('mark_read', { message_id: messageId })
      store.setLastRead(channelId, messageId)
      store.clearUnread(channelId)
    },
    [channelId, store]
  )

  return {
    messages: useMessagingStore((s) => s.messages[channelId ?? ''] ?? []),
    unread: useMessagingStore((s) => s.unread[channelId ?? ''] ?? 0),
    typing: useMessagingStore((s) => s.typing[channelId ?? ''] ?? []),
    loadingMore: useMessagingStore((s) => s.loadingMore[channelId ?? ''] ?? false),
    hasMore: useMessagingStore((s) => s.hasMore[channelId ?? ''] ?? false),
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    sendTyping,
    sendStopTyping,
    loadMore,
    markRead,
  }
}
