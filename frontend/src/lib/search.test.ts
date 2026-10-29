import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildSearchParams,
  isSearchable,
  parseSearchQuery,
  searchServerMessages,
} from './search'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseSearchQuery', () => {
  it('splits filters from free text', () => {
    expect(parseSearchQuery('deploy from:ana has:link ontem')).toEqual({
      text: 'deploy ontem',
      from: 'ana',
      has: 'link',
      pinned: false,
    })
  })

  it('understands aliases and is case-insensitive on keywords', () => {
    expect(parseSearchQuery('HAS:File').has).toBe('attachment')
    expect(parseSearchQuery('has:attachment').has).toBe('attachment')
    expect(parseSearchQuery('has:image').has).toBe('image')
    expect(parseSearchQuery('IS:Pinned').pinned).toBe(true)
    expect(parseSearchQuery('pinned:true').pinned).toBe(true)
  })

  it('keeps unknown has: values as plain text', () => {
    expect(parseSearchQuery('has:cookies')).toMatchObject({ text: 'has:cookies', has: null })
  })

  it('handles empty and whitespace-only input', () => {
    expect(parseSearchQuery('')).toEqual({ text: '', from: '', has: null, pinned: false })
    expect(parseSearchQuery('   ')).toEqual({ text: '', from: '', has: null, pinned: false })
  })

  it('preserves the author name casing as typed', () => {
    expect(parseSearchQuery('from:Ana').from).toBe('Ana')
  })
})

describe('isSearchable', () => {
  it('requires at least one real criterion', () => {
    expect(isSearchable(parseSearchQuery(''))).toBe(false)
    expect(isSearchable(parseSearchQuery('from:'))).toBe(false)
    expect(isSearchable(parseSearchQuery('oi'))).toBe(true)
    expect(isSearchable(parseSearchQuery('from:ana'))).toBe(true)
    expect(isSearchable(parseSearchQuery('has:link'))).toBe(true)
    expect(isSearchable(parseSearchQuery('is:pinned'))).toBe(true)
  })
})

describe('buildSearchParams', () => {
  it('only includes the criteria that were set', () => {
    const params = buildSearchParams(parseSearchQuery('deploy has:image'), { limit: 20 })
    expect(Object.fromEntries(params)).toEqual({ q: 'deploy', has: 'image', limit: '20' })
  })

  it('adds channel and cursor options', () => {
    const params = buildSearchParams(parseSearchQuery('x is:pinned'), { channelId: 'c1', before: 'm9' })
    expect(Object.fromEntries(params)).toEqual({
      q: 'x',
      pinned: 'true',
      channel_id: 'c1',
      before: 'm9',
    })
  })

  it('encodes special characters safely', () => {
    const params = buildSearchParams(parseSearchQuery('100% & more'))
    expect(params.toString()).toBe('q=100%25+%26+more')
  })
})

describe('searchServerMessages', () => {
  it('calls the server endpoint with credentials and returns the page', async () => {
    const page = { results: [], has_more: false }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => page })
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchServerMessages('srv-1', parseSearchQuery('oi'))

    expect(result).toEqual(page)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/servers/srv-1/search?q=oi',
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('throws on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(searchServerMessages('srv-1', parseSearchQuery('oi'))).rejects.toThrow('404')
  })
})
