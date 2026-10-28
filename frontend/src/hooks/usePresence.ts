import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  usePresenceStore,
  initGlobalPresence,
  updateGlobalVoiceChannel,
  type UserPresenceInfo,
} from '@/stores/presenceStore'

export { updateGlobalVoiceChannel, type UserPresenceInfo }

export function usePresence() {
  const { currentUser: user } = useAuth()
  const onlineUsers = usePresenceStore((state) => state.onlineUsers)
  const isUserOnline = usePresenceStore((state) => state.isUserOnline)
  const getUserStatus = usePresenceStore((state) => state.getUserStatus)
  const getUsersInVoiceChannel = usePresenceStore((state) => state.getUsersInVoiceChannel)

  useEffect(() => {
    if (user?.token) {
      initGlobalPresence(user.token)
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
