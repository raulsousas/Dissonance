/**
 * Focus mode client: silence a server channel and read a short summary of what
 * was missed when it is opened again.
 *
 * While a channel is silenced the backend stops sending `new_server_message` to
 * the user, so there is no unread badge, sound or desktop notification.
 * Friend nudges (`nudge_received`) are a different event and keep working.
 */

export interface FocusAuthor {
  authorId: string
  authorName: string | null
  count: number
}

export interface FocusLink {
  url: string
  authorName: string | null
  messageId: string
}

export interface FocusMention {
  messageId: string
  authorName: string | null
  kind: 'user' | 'everyone'
  preview: string
}

export interface FocusSummary {
  since: string
  total: number
  truncated: boolean
  authors: FocusAuthor[]
  links: FocusLink[]
  mentions: FocusMention[]
}

export interface MutedChannel {
  channelId: string
  mutedAt: string
}

/** True when the summary has nothing worth showing. */
export function isEmptySummary(summary: FocusSummary): boolean {
  return summary.total === 0
}

/** "5 mensagens" / "mais de 500 mensagens" headline for the summary banner. */
export function summaryHeadline(summary: FocusSummary): string {
  if (summary.total === 0) return 'Nada novo desde que você silenciou este canal.'
  const noun = summary.total === 1 ? 'mensagem' : 'mensagens'
  return summary.truncated
    ? `Mais de ${summary.total} ${noun} novas`
    : `${summary.total} ${noun} ${summary.total === 1 ? 'nova' : 'novas'}`
}

export async function fetchMutedChannels(): Promise<MutedChannel[]> {
  try {
    const res = await fetch('/api/focus/muted', { credentials: 'include' })
    if (!res.ok) return []
    const data = (await res.json()) as { muted?: MutedChannel[] }
    return data.muted ?? []
  } catch {
    return []
  }
}

export async function muteChannel(channelId: string): Promise<MutedChannel | null> {
  try {
    const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/mute`, {
      method: 'PUT',
      credentials: 'include',
    })
    if (!res.ok) return null
    return (await res.json()) as MutedChannel
  } catch {
    return null
  }
}

export async function unmuteChannel(channelId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/mute`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchFocusSummary(
  channelId: string,
  signal?: AbortSignal
): Promise<FocusSummary | null> {
  try {
    const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/focus-summary`, {
      credentials: 'include',
      signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { summary?: FocusSummary }
    return data.summary ?? null
  } catch {
    return null
  }
}
