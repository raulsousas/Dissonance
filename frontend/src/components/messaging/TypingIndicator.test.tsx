/**
 * Tests for TypingIndicator component.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypingIndicator } from './TypingIndicator'

describe('TypingIndicator', () => {
  it('renders nothing when no users are typing', () => {
    const { container } = render(<TypingIndicator users={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows one user typing', () => {
    render(<TypingIndicator users={[{ userId: 'u1', displayName: 'Alice' }]} />)
    expect(screen.getByText(/Alice is typing/i)).toBeInTheDocument()
  })

  it('shows two users typing', () => {
    render(
      <TypingIndicator
        users={[
          { userId: 'u1', displayName: 'Alice' },
          { userId: 'u2', displayName: 'Bob' },
        ]}
      />
    )
    expect(screen.getByText(/Alice and Bob are typing/i)).toBeInTheDocument()
  })

  it('shows generic message for 3+ users', () => {
    render(
      <TypingIndicator
        users={[
          { userId: 'u1', displayName: 'Alice' },
          { userId: 'u2', displayName: 'Bob' },
          { userId: 'u3', displayName: 'Charlie' },
        ]}
      />
    )
    expect(screen.getByText(/Several people are typing/i)).toBeInTheDocument()
  })
})
