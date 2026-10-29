import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PollsChannelView } from './PollsChannelView'
import { usePollStore, type Poll } from '@/stores/pollStore'

const hookState = vi.hoisted(() => ({ status: 'ready' as 'loading' | 'ready' | 'error' }))

vi.mock('@/hooks/usePollsChannel', () => ({ usePollsChannel: () => hookState }))
vi.mock('@/components/messaging/PollMessageCard', () => ({
  PollMessageCard: ({ pollId }: { pollId: string }) => <div data-testid="poll-card">{pollId}</div>,
}))
vi.mock('@/components/modals/CreatePollModal', () => ({
  CreatePollModal: ({ open }: { open: boolean }) => (open ? <div>criar-enquete-aberto</div> : null),
}))
vi.mock('@/components/modals/PollDetailsModal', () => ({ PollDetailsModal: () => null }))

function makePoll(overrides: Partial<Poll>): Poll {
  return {
    id: 'p',
    scope: 'channel',
    channelId: 'c1',
    authorId: 'u1',
    authorName: 'Ana',
    title: 'T',
    options: [],
    allowSuggestions: false,
    multipleChoice: false,
    allowComments: false,
    expiresAt: null,
    closed: false,
    comments: [],
    insertedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function seed(polls: Poll[]) {
  usePollStore.setState({
    polls: Object.fromEntries(polls.map((p) => [p.id, p])),
    isCreatePollOpen: false,
    activePollModalId: null,
  })
}

beforeEach(() => {
  hookState.status = 'ready'
  seed([])
})

describe('PollsChannelView', () => {
  it('shows the empty state with a shortcut to create the first poll', () => {
    render(<PollsChannelView channelId="c1" channelName="enquetes" />)

    expect(screen.getByText('Nenhuma enquete criada ainda.')).toBeTruthy()
    fireEvent.click(screen.getByText('Criar a primeira enquete'))
    expect(screen.getByText('criar-enquete-aberto')).toBeTruthy()
  })

  it('lists open polls by default and switches between filters', () => {
    seed([
      makePoll({ id: 'open1' }),
      makePoll({ id: 'closed1', closed: true }),
      makePoll({ id: 'other', channelId: 'c2' }),
    ])
    render(<PollsChannelView channelId="c1" channelName="enquetes" />)

    expect(screen.getAllByTestId('poll-card').map((e) => e.textContent)).toEqual(['open1'])

    fireEvent.click(screen.getByRole('tab', { name: 'Encerradas' }))
    expect(screen.getAllByTestId('poll-card').map((e) => e.textContent)).toEqual(['closed1'])

    fireEvent.click(screen.getByRole('tab', { name: 'Todas' }))
    expect(screen.getAllByTestId('poll-card')).toHaveLength(2)
  })

  it('tells the user when no poll is open but closed ones exist', () => {
    seed([makePoll({ id: 'closed1', closed: true })])
    render(<PollsChannelView channelId="c1" channelName="enquetes" />)

    expect(screen.getByText('Nenhuma enquete aberta no momento.')).toBeTruthy()
  })

  it('shows a generic error when loading fails', () => {
    hookState.status = 'error'
    render(<PollsChannelView channelId="c1" channelName="enquetes" />)

    expect(screen.getByRole('alert').textContent).toMatch(/Não foi possível carregar/)
  })

  it('shows a loading state while the first fetch is in flight', () => {
    hookState.status = 'loading'
    render(<PollsChannelView channelId="c1" channelName="enquetes" />)

    expect(screen.getByText('Carregando enquetes...')).toBeTruthy()
  })

  it('opens the create modal from the header button', () => {
    render(<PollsChannelView channelId="c1" channelName="enquetes" />)

    fireEvent.click(screen.getByRole('button', { name: /Nova enquete/ }))
    expect(screen.getByText('criar-enquete-aberto')).toBeTruthy()
  })
})
