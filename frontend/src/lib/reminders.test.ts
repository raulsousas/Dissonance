import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createReminder,
  deleteReminder,
  fetchPendingReminders,
  reminderErrorMessage,
  reminderPresets,
} from './reminders'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reminderPresets', () => {
  it('offers relative options from the given time', () => {
    const now = new Date('2024-06-01T10:00:00')
    const presets = reminderPresets(now)

    expect(presets.map((p) => p.id)).toEqual(['20m', '1h', '3h', 'tomorrow'])
    expect(presets[0].at.getTime() - now.getTime()).toBe(20 * 60_000)
    expect(presets[1].at.getTime() - now.getTime()).toBe(60 * 60_000)
    expect(presets[2].at.getTime() - now.getTime()).toBe(180 * 60_000)
  })

  it('"tomorrow" is 9:00 local time on the next day, even late at night', () => {
    const now = new Date('2024-06-01T23:30:00')
    const tomorrow = reminderPresets(now).find((p) => p.id === 'tomorrow')!.at

    expect(tomorrow.getDate()).toBe(2)
    expect(tomorrow.getHours()).toBe(9)
    expect(tomorrow.getMinutes()).toBe(0)
  })

  it('does not mutate the provided date', () => {
    const now = new Date('2024-06-01T10:00:00')
    const before = now.getTime()
    reminderPresets(now)
    expect(now.getTime()).toBe(before)
  })
})

describe('reminder API calls', () => {
  it('createReminder posts scope, message id and ISO time', async () => {
    const reminder = { id: 'r1', due: false }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ reminder }) })
    vi.stubGlobal('fetch', fetchMock)
    const at = new Date('2024-06-01T12:00:00Z')

    const result = await createReminder({ scope: 'dm', messageId: 'm1', remindAt: at })

    expect(result).toEqual({ ok: true, reminder })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/reminders')
    expect(JSON.parse(init.body)).toEqual({
      scope: 'dm',
      message_id: 'm1',
      remind_at: '2024-06-01T12:00:00.000Z',
    })
  })

  it('createReminder reports the HTTP status on failure and 0 on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    expect(await createReminder({ scope: 'channel', messageId: 'm', remindAt: new Date() })).toEqual({
      ok: false,
      status: 429,
    })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await createReminder({ scope: 'channel', messageId: 'm', remindAt: new Date() })).toEqual({
      ok: false,
      status: 0,
    })
  })

  it('fetchPendingReminders returns [] on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await fetchPendingReminders()).toEqual([])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ reminders: [{ id: 'r1' }] }) })
    )
    expect(await fetchPendingReminders()).toEqual([{ id: 'r1' }])
  })

  it('deleteReminder never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(deleteReminder('r1')).resolves.toBeUndefined()
  })

  it('maps statuses to friendly messages', () => {
    expect(reminderErrorMessage(429)).toMatch(/muitos lembretes/)
    expect(reminderErrorMessage(404)).toMatch(/mensagem/)
    expect(reminderErrorMessage(500)).toMatch(/Tente novamente/)
  })
})
