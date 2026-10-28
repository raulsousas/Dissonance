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
import { useMessagingStore, type Message, type Attachment, type TypingUser } from '@/stores/messagingStore'
import { useAuth, type CurrentUser } from '@/hooks/useAuth'

const HISTORY_LIMIT = 50
const EMPTY_MESSAGES: Message[] = []
const EMPTY_TYPING: TypingUser[] = []

export interface SendMessageOpts {
  content: string
  replyToId?: string
  attachments?: Attachment[]
  files?: File[]
}

export function useChannel(channelId: string | undefined) {
  const { currentUser: user } = useAuth()
  const channelRef = useRef<Channel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Load initial history via REST
  // ---------------------------------------------------------------------------
  const loadHistory = useCallback(
    async (targetChannelId: string, beforeId?: string) => {
      const store = useMessagingStore.getState()
      if (!beforeId) {
        store.setLoadingMore(targetChannelId, false)
      } else {
        store.setLoadingMore(targetChannelId, true)
      }

      try {
        const params = new URLSearchParams()
        params.set('limit', String(HISTORY_LIMIT))
        if (beforeId) params.set('before', beforeId)

        const res = await fetch(`/api/channels/${targetChannelId}/messages?${params}`, {
          credentials: 'include',
        })
        if (!res.ok) return

        const data = await res.json()
        const msgs: Message[] = data.messages

        if (beforeId) {
          store.prependMessages(targetChannelId, msgs)
        } else {
          store.setMessages(targetChannelId, msgs)
        }
        store.setHasMore(targetChannelId, data.has_more)
      } finally {
        store.setLoadingMore(targetChannelId, false)
      }
    },
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

    const socket = getSocket(user.token)
    socket.connect()

    const channel = socket.channel(`channel:${channelId}`, {})
    channelRef.current = channel

    channel
      .join()
      .receive('ok', (resp: { last_read_message_id: string | null }) => {
        console.info(`[Guilda:Channel] Joined channel:${channelId} successfully, lastRead:`, resp.last_read_message_id)
        useMessagingStore.getState().setLastRead(channelId, resp.last_read_message_id)
        loadHistory(channelId)
      })
      .receive('error', (err: unknown) => {
        console.error(`[Guilda:Channel] Failed to join channel:${channelId}:`, err)
      })

    // ---- incoming events ----

    channel.on('new_message', (msg: Message) => {
      console.info(`[Guilda:Channel] Incoming new_message in channel:${channelId}:`, msg)
      useMessagingStore.getState().appendMessage(channelId, msg)
    })

    channel.on('message_edited', (payload: { id: string; content: string; editedAt: string }) => {
      useMessagingStore.getState().updateMessage(channelId, payload.id, {
        content: payload.content,
        editedAt: payload.editedAt,
      })
    })

    channel.on('message_deleted', (payload: { id: string }) => {
      useMessagingStore.getState().updateMessage(channelId, payload.id, {
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
        useMessagingStore.getState().updateMessage(channelId, payload.messageId, { reactions })
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
        useMessagingStore.getState().updateMessage(channelId, payload.messageId, { reactions })
      }
    )

    channel.on(
      'typing',
      (payload: { userId: string; displayName: string; typing: boolean }) => {
        useMessagingStore.getState().setTyping(channelId, payload.userId, payload.displayName, payload.typing)
      }
    )

    return () => {
      channel.leave()
      channelRef.current = null
      useMessagingStore.getState().clearTyping(channelId)
    }
  }, [channelId, user?.id, loadHistory])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async ({ content, replyToId, attachments, files }: SendMessageOpts) => {
      const channel = channelRef.current
      if (!channel || !channelId || !user) return

      const store = useMessagingStore.getState()
      const tempId = `temp-${Date.now()}`

      if (files && files.length > 0) {
        // Optimistic attachments with initial upload progress (10%)
        const initialAttachments: Attachment[] = files.map((file, i) => ({
          id: `temp-att-${Date.now()}-${i}`,
          url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          filename: file.name,
          size: file.size,
          contentType: file.type,
          progress: 10,
        }))

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
          attachments: initialAttachments,
          insertedAt: new Date().toISOString(),
          pending: true,
        }
        store.appendMessage(channelId, optimistic)

        try {
          const uploadPromises = files.map((file, i) => {
            return new Promise<Attachment>((resolve, reject) => {
              const formData = new FormData()
              formData.append('file', file)

              const xhr = new XMLHttpRequest()
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const percent = Math.min(Math.round((e.loaded / e.total) * 100), 98)
                  const currentMsg = useMessagingStore.getState().messages[channelId]?.find((m) => m.id === tempId)
                  if (currentMsg?.attachments) {
                    const updatedAtts = [...currentMsg.attachments]
                    if (updatedAtts[i]) {
                      updatedAtts[i] = { ...updatedAtts[i], progress: percent }
                      useMessagingStore.getState().updateMessage(channelId, tempId, { attachments: updatedAtts })
                    }
                  }
                }
              }

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const data = JSON.parse(xhr.responseText)
                    if (data.attachment) {
                      return resolve(data.attachment)
                    }
                  } catch (_) {}
                }
                reject(new Error('Upload failed'))
              }

              xhr.onerror = () => reject(new Error('Network error'))
              xhr.open('POST', '/api/upload', true)
              xhr.withCredentials = true
              xhr.send(formData)
            })
          })

          const uploadedAttachments = await Promise.all(uploadPromises)

          const serializedAttachments = uploadedAttachments.map((att) => ({
            id: att.id,
            url: att.url,
            filename: att.filename,
            size: att.size,
            contentType: att.contentType,
            content_type: att.contentType,
            width: att.width ?? null,
            height: att.height ?? null,
            progress: 100,
          }))

          store.updateMessage(channelId, tempId, { attachments: serializedAttachments })

          channel
            .push('new_message', { content, reply_to_id: replyToId, attachments: serializedAttachments })
            .receive('ok', (resp: { id: string }) => {
              console.info(`[Guilda:Channel] new_message ACK received from channel:${channelId}: id=${resp.id}`)
              const currentList = useMessagingStore.getState().messages[channelId] ?? []
              const hasConfirmed = currentList.some((m) => m.id === resp.id && !m.pending)
              if (hasConfirmed) {
                store.removeMessage(channelId, tempId)
              } else {
                store.updateMessage(channelId, tempId, { id: resp.id, pending: false })
              }
              channel.push('mark_read', { message_id: resp.id })
            })
            .receive('error', (err: unknown) => {
              console.error(`[Guilda:Channel] new_message rejected by channel:${channelId}:`, err)
              store.failMessage(channelId, tempId)
            })
        } catch (err) {
          console.error(`[Guilda:Channel] Upload failed:`, err)
          store.failMessage(channelId, tempId)
        }
        return
      }

      // Optimistic insert for text-only or pre-attached messages
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
        attachments: attachments ?? [],
        insertedAt: new Date().toISOString(),
        pending: true,
      }
      store.appendMessage(channelId, optimistic)

      const serializedAttachments = (attachments ?? []).map((att) => ({
        id: att.id,
        url: att.url,
        filename: att.filename,
        size: att.size,
        contentType: att.contentType,
        content_type: att.contentType,
        width: att.width ?? null,
        height: att.height ?? null,
      }))

      console.info(`[Guilda:Channel] Pushing new_message to channel:${channelId}:`, {
        contentLength: content.length,
        replyToId,
        attachmentsCount: serializedAttachments.length,
      })

      channel
        .push('new_message', { content, reply_to_id: replyToId, attachments: serializedAttachments })
        .receive('ok', (resp: { id: string }) => {
          console.info(`[Guilda:Channel] new_message ACK received from channel:${channelId}: id=${resp.id}`)
          const currentList = useMessagingStore.getState().messages[channelId] ?? []
          const hasConfirmed = currentList.some((m) => m.id === resp.id && !m.pending)
          if (hasConfirmed) {
            store.removeMessage(channelId, tempId)
          } else {
            store.updateMessage(channelId, tempId, { id: resp.id, pending: false })
          }
          channel.push('mark_read', { message_id: resp.id })
        })
        .receive('error', (err: unknown) => {
          console.error(`[Guilda:Channel] new_message rejected by channel:${channelId}:`, err)
          store.failMessage(channelId, tempId)
        })
    },
    [channelId, user]
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
      if (!channelId || !messageId || messageId.startsWith('temp-')) return
      channelRef.current?.push('mark_read', { message_id: messageId })
      const store = useMessagingStore.getState()
      store.setLastRead(channelId, messageId)
      store.clearUnread(channelId)
    },
    [channelId]
  )

  const messages = useMessagingStore(
    useCallback((s) => (channelId ? s.messages[channelId] : undefined) ?? EMPTY_MESSAGES, [channelId])
  )
  const unread = useMessagingStore(
    useCallback((s) => (channelId ? s.unread[channelId] : undefined) ?? 0, [channelId])
  )
  const typing = useMessagingStore(
    useCallback((s) => (channelId ? s.typing[channelId] : undefined) ?? EMPTY_TYPING, [channelId])
  )
  const loadingMore = useMessagingStore(
    useCallback((s) => (channelId ? s.loadingMore[channelId] : undefined) ?? false, [channelId])
  )
  const hasMore = useMessagingStore(
    useCallback((s) => (channelId ? s.hasMore[channelId] : undefined) ?? false, [channelId])
  )

  return {
    messages,
    unread,
    typing,
    loadingMore,
    hasMore,
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
