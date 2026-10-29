import { describe, it, expect } from 'vitest'
import { getActiveVideoTrack } from './voiceStore'

const cam = { id: 'cam' }
const screen = { id: 'screen' }

describe('getActiveVideoTrack', () => {
  it('prefers the screen share over the camera', () => {
    expect(getActiveVideoTrack({ screenTrack: screen, videoTrack: cam, isVideoEnabled: true })).toBe(screen)
  })

  it('renders the camera only while it is on', () => {
    expect(getActiveVideoTrack({ videoTrack: cam, isVideoEnabled: true })).toBe(cam)
  })

  it('does not render a muted camera track, so the avatar shows instead of a black frame', () => {
    expect(getActiveVideoTrack({ videoTrack: cam, isVideoEnabled: false })).toBeUndefined()
  })

  it('returns nothing without any track', () => {
    expect(getActiveVideoTrack({ isVideoEnabled: false })).toBeUndefined()
  })
})
