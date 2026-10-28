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

export function getStatusLabel(status: string | undefined | null): string {
  switch (status) {
    case 'online':
      return 'Disponível'
    case 'away':
      return 'Ausente'
    case 'dnd':
      return 'Ocupado'
    case 'invisible':
      return 'Invisível'
    case 'offline':
    default:
      return 'Offline'
  }
}

export function getStatusColor(status: string | undefined | null): string {
  switch (status) {
    case 'online':
      return '#23a55a'
    case 'away':
      return '#f0b232'
    case 'dnd':
      return '#f23f43'
    case 'invisible':
    case 'offline':
    default:
      return '#80848e'
  }
}

let activeChannel: Channel | null = null
let activePresence: Presence | null = null
let currentToken: string | null = null
let idleTimer: any = null
let currentManualStatus = 'online'
let isAutoAway = false
let idleListenersAttached = false

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: {},

  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  isUserOnline: (userId) => {
    if (!userId) return false
    const id = userId.toLowerCase()
    const user = get().onlineUsers[id] || get().onlineUsers[userId]
    return !!user && user.status !== 'offline' && user.status !== 'invisible'
  },

  getUserStatus: (userId) => {
    if (!userId) return 'offline'
    const id = userId.toLowerCase()
    const user = get().onlineUsers[id] || get().onlineUsers[userId]
    if (!user) return 'offline'
    return user.status || 'online'
  },

  getUsersInVoiceChannel: (channelId) => {
    return Object.values(get().onlineUsers).filter(
      (u) => u.voiceChannelId === channelId && u.status !== 'offline' && u.status !== 'invisible'
    )
  },
}))

function setupSmartIdleTracking() {
  if (typeof window === 'undefined') return

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer)

    // If the user was put into auto-away, restore their status back to online/manual
    if (isAutoAway) {
      isAutoAway = false
      console.info('[Guilda:Presence] User active again, restoring status:', currentManualStatus)
      if (activeChannel && currentManualStatus !== 'invisible' && currentManualStatus !== 'offline') {
        activeChannel.push('update_status', { status: currentManualStatus })
      }
    }

    // Only set auto-away timer if user's manual status is 'online'
    if (currentManualStatus === 'online') {
      idleTimer = setTimeout(() => {
        if (currentManualStatus === 'online' && !isAutoAway) {
          console.info('[Guilda:Presence] User is idle, setting status to away')
          isAutoAway = true
          if (activeChannel) {
            activeChannel.push('update_status', { status: 'away' })
          }
        }
      }, IDLE_TIMEOUT_MS)
    }
  }

  if (!idleListenersAttached) {
    idleListenersAttached = true
    window.addEventListener('mousemove', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })
    window.addEventListener('mousedown', resetIdle, { passive: true })
    window.addEventListener('touchstart', resetIdle, { passive: true })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        resetIdle()
      }
    })
  }

  resetIdle()
}

export function initGlobalPresence(token: string | null, initialStatus?: string) {
  if (initialStatus) {
    currentManualStatus = initialStatus
  }

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
        const idLower = userId.toLowerCase()
        state[idLower] = {
          userId: idLower,
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
      setupSmartIdleTracking()
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

export function updateGlobalStatus(status: string, currentUserId?: string) {
  currentManualStatus = status
  isAutoAway = false
  console.info('[Guilda:Presence] Updating global user status ->', status)

  // Optimistically update local store for instant UI feedback
  if (currentUserId) {
    const idLower = currentUserId.toLowerCase()
    const currentUsers = { ...usePresenceStore.getState().onlineUsers }
    if (status === 'invisible' || status === 'offline') {
      delete currentUsers[idLower]
      delete currentUsers[currentUserId]
    } else if (currentUsers[idLower]) {
      currentUsers[idLower] = {
        ...currentUsers[idLower],
        status,
      }
    }
    usePresenceStore.getState().setOnlineUsers(currentUsers)
  }

  if (activeChannel) {
    activeChannel.push('update_status', { status })
  }

  // Trigger idle timer re-check
  setupSmartIdleTracking()
}
