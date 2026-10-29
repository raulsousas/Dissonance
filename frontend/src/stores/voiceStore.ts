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

  updateParticipant: (identity, patch) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.identity === identity ? { ...p, ...patch } : p
      ),
    })),
}))
