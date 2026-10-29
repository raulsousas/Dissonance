import { create } from 'zustand'

export interface VoiceParticipant {
  identity: string
  name: string
  isLocal: boolean
  isSpeaking: boolean
  isMuted: boolean
  isDeafened: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  audioTrack?: any
  videoTrack?: any
  screenTrack?: any
  screenAudioTrack?: any
}

/**
 * The track a tile/preview should render. A camera that was switched off is only
 * muted (the SDK keeps the publication and stops the device), so its track must not
 * be rendered: it would show a black frame instead of the avatar.
 */
export function getActiveVideoTrack(p: Pick<VoiceParticipant, 'screenTrack' | 'videoTrack' | 'isVideoEnabled'>) {
  return p.screenTrack || (p.isVideoEnabled ? p.videoTrack : undefined)
}

interface VoiceState {
  activeChannelId: string | null
  activeServerId: string | null
  activeChannelName: string | null
  isConnected: boolean
  isConnecting: boolean
  isMuted: boolean
  isDeafened: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  error: string | null
  participants: VoiceParticipant[]
  /** Participant whose live the voice panel should focus once it is on screen. */
  focusSharerId: string | null

  // Actions
  setConnecting: (channelId: string, serverId: string, channelName: string) => void
  setConnected: () => void
  setDisconnected: () => void
  setMuted: (muted: boolean) => void
  setDeafened: (deafened: boolean) => void
  setVideoEnabled: (enabled: boolean) => void
  setScreenSharing: (sharing: boolean) => void
  setError: (err: string | null) => void
  setParticipants: (participants: VoiceParticipant[]) => void
  setFocusSharer: (identity: string | null) => void
  updateParticipant: (identity: string, patch: Partial<VoiceParticipant>) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  activeChannelId: null,
  activeServerId: null,
  activeChannelName: null,
  isConnected: false,
  isConnecting: false,
  isMuted: false,
  isDeafened: false,
  isVideoEnabled: false,
  isScreenSharing: false,
  error: null,
  participants: [],
  focusSharerId: null,

  setConnecting: (channelId, serverId, channelName) =>
    set({
      activeChannelId: channelId,
      activeServerId: serverId,
      activeChannelName: channelName,
      isConnecting: true,
      isConnected: false,
      error: null,
    }),

  setConnected: () =>
    set({
      isConnecting: false,
      isConnected: true,
      error: null,
    }),

  setDisconnected: () =>
    set({
      activeChannelId: null,
      activeServerId: null,
      activeChannelName: null,
      isConnected: false,
      isConnecting: false,
      isMuted: false,
      isDeafened: false,
      isVideoEnabled: false,
      isScreenSharing: false,
      error: null,
      participants: [],
    }),

  setMuted: (isMuted) => set({ isMuted }),
  setDeafened: (isDeafened) => set({ isDeafened }),
  setVideoEnabled: (isVideoEnabled) => set({ isVideoEnabled }),
  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  setError: (error) => set({ error, isConnecting: false }),

  setParticipants: (participants) => set({ participants }),
  setFocusSharer: (focusSharerId) => set({ focusSharerId }),

  updateParticipant: (identity, patch) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.identity === identity ? { ...p, ...patch } : p
      ),
    })),
}))
