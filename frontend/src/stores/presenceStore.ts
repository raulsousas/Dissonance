import { create } from 'zustand'
import { Presence, type Channel } from 'phoenix'
import { getSocket } from '@/lib/socket'

export interface UserPresenceInfo {
  userId: string
  displayName?: string
  avatarUrl?: string | null
  status: string
  voiceChannelId?: string | null
  onlineAt?: number
}

interface PresenceState {
  onlineUsers: Record<string, UserPresenceInfo>
  setOnlineUsers: (users: Record<string, UserPresenceInfo>) => void
  isUserOnline: (userId: string) => boolean
  getUserStatus: (userId: string) => string
  getUsersInVoiceChannel: (channelId: string) => UserPresenceInfo[]
}

let activeChannel: Channel | null = null
let activePresence: Presence | null = null
let currentToken: string | null = null

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: {},

  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  isUserOnline: (userId) => {
    const user = get().onlineUsers[userId]
    return !!user && user.status !== 'offline' && user.status !== 'invisible'
  },

  getUserStatus: (userId) => {
    const user = get().onlineUsers[userId]
    if (!user) return 'offline'
    return user.status || 'online'
  },

  getUsersInVoiceChannel: (channelId) => {
    return Object.values(get().onlineUsers).filter(
      (u) => u.voiceChannelId === channelId && u.status !== 'offline' && u.status !== 'invisible'
    )
  },
}))

export function initGlobalPresence(token: string | null) {
  if (!token) {
    if (activeChannel) {
      activeChannel.leave()
      activeChannel = null
      activePresence = null
      currentToken = null
      usePresenceStore.getState().setOnlineUsers({})
    }
    return
  }

  if (activeChannel && currentToken === token) {
    return
  }

  if (activeChannel) {
    activeChannel.leave()
  }

  currentToken = token
  const socket = getSocket(token)
  socket.connect()

  const channel = socket.channel('presence:global', {})
  activeChannel = channel
  const presence = new Presence(channel)
  activePresence = presence

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
    console.info('[Guilda:Presence] Presence synced. Online users count:', Object.keys(state).length, state)
    usePresenceStore.getState().setOnlineUsers(state)
  }

  presence.onSync(() => {
    syncState()
  })

  channel
    .join()
    .receive('ok', () => {
      console.info('[Guilda:Presence] Successfully joined presence:global channel')
    })
    .receive('error', (err) => {
      console.warn('[Guilda:Presence] Failed to join presence:global channel:', err)
    })
}

export function updateGlobalVoiceChannel(voiceChannelId: string | null) {
  console.info('[Guilda:Presence] Updating global voice channel ->', voiceChannelId)
  if (activeChannel) {
    activeChannel.push('update_voice_channel', { voice_channel_id: voiceChannelId })
  }
}
