import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageItem } from './MessageItem'
import type { Message } from '@/stores/messagingStore'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ currentUser: { id: 'u-me', displayName: 'Eu' } }),
}))

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'Bem-vindo(a) a Casa Azul, @Novato! Fique à vontade',
    channelId: 'c1',
    authorId: 'u-new',
    authorName: 'Novato',
    authorAvatar: null,
    replyToId: null,
    editedAt: null,
    deleted: false,
    reactions: [],
    attachments: [],
    insertedAt: '2024-05-01T10:00:00Z',
    ...overrides,
  }
}

const handlers = {
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onReact: vi.fn(),
  onRemoveReact: vi.fn(),
  onReply: vi.fn(),
}

describe('MessageItem welcome message', () => {
  it('renders the greeting as a system line without author header or actions', () => {
    const { container } = render(<MessageItem message={makeMessage({ kind: 'welcome' })} {...handlers} />)

    expect(screen.getByText(/Bem-vindo\(a\) a Casa Azul/)).toBeTruthy()
    expect(container.querySelector('#message-m1')).not.toBeNull()
    // No author button / avatar popover as in a regular message.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps rendering regular messages with the author name', () => {
    render(<MessageItem message={makeMessage({ kind: 'user', content: 'oi pessoal' })} {...handlers} />)

    expect(screen.getByText('oi pessoal')).toBeTruthy()
    expect(screen.getAllByText('Novato').length).toBeGreaterThan(0)
  })

  it('treats a message without kind (old data) as a regular message', () => {
    render(<MessageItem message={makeMessage({ content: 'mensagem antiga' })} {...handlers} />)

    expect(screen.getAllByText('Novato').length).toBeGreaterThan(0)
  })
})
