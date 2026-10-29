/**
 * Client for message reminders ("lembre-me em 1h / amanhã").
 *
 * The backend keeps the reminder and pushes `reminder_due` on the user's
 * personal channel when it fires. Reminders that fired while the app was closed
 * are returned (with `due: true`) by `fetchPendingReminders`.
 */

export type ChatScope = 'channel' | 'dm'

export interface Reminder {
  id: string
  scope: ChatScope
  serverId: string | null
  channelId: string
  messageId: string
  authorName: string | null
  preview: string
  remindAt: string
  due: boolean
}

export interface ReminderPreset {
  id: string
  label: string
  at: Date
}

/** Quick options shown in the message menu. `now` is injectable for tests. */
export function reminderPresets(now: Date = new Date()): ReminderPreset[] {
  const inMinutes = (m: number) => new Date(now.getTime() + m * 60_000)

  const tomorrow9 = new Date(now)
  tomorrow9.setDate(tomorrow9.getDate() + 1)
  tomorrow9.setHours(9, 0, 0, 0)

  return [
    { id: '20m', label: 'Em 20 minutos', at: inMinutes(20) },
    { id: '1h', label: 'Em 1 hora', at: inMinutes(60) },
    { id: '3h', label: 'Em 3 horas', at: inMinutes(180) },
    { id: 'tomorrow', label: 'Amanhã às 9h', at: tomorrow9 },
  ]
}

export async function createReminder(input: {
  scope: ChatScope
  messageId: string
  remindAt: Date
}): Promise<{ ok: true; reminder: Reminder } | { ok: false; status: number }> {
  try {
    const res = await fetch('/api/reminders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: input.scope,
        message_id: input.messageId,
        remind_at: input.remindAt.toISOString(),
      }),
    })
    if (!res.ok) return { ok: false, status: res.status }
    const data = (await res.json()) as { reminder: Reminder }
    return { ok: true, reminder: data.reminder }
  } catch {
    return { ok: false, status: 0 }
  }
}

export async function fetchPendingReminders(): Promise<Reminder[]> {
  try {
    const res = await fetch('/api/reminders', { credentials: 'include' })
    if (!res.ok) return []
    const data = (await res.json()) as { reminders?: Reminder[] }
    return data.reminders ?? []
  } catch {
    return []
  }
}

/** Removes a reminder on the server (acknowledge after showing, or cancel). */
export async function deleteReminder(id: string): Promise<void> {
  try {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE', credentials: 'include' })
  } catch {
    // Best effort: an unacknowledged reminder is simply shown again next load.
  }
}

/** Message shown in a toast when scheduling fails. */
export function reminderErrorMessage(status: number): string {
  switch (status) {
    case 429:
      return 'Você já tem muitos lembretes pendentes.'
    case 403:
    case 404:
      return 'Não foi possível criar o lembrete para esta mensagem.'
    default:
      return 'Não foi possível criar o lembrete. Tente novamente.'
  }
}
