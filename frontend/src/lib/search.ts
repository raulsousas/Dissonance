/**
 * Server-side message search client.
 *
 * Query syntax typed by the user (tokens separated by spaces):
 *   from:ana        author name contains "ana"
 *   has:link        messages with a URL
 *   has:image       messages with an image attachment
 *   has:file        messages with any attachment (alias: has:attachment)
 *   is:pinned       pinned messages only (alias: pinned:true)
 *   anything else   text to look for in the message content
 */

export type SearchHas = 'link' | 'image' | 'attachment'

export interface ParsedSearch {
  text: string
  from: string
  has: SearchHas | null
  pinned: boolean
}

export interface SearchResult {
  id: string
  content: string | null
  channelId: string
  channelName: string
  authorId: string
  authorName: string | null
  authorAvatar: string | null
  pinned: boolean
  attachmentCount: number
  insertedAt: string
}

export interface SearchPage {
  results: SearchResult[]
  has_more: boolean
}

const HAS_ALIASES: Record<string, SearchHas> = {
  link: 'link',
  image: 'image',
  file: 'attachment',
  attachment: 'attachment',
}

export function parseSearchQuery(query: string): ParsedSearch {
  const parsed: ParsedSearch = { text: '', from: '', has: null, pinned: false }
  const words: string[] = []

  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase()
    if (lower.startsWith('from:')) {
      parsed.from = token.slice(5)
    } else if (lower.startsWith('has:') && HAS_ALIASES[lower.slice(4)]) {
      parsed.has = HAS_ALIASES[lower.slice(4)]
    } else if (lower === 'is:pinned' || lower === 'pinned:true') {
      parsed.pinned = true
    } else {
      words.push(token)
    }
  }

  parsed.text = words.join(' ')
  return parsed
}

/** True when the query has something the backend can search for. */
export function isSearchable(parsed: ParsedSearch): boolean {
  // A half-typed "from:" has no author yet, so it is not searchable.
  return Boolean(parsed.text || parsed.from || parsed.has || parsed.pinned)
}

export function buildSearchParams(
  parsed: ParsedSearch,
  opts: { channelId?: string; before?: string; limit?: number } = {}
): URLSearchParams {
  const params = new URLSearchParams()
  if (parsed.text) params.set('q', parsed.text)
  if (parsed.from) params.set('from', parsed.from)
  if (parsed.has) params.set('has', parsed.has)
  if (parsed.pinned) params.set('pinned', 'true')
  if (opts.channelId) params.set('channel_id', opts.channelId)
  if (opts.before) params.set('before', opts.before)
  if (opts.limit) params.set('limit', String(opts.limit))
  return params
}

export async function searchServerMessages(
  serverId: string,
  parsed: ParsedSearch,
  opts: { channelId?: string; before?: string; limit?: number; signal?: AbortSignal } = {}
): Promise<SearchPage> {
  const params = buildSearchParams(parsed, opts)
  const res = await fetch(`/api/servers/${serverId}/search?${params}`, {
    credentials: 'include',
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(`search failed (${res.status})`)
  return (await res.json()) as SearchPage
}
