import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  usePresenceStore,
  initGlobalPresence,
  updateGlobalVoiceChannel,
  updateGlobalStatus,
  getStatusLabel,
  getStatusColor,
  type UserPresenceInfo,
} from '@/stores/presenceStore'

export {
  updateGlobalVoiceChannel,
  updateGlobalStatus,
  getStatusLabel,
  getStatusColor,
  type UserPresenceInfo,
}

export function usePresence() {
  const { currentUser: user } = useAuth()
  const onlineUsers = usePresenceStore((state) => state.onlineUsers)
  const isUserOnline = usePresenceStore((state) => state.isUserOnline)
  const getUserStatus = usePresenceStore((state) => state.getUserStatus)
  const getUsersInVoiceChannel = usePresenceStore((state) => state.getUsersInVoiceChannel)

  useEffect(() => {
    if (user?.token) {
      initGlobalPresence(user.token, user.status)
    } else {
      initGlobalPresence(null)
    }
  }, [user?.token])

  return {
    onlineUsers,
    isUserOnline,
    getUserStatus,
    getUsersInVoiceChannel,
  }
}
