/**
 * Tests for MessageInput component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageInput } from './MessageInput'

describe('MessageInput', () => {
  const defaultProps = {
    channelName: 'general',
    disabled: false,
    replyTo: null,
    onCancelReply: vi.fn(),
    onSend: vi.fn(),
    onTyping: vi.fn(),
    onStopTyping: vi.fn(),
  }

  it('renders with the channel name in the placeholder', () => {
    render(<MessageInput {...defaultProps} />)
    const textarea = screen.getByRole('textbox', { name: /message input/i })
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('general'))
  })

  it('send button is disabled when input is empty', () => {
    render(<MessageInput {...defaultProps} />)
    const sendBtn = screen.getByRole('button', { name: /send/i })
    expect(sendBtn).toBeDisabled()
  })

  it('calls onSend when Enter is pressed with content', async () => {
    const onSend = vi.fn()
    render(<MessageInput {...defaultProps} onSend={onSend} />)
    const textarea = screen.getByRole('textbox', { name: /message input/i })

    await userEvent.type(textarea, 'Hello{Enter}')

    expect(onSend).toHaveBeenCalledWith('Hello', undefined)
  })

  it('does NOT send on Shift+Enter', async () => {
    const onSend = vi.fn()
    render(<MessageInput {...defaultProps} onSend={onSend} />)
    const textarea = screen.getByRole('textbox', { name: /message input/i })

    await userEvent.type(textarea, 'line1{Shift>}{Enter}{/Shift}line2')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows reply preview when replyTo is set', () => {
    const replyTo = {
      id: 'msg-1',
      content: 'Original message',
      channelId: 'ch-1',
      authorId: 'user-1',
      authorName: 'Bob',
      authorAvatar: null,
      replyToId: null,
      editedAt: null,
      deleted: false,
      reactions: [],
      insertedAt: new Date().toISOString(),
    }

    render(<MessageInput {...defaultProps} replyTo={replyTo} />)

    expect(screen.getByText(/Replying to/i)).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  it('calls onCancelReply when X is clicked', async () => {
    const onCancelReply = vi.fn()
    const replyTo = {
      id: 'msg-1',
      content: 'msg',
      channelId: 'ch-1',
      authorId: 'u',
      authorName: 'Bob',
      authorAvatar: null,
      replyToId: null,
      editedAt: null,
      deleted: false,
      reactions: [],
      insertedAt: new Date().toISOString(),
    }

    render(<MessageInput {...defaultProps} replyTo={replyTo} onCancelReply={onCancelReply} />)
    const cancelBtn = screen.getByRole('button', { name: /cancel reply/i })
    await userEvent.click(cancelBtn)

    expect(onCancelReply).toHaveBeenCalled()
  })

  it('shows disabled placeholder when disabled=true', () => {
    render(<MessageInput {...defaultProps} disabled={true} />)
    const textarea = screen.getByRole('textbox', { name: /message input/i })
    expect(textarea).toBeDisabled()
    expect(textarea.getAttribute('placeholder')).toMatch(/permiss[ãa]o|permission/i)
  })
})
