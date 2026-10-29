import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isEmptySummary, summaryHeadline, fetchFocusSummary, muteChannel, type FocusSummary } from './focus'

const base: FocusSummary = {
  since: '2024-05-01T10:00:00Z',
  total: 0,
  truncated: false,
  authors: [],
  links: [],
  mentions: [],
}

afterEach(() => vi.unstubAllGlobals())

describe('summary helpers', () => {
  it('detects an empty summary', () => {
    expect(isEmptySummary(base)).toBe(true)
    expect(isEmptySummary({ ...base, total: 1 })).toBe(false)
  })

  it('builds a headline with the right plural', () => {
    expect(summaryHeadline(base)).toMatch(/Nada novo/)
    expect(summaryHeadline({ ...base, total: 1 })).toBe('1 mensagem nova')
    expect(summaryHeadline({ ...base, total: 7 })).toBe('7 mensagens novas')
    expect(summaryHeadline({ ...base, total: 500, truncated: true })).toBe('Mais de 500 mensagens novas')
  })
})

describe('api client', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('encodes the channel id in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ channelId: 'a', mutedAt: 'x' }) })
    vi.stubGlobal('fetch', fetchMock)

    await muteChannel('a/b?c')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/channels/a%2Fb%3Fc/mute')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT', credentials: 'include' })
  })

  it('returns null when the server refuses or the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchFocusSummary('c1')).toBeNull()
    expect(await muteChannel('c1')).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchFocusSummary('c1')).toBeNull()
  })
})
