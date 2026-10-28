import { useCallback } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
  createLocalTracks,
} from 'livekit-client'
import { useVoiceStore, type VoiceParticipant } from '@/stores/voiceStore'
import { updateGlobalVoiceChannel } from '@/hooks/usePresence'

let currentRoom: Room | null = null
let isConnectingLock = false

function syncRoomParticipants(room: Room) {
  const store = useVoiceStore.getState()
  const list: VoiceParticipant[] = []

  // Local participant
  const local = room.localParticipant
  if (local) {
    const camPub = local.getTrackPublication(Track.Source.Camera)
    const micPub = local.getTrackPublication(Track.Source.Microphone)
    const screenPub = local.getTrackPublication(Track.Source.ScreenShare)

    list.push({
      identity: local.identity,
      name: local.name || 'You',
      isLocal: true,
      isSpeaking: local.isSpeaking,
      isMuted: micPub ? micPub.isMuted : true,
      isDeafened: store.isDeafened,
      isVideoEnabled: camPub ? !camPub.isMuted : false,
      isScreenSharing: screenPub ? !screenPub.isMuted : false,
      videoTrack: camPub?.track,
      screenTrack: screenPub?.track,
    })
  }

  // Remote participants
  room.remoteParticipants.forEach((p: RemoteParticipant) => {
    const camPub = p.getTrackPublication(Track.Source.Camera)
    const micPub = p.getTrackPublication(Track.Source.Microphone)
    const screenPub = p.getTrackPublication(Track.Source.ScreenShare)

    list.push({
      identity: p.identity,
      name: p.name || 'Participant',
      isLocal: false,
      isSpeaking: p.isSpeaking,
      isMuted: micPub ? micPub.isMuted : true,
      isDeafened: false,
      isVideoEnabled: camPub ? !camPub.isMuted && camPub.isSubscribed : false,
      isScreenSharing: screenPub ? !screenPub.isMuted && screenPub.isSubscribed : false,
      videoTrack: camPub?.track,
      screenTrack: screenPub?.track,
    })
  })

  store.setParticipants(list)
}

export function useVoice() {
  const store = useVoiceStore()

  const joinVoice = useCallback(async (channelId: string, serverId: string, channelName: string) => {
    const currentStore = useVoiceStore.getState()

    if (isConnectingLock) return

    // If already connected to this channel, no-op
    if (currentRoom && currentStore.activeChannelId === channelId && (currentStore.isConnected || currentStore.isConnecting)) {
      return
    }

    isConnectingLock = true

    // If connected to another channel, disconnect first
    if (currentRoom) {
      currentRoom.disconnect()
      currentRoom = null
    }

    currentStore.setConnecting(channelId, serverId, channelName)
    console.info(`[Guilda:Voice] Connecting to voice channel ${channelId} (${channelName})`)

    try {
      const res = await fetch(`/api/channels/${channelId}/voice/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error(`[Guilda:Voice] Failed to get voice token status=${res.status}:`, err)
        throw new Error(err.error || 'Failed to get voice token')
      }

      const { data } = await res.json()
      const token = data.token

      // Construct ws url (using current host so it works in localhost or lan)
      const host = window.location.hostname
      const wsUrl = `ws://${host}:7880`
      console.info(`[Guilda:Voice] Connecting LiveKit wsUrl=${wsUrl} room=${data.room}`)

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      currentRoom = room

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        console.info(`[Guilda:Voice] Connected to room ${data.room} successfully`)
        useVoiceStore.getState().setConnected()
        syncRoomParticipants(room)
        updateGlobalVoiceChannel(channelId)
      })

      room.on(RoomEvent.Disconnected, () => {
        console.info(`[Guilda:Voice] Disconnected from room ${data.room}`)
        useVoiceStore.getState().setDisconnected()
        updateGlobalVoiceChannel(null)
        currentRoom = null
        isConnectingLock = false
      })

      room.on(RoomEvent.ParticipantConnected, () => syncRoomParticipants(room))
      room.on(RoomEvent.ParticipantDisconnected, () => syncRoomParticipants(room))

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach()
            document.body.appendChild(el)
          }
          syncRoomParticipants(room)
        }
      )

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el: HTMLElement) => el.remove())
        syncRoomParticipants(room)
      })

      room.on(RoomEvent.TrackMuted, () => syncRoomParticipants(room))
      room.on(RoomEvent.TrackUnmuted, () => syncRoomParticipants(room))
      room.on(RoomEvent.LocalTrackPublished, () => syncRoomParticipants(room))
      room.on(RoomEvent.LocalTrackUnpublished, () => syncRoomParticipants(room))

      room.on(RoomEvent.ActiveSpeakersChanged, () => {
        syncRoomParticipants(room)
      })

      await room.connect(wsUrl, token)

      // Publish local mic audio track by default
      try {
        const tracks = await createLocalTracks({ audio: true, video: false })
        for (const track of tracks) {
          await room.localParticipant.publishTrack(track)
        }
      } catch (micErr) {
        console.warn('Microphone permission not granted or device unavailable:', micErr)
      }

      syncRoomParticipants(room)
    } catch (err: any) {
      console.error('[Guilda:Voice] Failed to connect to voice room:', err)
      useVoiceStore.getState().setError(err.message || 'Failed to connect to voice room')
    } finally {
      isConnectingLock = false
    }
  }, [])

  const leaveVoice = useCallback(() => {
    const currentStore = useVoiceStore.getState()
    console.info(`[Guilda:Voice] Leaving voice channel ${currentStore.activeChannelId}`)
    if (currentRoom) {
      if (currentStore.activeChannelId) {
        fetch(`/api/channels/${currentStore.activeChannelId}/voice/leave`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {})
      }
      currentRoom.disconnect()
      currentRoom = null
    }
    updateGlobalVoiceChannel(null)
    currentStore.setDisconnected()
  }, [])

  const toggleMute = useCallback(async () => {
    if (!currentRoom) {
      const current = useVoiceStore.getState().isMuted
      console.info(`[Guilda:Voice] Toggling local mute without room: ${!current}`)
      useVoiceStore.getState().setMuted(!current)
      return
    }

    const local = currentRoom.localParticipant
    const mic = local.getTrackPublication(Track.Source.Microphone)

    if (mic && mic.track) {
      const willMute = !mic.isMuted
      console.info(`[Guilda:Voice] Toggling mic mute -> ${willMute}`)
      if (willMute) {
        await mic.track.mute()
      } else {
        await mic.track.unmute()
      }
      useVoiceStore.getState().setMuted(willMute)
      syncRoomParticipants(currentRoom)
    } else {
      try {
        console.info('[Guilda:Voice] Enabling microphone track on localParticipant')
        await local.setMicrophoneEnabled(true)
        useVoiceStore.getState().setMuted(false)
        syncRoomParticipants(currentRoom)
      } catch (e) {
        console.warn('[Guilda:Voice] Could not enable microphone:', e)
      }
    }
  }, [])

  const toggleDeafen = useCallback(() => {
    const currentStore = useVoiceStore.getState()
    const willDeafen = !currentStore.isDeafened
    currentStore.setDeafened(willDeafen)

    if (willDeafen && !currentStore.isMuted) {
      if (currentRoom) {
        const local = currentRoom.localParticipant
        const mic = local.getTrackPublication(Track.Source.Microphone)
        if (mic && mic.track) {
          mic.track.mute()
        }
      }
      currentStore.setMuted(true)
    }

    // Mute/unmute all remote audio elements attached
    document.querySelectorAll('audio').forEach((el) => {
      el.muted = willDeafen
    })

    if (currentRoom) {
      syncRoomParticipants(currentRoom)
    }
  }, [])

  const toggleVideo = useCallback(async () => {
    if (!currentRoom) return
    const local = currentRoom.localParticipant
    const isVideo = useVoiceStore.getState().isVideoEnabled

    try {
      await local.setCameraEnabled(!isVideo)
      useVoiceStore.getState().setVideoEnabled(!isVideo)
      syncRoomParticipants(currentRoom)
    } catch (e) {
      console.warn('Could not toggle camera:', e)
    }
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (!currentRoom) return
    const local = currentRoom.localParticipant
    const isSharing = useVoiceStore.getState().isScreenSharing

    try {
      await local.setScreenShareEnabled(!isSharing)
      useVoiceStore.getState().setScreenSharing(!isSharing)
      syncRoomParticipants(currentRoom)
    } catch (e) {
      console.warn('Screen share error:', e)
    }
  }, [])

  return {
    ...store,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
  }
}
