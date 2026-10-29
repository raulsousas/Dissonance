import { useCallback } from 'react'
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
  type Participant,
  createLocalTracks,
  createLocalScreenTracks,
} from 'livekit-client'
import { useVoiceStore, type VoiceParticipant } from '@/stores/voiceStore'
import { updateGlobalVoiceChannel } from '@/hooks/usePresence'
import { playVoiceJoinSound, playVoiceLeaveSound, playMuteSound } from '@/lib/soundEffects'

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
    const screenAudioPub = local.getTrackPublication(Track.Source.ScreenShareAudio)

    const isLocalMuted = micPub ? micPub.isMuted : store.isMuted
    const isLocalDeafened = store.isDeafened

    list.push({
      identity: local.identity,
      name: local.name || 'You',
      isLocal: true,
      isSpeaking: local.isSpeaking && !isLocalMuted && !isLocalDeafened,
      isMuted: isLocalMuted || isLocalDeafened,
      isDeafened: isLocalDeafened,
      isVideoEnabled: camPub ? !camPub.isMuted : false,
      isScreenSharing: screenPub ? !screenPub.isMuted : false,
      videoTrack: camPub?.track,
      screenTrack: screenPub?.track,
      screenAudioTrack: screenAudioPub?.track,
    })
  }

  // Remote participants
  room.remoteParticipants.forEach((p: RemoteParticipant) => {
    const camPub = p.getTrackPublication(Track.Source.Camera)
    const micPub = p.getTrackPublication(Track.Source.Microphone)
    const screenPub = p.getTrackPublication(Track.Source.ScreenShare)
    const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio)

    let remoteDeafened = false
    let remoteMuted = micPub ? micPub.isMuted : true

    try {
      if (p.metadata) {
        const meta = JSON.parse(p.metadata)
        if (typeof meta.isDeafened === 'boolean') remoteDeafened = meta.isDeafened
        if (typeof meta.isMuted === 'boolean') remoteMuted = meta.isMuted || remoteMuted
      }
    } catch (_) {}

    if (remoteDeafened) {
      remoteMuted = true
    }

    list.push({
      identity: p.identity,
      name: p.name || 'Participant',
      isLocal: false,
      isSpeaking: p.isSpeaking && !remoteMuted && !remoteDeafened,
      isMuted: remoteMuted,
      isDeafened: remoteDeafened,
      isVideoEnabled: camPub ? !camPub.isMuted && camPub.isSubscribed : false,
      isScreenSharing: screenPub ? !screenPub.isMuted && screenPub.isSubscribed : false,
      videoTrack: camPub?.track,
      screenTrack: screenPub?.track,
      screenAudioTrack: screenAudioPub?.track,
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
    updateGlobalVoiceChannel(channelId)
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
        updateGlobalVoiceChannel(null)
        throw new Error(err.error || 'Failed to get voice token')
      }

      const { data } = await res.json()
      const token = data.token

      // If backend returns a remote LiveKit Cloud URL (wss://...), use it directly;
      // otherwise use the current origin through the Vite / Cloudflare proxy.
      let wsUrl = data.url
      if (!wsUrl || wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1') || wsUrl.includes('livekit:7880')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        wsUrl = `${protocol}//${window.location.host}`
      }
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
        playVoiceJoinSound()
      })

      room.on(RoomEvent.Disconnected, () => {
        console.info(`[Guilda:Voice] Disconnected from room ${data.room}`)
        useVoiceStore.getState().setDisconnected()
        updateGlobalVoiceChannel(null)
        currentRoom = null
        isConnectingLock = false
        playVoiceLeaveSound()
      })

      const attachParticipantEvents = (p: Participant) => {
        p.off(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged)
        p.on(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged)
      }

      const handleSpeakingChanged = () => {
        syncRoomParticipants(room)
      }

      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        attachParticipantEvents(p)
        syncRoomParticipants(room)
      })
      room.on(RoomEvent.ParticipantDisconnected, () => syncRoomParticipants(room))

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach() as HTMLAudioElement
            el.id = `audio-${participant.identity}-${publication.source}`
            el.dataset.participantId = participant.identity
            el.dataset.trackSource = publication.source
            el.autoplay = true
            el.volume = 1.0

            // If local user is currently deafened, mute new incoming audio tracks immediately!
            const isCurrentlyDeafened = useVoiceStore.getState().isDeafened
            if (isCurrentlyDeafened) {
              el.muted = true
            }

            document.body.appendChild(el)

            // Ensure playback starts immediately or on first user click if browser policy blocks autoplay
            el.play().catch((err) => {
              console.warn('[Guilda:Voice] Audio playback blocked, waiting for user click:', err)
              const unlock = () => {
                el.play()
                window.removeEventListener('click', unlock)
              }
              window.addEventListener('click', unlock)
            })
          }
          attachParticipantEvents(participant)
          syncRoomParticipants(room)
        }
      )

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el: HTMLElement) => el.remove())
        syncRoomParticipants(room)
      })

      room.on(RoomEvent.TrackMuted, () => syncRoomParticipants(room))
      room.on(RoomEvent.TrackUnmuted, () => syncRoomParticipants(room))
      room.on(RoomEvent.ParticipantMetadataChanged, () => syncRoomParticipants(room))
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
      const next = !current
      console.info(`[Guilda:Voice] Toggling local mute without room: ${next}`)
      useVoiceStore.getState().setMuted(next)
      playMuteSound(next)
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
      local.setMetadata(
        JSON.stringify({
          isMuted: willMute,
          isDeafened: useVoiceStore.getState().isDeafened,
        })
      )
      updateGlobalVoiceChannel(
        useVoiceStore.getState().activeChannelId,
        willMute,
        useVoiceStore.getState().isDeafened
      )
      playMuteSound(willMute)
      syncRoomParticipants(currentRoom)
    } else {
      try {
        console.info('[Guilda:Voice] Enabling microphone track on localParticipant')
        await local.setMicrophoneEnabled(true)
        useVoiceStore.getState().setMuted(false)
        local.setMetadata(
          JSON.stringify({
            isMuted: false,
            isDeafened: useVoiceStore.getState().isDeafened,
          })
        )
        updateGlobalVoiceChannel(
          useVoiceStore.getState().activeChannelId,
          false,
          useVoiceStore.getState().isDeafened
        )
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

    const willMute = willDeafen ? true : currentStore.isMuted
    if (willDeafen) {
      currentStore.setMuted(true)
      if (currentRoom) {
        const local = currentRoom.localParticipant
        const mic = local.getTrackPublication(Track.Source.Microphone)
        if (mic && mic.track) {
          mic.track.mute()
        }
      }
    }

    // Mute or unmute all currently attached remote audio elements
    document.querySelectorAll('audio').forEach((el) => {
      el.muted = willDeafen
    })

    if (currentRoom) {
      currentRoom.localParticipant.setMetadata(
        JSON.stringify({
          isMuted: willMute,
          isDeafened: willDeafen,
        })
      )
      syncRoomParticipants(currentRoom)
    }

    updateGlobalVoiceChannel(currentStore.activeChannelId, willMute, willDeafen)
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

    if (isSharing) {
      const screenPub = local.getTrackPublication(Track.Source.ScreenShare)
      const screenAudioPub = local.getTrackPublication(Track.Source.ScreenShareAudio)
      if (screenPub?.track) {
        await local.unpublishTrack(screenPub.track)
        screenPub.track.stop()
      }
      if (screenAudioPub?.track) {
        await local.unpublishTrack(screenAudioPub.track)
        screenAudioPub.track.stop()
      }
      useVoiceStore.getState().setScreenSharing(false)
      syncRoomParticipants(currentRoom)
    } else {
      try {
        const tracks = await createLocalScreenTracks({
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            channelCount: 2,
          },
          systemAudio: 'include',
          selfBrowserSurface: 'include',
          surfaceSwitching: 'include',
          suppressLocalAudioPlayback: false,
        } as any)

        for (const track of tracks) {
          await local.publishTrack(track)
          track.on('ended', () => {
            useVoiceStore.getState().setScreenSharing(false)
            if (currentRoom) syncRoomParticipants(currentRoom)
          })
        }

        useVoiceStore.getState().setScreenSharing(true)
        syncRoomParticipants(currentRoom)
      } catch (e) {
        console.warn('Screen share error or cancelled by user:', e)
      }
    }
  }, [])

  return {
    ...store,
    currentRoom,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
  }
}
