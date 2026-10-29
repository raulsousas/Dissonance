/**
 * Zustand store with the channels the current user silenced (focus mode).
 * `muted[channelId]` is the ISO timestamp of when it was silenced.
 */

import { create } from 'zustand'
import { fetchMutedChannels, muteChannel, unmuteChannel } from '@/lib/focus'
import { useMessagingStore } from '@/stores/messagingStore'

interface FocusState {
  muted: Record<string, string>
  loaded: boolean

  /** Replaces the local list with the server's. */
  load: () => Promise<void>
  /** Silences a channel. Returns false if the server refused. */
  mute: (channelId: string) => Promise<boolean>
  /** Re-enables a channel. Returns false if the server refused. */
  unmute: (channelId: string) => Promise<boolean>
  reset: () => void
}

export const useFocusStore = create<FocusState>((set) => ({
  muted: {},
  loaded: false,

  load: async () => {
    const list = await fetchMutedChannels()
    set({
      muted: Object.fromEntries(list.map((m) => [m.channelId, m.mutedAt])),
      loaded: true,
    })
  },

  mute: async (channelId) => {
    const result = await muteChannel(channelId)
    if (!result) return false
    set((s) => ({ muted: { ...s.muted, [channelId]: result.mutedAt } }))
    // A silenced channel never shows a badge.
    useMessagingStore.getState().clearUnread(channelId)
    return true
  },

  unmute: async (channelId) => {
    const ok = await unmuteChannel(channelId)
    if (!ok) return false
    set((s) => {
      const { [channelId]: _removed, ...rest } = s.muted
      return { muted: rest }
    })
    return true
  },

  reset: () => set({ muted: {}, loaded: false }),
}))

/** Non-hook check for event handlers. */
export function isChannelMuted(channelId: string | undefined): boolean {
  return Boolean(channelId && useFocusStore.getState().muted[channelId])
}
