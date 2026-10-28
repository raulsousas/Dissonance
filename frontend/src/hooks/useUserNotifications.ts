import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'
import { playMessageNotificationSound } from '@/lib/soundEffects'

export function useUserNotifications() {
  const { currentUser } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!currentUser) return

    const socket = getSocket(currentUser.token)
    socket.connect()

    const channel = socket.channel(`user:${currentUser.id}`, {})

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
        new Notification('Guilda — Novo pedido de amizade', {
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

    channel.on('new_dm', (payload: { senderName?: string; content?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      playMessageNotificationSound()
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(`Guilda — Mensagem de ${payload?.senderName || 'Amigo'}`, {
          body: payload?.content || 'Você recebeu uma nova mensagem direta.',
        })
      }
    })

    return () => {
      channel.leave()
    }
  }, [currentUser, queryClient])
}
