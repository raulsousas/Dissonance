import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Room } from 'livekit-client'
import { VoicePing } from './VoicePing'

function fakeRoom(rtt: number) {
  const client = { rtt }
  return { room: { engine: { client } } as unknown as Room, client }
}

describe('VoicePing', () => {
  it('shows nothing until hovered', () => {
    const { room } = fakeRoom(46)
    render(<VoicePing room={room}><span>icon</span></VoicePing>)

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows the current ping on hover and hides it on leave', () => {
    const { room } = fakeRoom(46)
    render(<VoicePing room={room}><span>icon</span></VoicePing>)

    fireEvent.mouseEnter(screen.getByText('icon').parentElement as HTMLElement)
    expect(screen.getByRole('tooltip').textContent).toBe('Ping: 46 ms')

    fireEvent.mouseLeave(screen.getByText('icon').parentElement as HTMLElement)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('keeps refreshing while hovered', () => {
    vi.useFakeTimers()
    const { room, client } = fakeRoom(46)
    render(<VoicePing room={room}><span>icon</span></VoicePing>)
    fireEvent.mouseEnter(screen.getByText('icon').parentElement as HTMLElement)

    client.rtt = 130
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByRole('tooltip').textContent).toBe('Ping: 130 ms')
    vi.useRealTimers()
  })

  it('says it is measuring when the SDK has no value yet or there is no room', () => {
    const { room } = fakeRoom(0)
    const { unmount } = render(<VoicePing room={room}><span>icon</span></VoicePing>)
    fireEvent.mouseEnter(screen.getByText('icon').parentElement as HTMLElement)
    expect(screen.getByRole('tooltip').textContent).toBe('Ping: Medindo...')
    unmount()

    render(<VoicePing room={null}><span>icon</span></VoicePing>)
    fireEvent.mouseEnter(screen.getByText('icon').parentElement as HTMLElement)
    expect(screen.getByRole('tooltip').textContent).toBe('Ping: Medindo...')
  })
})
