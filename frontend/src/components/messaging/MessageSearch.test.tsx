import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MessageSearch } from './MessageSearch'

const RESULT = {
  id: 'm1',
  content: 'veja https://example.com/doc',
  channelId: 'chan-2',
  channelName: 'docs',
  authorId: 'u1',
  authorName: 'Ana',
  authorAvatar: null,
  pinned: false,
  attachmentCount: 0,
  insertedAt: '2024-05-01T10:00:00Z',
}

function LocationProbe() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={['/app/servers/srv/channels/chan-1']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <MessageSearch serverId="srv" channelId="chan-1" channelName="geral" />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

function mockSearch(page: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => page })
  vi.stubGlobal('fetch', fn)
  return fn
}

async function typeQuery(value: string) {
  const input = screen.getByLabelText('Buscar mensagens no servidor')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350)
  })
}

describe('MessageSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows filter hints before anything is typed and inserts them on click', () => {
    const fetchMock = mockSearch({ results: [], has_more: false })
    renderSearch()
    const input = screen.getByLabelText('Buscar mensagens no servidor') as HTMLInputElement
    fireEvent.focus(input)

    fireEvent.mouseDown(screen.getByText('has:link'))

    expect(input.value).toBe('has:link')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('debounces typing into a single server request with parsed filters', async () => {
    const fetchMock = mockSearch({ results: [RESULT], has_more: false })
    renderSearch()
    const input = screen.getByLabelText('Buscar mensagens no servidor')
    fireEvent.focus(input)

    fireEvent.change(input, { target: { value: 'd' } })
    fireEvent.change(input, { target: { value: 'de' } })
    fireEvent.change(input, { target: { value: 'doc from:ana has:link' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://x')
    expect(url.pathname).toBe('/api/servers/srv/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'doc',
      from: 'ana',
      has: 'link',
      limit: '20',
    })
    expect(screen.getByText('1 resultado')).toBeTruthy()
  })

  it('renders results with channel and author', async () => {
    mockSearch({ results: [RESULT], has_more: false })
    renderSearch()
    await typeQuery('doc')

    expect(screen.getByText('docs')).toBeTruthy()
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByText(/veja https:\/\/example.com\/doc/)).toBeTruthy()
  })

  it('shows an empty state', async () => {
    mockSearch({ results: [], has_more: false })
    renderSearch()
    await typeQuery('nada')

    expect(screen.getByText('Nenhuma mensagem encontrada.')).toBeTruthy()
  })

  it('shows an error state without breaking', async () => {
    mockSearch({}, false)
    renderSearch()
    await typeQuery('falha')

    expect(screen.getByText(/Não foi possível buscar agora/)).toBeTruthy()
  })

  it('limits the search to the current channel when asked', async () => {
    const fetchMock = mockSearch({ results: [], has_more: false })
    renderSearch()
    await typeQuery('doc')

    fireEvent.click(screen.getByLabelText(/Somente #geral/))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })

    const last = new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://x')
    expect(last.searchParams.get('channel_id')).toBe('chan-1')
  })

  it('navigates to the channel of a result in another channel', async () => {
    mockSearch({ results: [RESULT], has_more: false })
    renderSearch()
    await typeQuery('doc')

    fireEvent.click(screen.getByRole('option'))

    expect(screen.getByTestId('path').textContent).toBe('/app/servers/srv/channels/chan-2')
  })

  it('loads more results with the last id as cursor', async () => {
    const second = { ...RESULT, id: 'm0', content: 'mais antiga' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [RESULT], has_more: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [second], has_more: false }) })
    vi.stubGlobal('fetch', fetchMock)
    renderSearch()
    await typeQuery('doc')

    await act(async () => {
      fireEvent.click(screen.getByText('Carregar mais'))
    })

    const url = new URL(fetchMock.mock.calls[1][0] as string, 'http://x')
    expect(url.searchParams.get('before')).toBe('m1')
    expect(screen.getByText('2 resultados')).toBeTruthy()
    expect(screen.queryByText('Carregar mais')).toBeNull()
  })
})
