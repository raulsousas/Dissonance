import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useFocusStore, isChannelMuted } from './focusStore'
import { useMessagingStore } from './messagingStore'

function mockFetch(handler: (url: string, init?: RequestInit) => { ok: boolean; body?: unknown }) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const r = handler(url, init)
    return { ok: r.ok, status: r.ok ? 200 : 404, json: async () => r.body }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  useFocusStore.getState().reset()
  useMessagingStore.setState({ unread: {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('focusStore', () => {
  it('load replaces the local list with the server one', async () => {
    mockFetch(() => ({ ok: true, body: { muted: [{ channelId: 'c1', mutedAt: '2024-05-01T10:00:00Z' }] } }))
    await useFocusStore.getState().load()

    const s = useFocusStore.getState()
    expect(s.loaded).toBe(true)
    expect(s.muted).toEqual({ c1: '2024-05-01T10:00:00Z' })
    expect(isChannelMuted('c1')).toBe(true)
    expect(isChannelMuted('c2')).toBe(false)
    expect(isChannelMuted(undefined)).toBe(false)
  })

  it('mute stores the channel and clears its unread badge', async () => {
    useMessagingStore.getState().incrementUnread('c1', 'srv')
    mockFetch(() => ({ ok: true, body: { channelId: 'c1', mutedAt: '2024-05-01T10:00:00Z' } }))

    expect(await useFocusStore.getState().mute('c1')).toBe(true)

    expect(isChannelMuted('c1')).toBe(true)
    expect(useMessagingStore.getState().unread['c1']).toBe(0)
  })

  it('mute does nothing locally when the server refuses', async () => {
    mockFetch(() => ({ ok: false }))
    expect(await useFocusStore.getState().mute('c1')).toBe(false)
    expect(isChannelMuted('c1')).toBe(false)
  })

  it('unmute removes only that channel', async () => {
    useFocusStore.setState({ muted: { c1: 'x', c2: 'y' } })
    mockFetch(() => ({ ok: true }))

    expect(await useFocusStore.getState().unmute('c1')).toBe(true)
    expect(useFocusStore.getState().muted).toEqual({ c2: 'y' })
  })

  it('unmute keeps the channel muted when the server refuses', async () => {
    useFocusStore.setState({ muted: { c1: 'x' } })
    mockFetch(() => ({ ok: false }))

    expect(await useFocusStore.getState().unmute('c1')).toBe(false)
    expect(isChannelMuted('c1')).toBe(true)
  })
})
