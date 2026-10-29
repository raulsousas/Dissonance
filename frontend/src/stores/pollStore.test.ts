import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { usePollStore, isPollClosed, pollsOfChannel, type Poll } from './pollStore'
import { useToastStore } from './toastStore'

function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'poll-1',
    scope: 'channel',
    channelId: 'chan-1',
    authorId: 'u1',
    authorName: 'Ana',
    title: 'Quando?',
    options: [
      { id: 'o1', text: 'Sábado', votes: [] },
      { id: 'o2', text: 'Domingo', votes: [] },
    ],
    allowSuggestions: true,
    multipleChoice: false,
    allowComments: true,
    expiresAt: null,
    closed: false,
    comments: [],
    insertedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('pollStore', () => {
  beforeEach(() => {
    usePollStore.setState({
      polls: {},
      unavailable: {},
      activePollModalId: null,
      isCreatePollOpen: false,
      activeChannelId: null,
    })
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a vote to the API and caches the returned poll', async () => {
    const voted = makePoll({
      options: [
        { id: 'o1', text: 'Sábado', votes: ['me'] },
        { id: 'o2', text: 'Domingo', votes: [] },
      ],
    })
    usePollStore.getState().upsertPoll(makePoll())
    const fetchMock = mockFetch(200, { poll: voted })

    await usePollStore.getState().vote('poll-1', 'o1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/polls/poll-1/votes',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ option_id: 'o1' }) })
    )
    expect(usePollStore.getState().polls['poll-1'].options[0].votes).toEqual(['me'])
  })

  it('does not call the API when voting on a closed poll', async () => {
    usePollStore.getState().upsertPoll(makePoll({ closed: true }))
    const fetchMock = mockFetch(200, {})

    await usePollStore.getState().vote('poll-1', 'o1')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates a poll through the API and closes the create modal', async () => {
    usePollStore.setState({ isCreatePollOpen: true })
    const created = makePoll({ id: 'new-poll' })
    const fetchMock = mockFetch(201, { poll: created })

    const result = await usePollStore.getState().createPoll({
      scope: 'channel',
      channelId: 'chan-1',
      title: 'Quando?',
      options: ['Sábado', 'Domingo'],
      allowSuggestions: true,
      multipleChoice: false,
      allowComments: true,
      expiresAt: null,
    })

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(sent).toMatchObject({ scope: 'channel', channel_id: 'chan-1', options: ['Sábado', 'Domingo'] })
    expect(result?.id).toBe('new-poll')
    expect(usePollStore.getState().polls['new-poll']).toBeDefined()
    expect(usePollStore.getState().isCreatePollOpen).toBe(false)
  })

  it('shows an error toast and returns null when creation fails', async () => {
    usePollStore.setState({ isCreatePollOpen: true })
    mockFetch(422, { error: 'invalid number of options' })

    const result = await usePollStore.getState().createPoll({
      scope: 'dm',
      channelId: 'conv-1',
      title: 'x',
      options: ['a', 'b'],
      allowSuggestions: false,
      multipleChoice: false,
      allowComments: true,
    })

    expect(result).toBeNull()
    expect(usePollStore.getState().isCreatePollOpen).toBe(true)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('loadPoll fetches once and remembers unavailable polls', async () => {
    const fetchMock = mockFetch(404, { error: 'poll not found' })

    await usePollStore.getState().loadPoll('ghost')
    await usePollStore.getState().loadPoll('ghost')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(usePollStore.getState().unavailable['ghost']).toBe(true)
  })

  it('removePoll (realtime poll_deleted) drops the poll and closes its modal', () => {
    usePollStore.getState().upsertPoll(makePoll())
    usePollStore.setState({ activePollModalId: 'poll-1' })

    usePollStore.getState().removePoll('poll-1')

    expect(usePollStore.getState().polls['poll-1']).toBeUndefined()
    expect(usePollStore.getState().activePollModalId).toBeNull()
  })

  it('toggleClosePoll sends the inverse of the current state', async () => {
    usePollStore.getState().upsertPoll(makePoll())
    const fetchMock = mockFetch(200, { poll: makePoll({ closed: true }) })

    await usePollStore.getState().toggleClosePoll('poll-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/polls/poll-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ closed: true }) })
    )
    expect(usePollStore.getState().polls['poll-1'].closed).toBe(true)
  })

  it('pollsOfChannel returns only that channel\'s polls, newest first', () => {
    const polls = {
      a: makePoll({ id: 'a', insertedAt: '2024-01-01T00:00:00Z' }),
      b: makePoll({ id: 'b', insertedAt: '2024-02-01T00:00:00Z' }),
      c: makePoll({ id: 'c', channelId: 'other' }),
      d: makePoll({ id: 'd', scope: 'dm' }),
    }
    expect(pollsOfChannel(polls, 'chan-1').map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('loadChannelPolls caches every returned poll and reports success', async () => {
    const fetchMock = mockFetch(200, { polls: [makePoll({ id: 'a' }), makePoll({ id: 'b' })] })

    await expect(usePollStore.getState().loadChannelPolls('chan-1')).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/api/channels/chan-1/polls', expect.anything())
    expect(Object.keys(usePollStore.getState().polls).sort()).toEqual(['a', 'b'])
  })

  it('loadChannelPolls reports failure on HTTP and network errors', async () => {
    mockFetch(404, {})
    await expect(usePollStore.getState().loadChannelPolls('chan-1')).resolves.toBe(false)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(usePollStore.getState().loadChannelPolls('chan-1')).resolves.toBe(false)
  })

  it('isPollClosed treats expired polls as closed', () => {
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    expect(isPollClosed(makePoll({ expiresAt: '2024-06-01T11:00:00Z' }), now)).toBe(true)
    expect(isPollClosed(makePoll({ expiresAt: '2024-06-02T11:00:00Z' }), now)).toBe(false)
    expect(isPollClosed(makePoll({ closed: true }), now)).toBe(true)
  })
})
