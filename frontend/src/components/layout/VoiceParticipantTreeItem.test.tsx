import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoiceParticipantTreeItem, type VoiceTreeUser } from './ChannelSidebar'

function user(overrides: Partial<VoiceTreeUser> = {}): VoiceTreeUser {
  return {
    id: 'u1',
    name: 'Ana',
    isSpeaking: false,
    isMuted: false,
    isDeafened: false,
    isScreenSharing: false,
    ...overrides,
  }
}

describe('VoiceParticipantTreeItem', () => {
  it('shows no AO VIVO flag when the user is not sharing', () => {
    render(<VoiceParticipantTreeItem user={user()} inCall={false} onWatchLive={() => {}} />)

    expect(screen.queryByText('AO VIVO')).toBeNull()
  })

  it('shows the muted and deafened icons from the participant state', () => {
    const { rerender } = render(
      <VoiceParticipantTreeItem user={user({ isMuted: true })} inCall onWatchLive={() => {}} />
    )
    expect(screen.getByTitle('Mutado')).toBeTruthy()
    expect(screen.queryByTitle('Ensurdecido')).toBeNull()

    rerender(<VoiceParticipantTreeItem user={user({ isMuted: false })} inCall onWatchLive={() => {}} />)
    expect(screen.queryByTitle('Mutado')).toBeNull()
  })

  it('makes the AO VIVO flag a button that joins and focuses the live', () => {
    const onWatchLive = vi.fn()
    render(<VoiceParticipantTreeItem user={user({ isScreenSharing: true })} inCall={false} onWatchLive={onWatchLive} />)

    fireEvent.click(screen.getByRole('button', { name: 'Assistir a live de Ana' }))

    expect(onWatchLive).toHaveBeenCalledTimes(1)
  })

  it('previews the live on hover; outside the call it asks to join instead of faking a picture', () => {
    render(<VoiceParticipantTreeItem user={user({ isScreenSharing: true })} inCall={false} onWatchLive={() => {}} />)
    const flag = screen.getByRole('button', { name: 'Assistir a live de Ana' })

    fireEvent.mouseEnter(flag)
    expect(screen.getByRole('tooltip').textContent).toContain('Entre na chamada para assistir')

    fireEvent.mouseLeave(flag)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('renders and attaches the real video in the preview when we are in the call', () => {
    const track = { attach: vi.fn(), detach: vi.fn() }
    render(
      <VoiceParticipantTreeItem
        user={user({ isScreenSharing: true, screenTrack: track })}
        inCall
        onWatchLive={() => {}}
      />
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Assistir a live de Ana' }))

    expect(track.attach).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('tooltip').querySelector('video')).toBeTruthy()

    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Assistir a live de Ana' }))
    expect(track.detach).toHaveBeenCalledTimes(1)
  })
})
