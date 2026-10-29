import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'
import { useMessagingStore } from '@/stores/messagingStore'
import { playMessageNotificationSound, playNudgeSound } from '@/lib/soundEffects'
import { toast, useToastStore } from '@/stores/toastStore'
import { isChannelMuted, useFocusStore } from '@/stores/focusStore'
import { deleteReminder, fetchPendingReminders, type Reminder } from '@/lib/reminders'

/** Reminder ids already shown in this session (event + reload can both deliver one). */
const shownReminders = new Set<string>()

function showReminder(reminder: Reminder) {
  if (shownReminders.has(reminder.id)) return
  shownReminders.add(reminder.id)

  const who = reminder.authorName ? `${reminder.authorName}: ` : ''
  playNudgeSound()
  useToastStore.getState().addToast({
    type: 'info',
    title: 'Lembrete de mensagem',
    description: `${who}${reminder.preview}`,
    duration: 15000,
  })
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification('Dissonance — Lembrete', { body: `${who}${reminder.preview}` })
  }
  // Acknowledge so it is not shown again on the next load.
  void deleteReminder(reminder.id)
}

async function showDueReminders() {
  const pending = await fetchPendingReminders()
  pending.filter((r) => r.due).forEach(showReminder)
}

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
      .receive('ok', () => {
        // Also runs on every rejoin: picks up reminders that fired while offline.
        void showDueReminders()
        void useFocusStore.getState().load()
      })
      .receive('error', (err) => {
        console.warn('Failed to join user notification channel:', err)
      })

    channel.on('reminder_due', (payload: Reminder) => {
      showReminder(payload)
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

    // Gentle "attention" from a friend: a quiet sound and a brief toast. No modal, no focus steal.
    // Sender-side cooldown and the receiver's opt-out / do-not-disturb are enforced by the backend.
    channel.on('nudge_received', (payload: { fromName?: string }) => {
      const name = payload?.fromName || 'Um amigo'
      playNudgeSound()
      toast.info(`${name} chamou sua atenção`)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('Dissonance', { body: `${name} chamou sua atenção.` })
      }
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
      // Focus mode: the server already skips silenced channels; this covers a
      // message that was in flight when the channel was silenced.
      if (isChannelMuted(channelId)) return
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
