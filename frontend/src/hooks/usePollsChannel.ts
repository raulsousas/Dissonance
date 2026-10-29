/**
 * usePollsChannel — keeps a "polls" channel up to date.
 *
 * Joins the channel's realtime topic (the same one chat channels use, where
 * `poll_updated` / `poll_deleted` are broadcast) and loads the channel's polls
 * on every (re)join so nothing is missed while offline.
 */

import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/hooks/useAuth'
import { usePollStore, type Poll } from '@/stores/pollStore'

export function usePollsChannel(channelId: string | undefined) {
  const { currentUser: user } = useAuth()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!channelId || !user) return
    setStatus('loading')

    const socket = getSocket(user.token)
    socket.connect()
    const channel = socket.channel(`channel:${channelId}`, {})
    let active = true

    channel
      .join()
      .receive('ok', () => {
        void usePollStore
          .getState()
          .loadChannelPolls(channelId)
          .then((ok) => {
            if (active) setStatus(ok ? 'ready' : 'error')
          })
      })
      .receive('error', () => {
        if (active) setStatus('error')
      })

    channel.on('poll_updated', (poll: Poll) => usePollStore.getState().upsertPoll(poll))
    channel.on('poll_deleted', (payload: { id: string }) =>
      usePollStore.getState().removePoll(payload.id)
    )

    return () => {
      active = false
      channel.leave()
    }
  }, [channelId, user?.id])

  return { status }
}
