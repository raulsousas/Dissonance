import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'
import { useMessagingStore } from '@/stores/messagingStore'
import { playMessageNotificationSound } from '@/lib/soundEffects'

export function useUserNotifications() {
  const { currentUser } = useAuth()
  const queryClient = useQueryClient()

  const userId = currentUser?.id
  const token = currentUser?.token
  const userStatus = currentUser?.status

  useEffect(() => {
    if (!userId) return

    const socket = getSocket(token)
    socket.connect()

    const channel = socket.channel(`user:${userId}`, {})

    channel
      .join()
      .receive('error', (err) => {
        console.warn('Failed to join user notification channel:', err)
      })

    // Request desktop notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    // Friend events
    channel.on('friend_request_received', (payload: { from?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      playMessageNotificationSound()
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('Dissonance — Novo pedido de amizade', {
          body: payload?.from ? `${payload.from} enviou um pedido de amizade.` : 'Você recebeu um novo pedido de amizade.',
        })
      }
    })

    channel.on('friend_request_sent', () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    })

    channel.on('friend_request_accepted', () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    channel.on('friend_request_declined', () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    })

    channel.on('friend_removed', () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    })

    // DM conversation events
    channel.on('conversation_created', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    channel.on('new_dm', (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      const convId = payload?.conversationId
      const isCurrent = typeof window !== 'undefined' && window.location.pathname === `/app/dm/${convId}`
      if (!isCurrent && convId) {
        useMessagingStore.getState().incrementUnread(convId)
      }

      const isDnd = userStatus === 'dnd'
      if (!isDnd) {
        playMessageNotificationSound()
      }

      const authorName = payload?.message?.authorName || payload?.senderName || 'Amigo'
      const content = payload?.message?.content || payload?.content || 'Você recebeu uma nova mensagem direta.'

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(`Dissonance — ${authorName}`, {
          body: content,
        })
      }
    })

    channel.on('new_server_message', (payload: any) => {
      const { serverId, channelId, channelName, serverName, message } = payload
      const isCurrent = typeof window !== 'undefined' && window.location.pathname.includes(`/channels/${channelId}`)
      if (!isCurrent && channelId && serverId) {
        useMessagingStore.getState().incrementUnread(channelId, serverId)
      }

      const isDnd = userStatus === 'dnd'
      if (!isDnd) {
        playMessageNotificationSound()
      }

      const author = message?.authorName || 'Alguém'
      const content = message?.content || 'Nova mensagem no servidor'

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(`Dissonance — #${channelName || 'canal'} (${serverName || 'Servidor'})`, {
          body: `${author}: ${content}`,
        })
      }
    })

    return () => {
      channel.leave()
    }
  }, [userId, token, userStatus, queryClient])
}
