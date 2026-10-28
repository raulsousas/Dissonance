/**
 * Tests for the Zustand messaging store.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useMessagingStore } from '../stores/messagingStore'
import type { Message } from '../stores/messagingStore'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random()}`,
    content: 'Hello',
    channelId: 'ch-1',
    authorId: 'user-1',
    authorName: 'Alice',
    authorAvatar: null,
    replyToId: null,
    editedAt: null,
    deleted: false,
    reactions: [],
    insertedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('messagingStore', () => {
  beforeEach(() => {
    useMessagingStore.setState({
      messages: {},
      unread: {},
      lastReadMessageId: {},
      typing: {},
      loadingMore: {},
      hasMore: {},
    })
  })

  it('appendMessage adds to the end of the list', () => {
    const store = useMessagingStore.getState()
    const m1 = makeMessage({ id: 'm1' })
    const m2 = makeMessage({ id: 'm2' })

    store.appendMessage('ch-1', m1)
    store.appendMessage('ch-1', m2)

    const msgs = useMessagingStore.getState().messages['ch-1']
    expect(msgs).toHaveLength(2)
    expect(msgs[0].id).toBe('m1')
    expect(msgs[1].id).toBe('m2')
  })

  it('prependMessages adds to the beginning', () => {
    const store = useMessagingStore.getState()
    const newer = makeMessage({ id: 'new' })
    store.appendMessage('ch-1', newer)

    const older = [makeMessage({ id: 'old1' }), makeMessage({ id: 'old2' })]
    store.prependMessages('ch-1', older)

    const msgs = useMessagingStore.getState().messages['ch-1']
    expect(msgs[0].id).toBe('old1')
    expect(msgs[1].id).toBe('old2')
    expect(msgs[2].id).toBe('new')
  })

  it('updateMessage patches the target message', () => {
    const store = useMessagingStore.getState()
    const m = makeMessage({ id: 'edit-me', content: 'original' })
    store.appendMessage('ch-1', m)

    store.updateMessage('ch-1', 'edit-me', { content: 'edited' })

    const updated = useMessagingStore.getState().messages['ch-1'][0]
    expect(updated.content).toBe('edited')
  })

  it('removeMessage deletes the target', () => {
    const store = useMessagingStore.getState()
    const m = makeMessage({ id: 'del-me' })
    store.appendMessage('ch-1', m)

    store.removeMessage('ch-1', 'del-me')

    const msgs = useMessagingStore.getState().messages['ch-1']
    expect(msgs).toHaveLength(0)
  })

  it('incrementUnread and clearUnread work correctly', () => {
    const store = useMessagingStore.getState()

    store.incrementUnread('ch-1')
    store.incrementUnread('ch-1')

    expect(useMessagingStore.getState().unread['ch-1']).toBe(2)

    store.clearUnread('ch-1')
    expect(useMessagingStore.getState().unread['ch-1']).toBe(0)
  })

  it('setTyping adds and removes typing users', () => {
    const store = useMessagingStore.getState()

    store.setTyping('ch-1', 'user-1', 'Alice', true)
    expect(useMessagingStore.getState().typing['ch-1']).toHaveLength(1)

    store.setTyping('ch-1', 'user-1', 'Alice', false)
    expect(useMessagingStore.getState().typing['ch-1']).toHaveLength(0)
  })

  it('confirmMessage replaces temp message with confirmed', () => {
    const store = useMessagingStore.getState()
    const temp = makeMessage({ id: 'temp-123', pending: true })
    store.appendMessage('ch-1', temp)

    const confirmed = makeMessage({ id: 'real-id-456', pending: false })
    store.confirmMessage('ch-1', 'temp-123', confirmed)

    const msgs = useMessagingStore.getState().messages['ch-1']
    expect(msgs).toHaveLength(1)
    expect(msgs[0].id).toBe('real-id-456')
    expect(msgs[0].pending).toBeFalsy()
  })

  it('failMessage marks message as failed', () => {
    const store = useMessagingStore.getState()
    const temp = makeMessage({ id: 'temp-999', pending: true })
    store.appendMessage('ch-1', temp)

    store.failMessage('ch-1', 'temp-999')

    const msgs = useMessagingStore.getState().messages['ch-1']
    expect(msgs[0].failed).toBe(true)
    expect(msgs[0].pending).toBe(false)
  })
})
