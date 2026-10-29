import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FocusSummaryBanner } from './FocusSummaryBanner'
import { useFocusStore } from '@/stores/focusStore'

const SUMMARY = {
  since: '2024-05-01T10:00:00Z',
  total: 3,
  truncated: false,
  authors: [
    { authorId: 'u1', authorName: 'Ana', count: 2 },
    { authorId: 'u2', authorName: 'Carla', count: 1 },
  ],
  links: [{ url: 'https://example.com/doc', authorName: 'Ana', messageId: 'm1' }],
  mentions: [{ messageId: 'm2', authorName: 'Carla', kind: 'user', preview: 'oi @Bruno' }],
}

function mockSummary(summary: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: async () => ({ summary }) })
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => useFocusStore.getState().reset())
afterEach(() => vi.unstubAllGlobals())

describe('FocusSummaryBanner', () => {
  it('shows who talked, links and mentions for a silenced channel', async () => {
    useFocusStore.setState({ muted: { c1: 'x' }, loaded: true })
    mockSummary(SUMMARY)

    render(<FocusSummaryBanner channelId="c1" />)

    expect(await screen.findByText(/3 mensagens novas/)).toBeTruthy()
    expect(screen.getByText(/Ana \(2\), Carla \(1\)/)).toBeTruthy()
    expect(screen.getByText('https://example.com/doc')).toBeTruthy()
    expect(screen.getByText(/oi @Bruno/)).toBeTruthy()
  })

  it('renders external links safely', async () => {
    useFocusStore.setState({ muted: { c1: 'x' }, loaded: true })
    mockSummary(SUMMARY)

    render(<FocusSummaryBanner channelId="c1" />)
    const link = await screen.findByText('https://example.com/doc')

    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('does not request a summary for a channel known not to be silenced', () => {
    useFocusStore.setState({ muted: {}, loaded: true })
    const fetchMock = mockSummary(SUMMARY)

    const { container } = render(<FocusSummaryBanner channelId="c1" />)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the server answers 404', async () => {
    useFocusStore.setState({ muted: { c1: 'x' }, loaded: true })
    const fetchMock = mockSummary(undefined, false)

    const { container } = render(<FocusSummaryBanner channelId="c1" />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('can be dismissed', async () => {
    useFocusStore.setState({ muted: { c1: 'x' }, loaded: true })
    mockSummary(SUMMARY)

    render(<FocusSummaryBanner channelId="c1" />)
    await screen.findByText(/3 mensagens novas/)

    fireEvent.click(screen.getByLabelText('Dispensar resumo'))

    expect(screen.queryByText(/3 mensagens novas/)).toBeNull()
  })

  it('unmutes the channel from the banner', async () => {
    useFocusStore.setState({ muted: { c1: 'x' }, loaded: true })
    const fetchMock = mockSummary(SUMMARY)

    render(<FocusSummaryBanner channelId="c1" />)
    await screen.findByText(/3 mensagens novas/)
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) })

    fireEvent.click(screen.getByText(/Reativar notificações/))

    await waitFor(() => expect(useFocusStore.getState().muted['c1']).toBeUndefined())
    expect(screen.queryByText(/3 mensagens novas/)).toBeNull()
  })
})
