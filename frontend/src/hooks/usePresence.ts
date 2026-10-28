import { useEffect, useState } from 'react'
import { Presence, type Channel } from 'phoenix'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'

export interface UserPresenceInfo {
  userId: string
  displayName?: string
  avatarUrl?: string | null
  status: string
  voiceChannelId?: string | null
  onlineAt?: number
}

let globalPresenceChannel: Channel | null = null

export function updateGlobalVoiceChannel(voiceChannelId: string | null) {
  if (globalPresenceChannel) {
    globalPresenceChannel.push('update_voice_channel', { voice_channel_id: voiceChannelId })
  }
}

export function usePresence() {
  const { currentUser: user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresenceInfo>>({})

  useEffect(() => {
    if (!user) return

    const socket = getSocket(user.token)
    socket.connect()

    const channel: Channel = socket.channel('presence:global', {})
    globalPresenceChannel = channel
    const presence = new Presence(channel)

    function syncState() {
      const state: Record<string, UserPresenceInfo> = {}
      presence.list((userId, { metas }) => {
        const first = metas[0] as any
        if (first) {
          state[userId] = {
            userId,
            displayName: first.display_name,
            avatarUrl: first.avatar_url,
            status: first.status || 'online',
            voiceChannelId: first.voice_channel_id ?? null,
            onlineAt: first.online_at,
          }
        }
      })
      setOnlineUsers(state)
    }

    presence.onSync(() => {
      syncState()
    })

    channel.join().receive('error', (err) => {
      console.warn('Failed to join presence:global channel:', err)
    })

    return () => {
      if (globalPresenceChannel === channel) {
        globalPresenceChannel = null
      }
      channel.leave()
    }
  }, [user])

  const isUserOnline = (userId: string) => {
    return Boolean(onlineUsers[userId])
  }

  const getUserStatus = (userId: string): string => {
    return onlineUsers[userId]?.status ?? 'offline'
  }

  return {
    onlineUsers,
    isUserOnline,
    getUserStatus,
  }
}
