import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'

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

    // Friend events
    channel.on('friend_request_received', () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
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

    channel.on('new_dm', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    return () => {
      channel.leave()
    }
  }, [currentUser, queryClient])
}
