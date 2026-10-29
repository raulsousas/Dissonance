/**
 * Zustand store for Dissonance Interactive Polls (Enquetes Interativas).
 *
 * Polls live on the backend (`/api/polls`). This store is a cache of the polls
 * the user has seen, kept in sync by:
 *   - the responses of the mutating calls below, and
 *   - `poll_updated` / `poll_deleted` events pushed on the chat channel
 *     (wired in `useChannel` / `useDmChannel`).
 */

import { create } from 'zustand'
import { toast } from '@/stores/toastStore'

export interface PollOption {
  id: string
  text: string
  votes: string[] // User IDs who voted for this option
  isCommunitySuggestion?: boolean
  suggestedBy?: {
    id: string
    name: string
    avatarUrl?: string | null
  } | null
}

export interface PollComment {
  id: string
  pollId: string
  authorId: string
  authorName: string
  authorAvatar?: string | null
  content: string
  insertedAt: string
}

export interface Poll {
  id: string
  scope: 'channel' | 'dm'
  channelId: string
  authorId: string
  authorName: string
  authorAvatar?: string | null
  title: string
  options: PollOption[]
  allowSuggestions: boolean
  multipleChoice: boolean
  allowComments: boolean
  expiresAt?: string | null
  closed: boolean
  comments: PollComment[]
  insertedAt: string
}

/** Polls of one channel, newest first. */
export function pollsOfChannel(polls: Record<string, Poll>, channelId: string): Poll[] {
  return Object.values(polls)
    .filter((p) => p.scope === 'channel' && p.channelId === channelId)
    .sort((a, b) => new Date(b.insertedAt).getTime() - new Date(a.insertedAt).getTime())
}

/** A poll stops accepting votes once closed by the author or past its expiry. */
export function isPollClosed(poll: Poll, now: number = Date.now()): boolean {
  if (poll.closed) return true
  return Boolean(poll.expiresAt) && new Date(poll.expiresAt as string).getTime() <= now
}

export interface CreatePollParams {
  scope: 'channel' | 'dm'
  channelId: string
  title: string
  options: string[]
  allowSuggestions: boolean
  multipleChoice: boolean
  allowComments: boolean
  expiresAt?: string | null
}

interface PollStoreState {
  polls: Record<string, Poll>
  /** Poll ids the server said do not exist / are not accessible. */
  unavailable: Record<string, true>
  activePollModalId: string | null
  isCreatePollOpen: boolean
  activeChannelId: string | null

  openCreatePoll: (channelId?: string) => void
  closeCreatePoll: () => void
  openPollDetails: (pollId: string) => void
  closePollDetails: () => void

  upsertPoll: (poll: Poll) => void
  removePoll: (pollId: string) => void
  loadPoll: (pollId: string) => Promise<void>
  /** Loads every poll of a "polls" channel into the cache. Returns false on failure. */
  loadChannelPolls: (channelId: string) => Promise<boolean>

  createPoll: (params: CreatePollParams) => Promise<Poll | null>
  vote: (pollId: string, optionId: string) => Promise<void>
  addOptionSuggestion: (pollId: string, text: string) => Promise<boolean>
  addComment: (pollId: string, text: string) => Promise<boolean>
  toggleClosePoll: (pollId: string) => Promise<void>
  deletePoll: (pollId: string) => Promise<void>
}

const ERROR_MESSAGES: Record<number, string> = {
  403: 'Você não tem permissão para fazer isso nesta enquete.',
  404: 'Enquete não encontrada.',
  409: 'Esta ação não é mais possível (enquete encerrada ou opção repetida).',
  422: 'Dados inválidos para a enquete.',
}

async function request(
  path: string,
  method: string,
  body?: unknown
): Promise<{ ok: true; poll: Poll | null } | { ok: false; status: number }> {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, status: res.status }
    if (res.status === 204) return { ok: true, poll: null }
    const data = (await res.json()) as { poll?: Poll }
    return { ok: true, poll: data.poll ?? null }
  } catch {
    return { ok: false, status: 0 }
  }
}

function reportFailure(status: number) {
  toast.error(ERROR_MESSAGES[status] ?? 'Não foi possível concluir a ação. Tente novamente.')
}

export const usePollStore = create<PollStoreState>((set, get) => {
  /** Runs a mutating call and applies the returned poll to the cache. */
  async function mutate(path: string, method: string, body?: unknown): Promise<boolean> {
    const result = await request(path, method, body)
    if (!result.ok) {
      reportFailure(result.status)
      return false
    }
    if (result.poll) get().upsertPoll(result.poll)
    return true
  }

  return {
    polls: {},
    unavailable: {},
    activePollModalId: null,
    isCreatePollOpen: false,
    activeChannelId: null,

    openCreatePoll: (channelId) => set({ isCreatePollOpen: true, activeChannelId: channelId ?? null }),
    closeCreatePoll: () => set({ isCreatePollOpen: false }),

    openPollDetails: (pollId) => set({ activePollModalId: pollId }),
    closePollDetails: () => set({ activePollModalId: null }),

    upsertPoll: (poll) =>
      set((s) => {
        const { [poll.id]: _gone, ...unavailable } = s.unavailable
        return { polls: { ...s.polls, [poll.id]: poll }, unavailable }
      }),

    removePoll: (pollId) =>
      set((s) => {
        const { [pollId]: _removed, ...polls } = s.polls
        return {
          polls,
          unavailable: { ...s.unavailable, [pollId]: true },
          activePollModalId: s.activePollModalId === pollId ? null : s.activePollModalId,
        }
      }),

    loadPoll: async (pollId) => {
      const state = get()
      if (state.polls[pollId] || state.unavailable[pollId]) return

      const result = await request(`/api/polls/${pollId}`, 'GET')
      if (result.ok && result.poll) {
        get().upsertPoll(result.poll)
      } else if (!result.ok && result.status !== 0) {
        // 403/404: never retry. Network errors (status 0) may be retried later.
        set((s) => ({ unavailable: { ...s.unavailable, [pollId]: true } }))
      }
    },

    loadChannelPolls: async (channelId) => {
      try {
        const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/polls`, {
          credentials: 'include',
        })
        if (!res.ok) return false
        const data = (await res.json()) as { polls?: Poll[] }
        ;(data.polls ?? []).forEach((poll) => get().upsertPoll(poll))
        return true
      } catch {
        return false
      }
    },

    createPoll: async (params) => {
      const result = await request('/api/polls', 'POST', {
        scope: params.scope,
        channel_id: params.channelId,
        title: params.title,
        options: params.options,
        allow_suggestions: params.allowSuggestions,
        multiple_choice: params.multipleChoice,
        allow_comments: params.allowComments,
        expires_at: params.expiresAt ? new Date(params.expiresAt).toISOString() : null,
      })

      if (!result.ok || !result.poll) {
        reportFailure(result.ok ? 0 : result.status)
        return null
      }

      get().upsertPoll(result.poll)
      set({ isCreatePollOpen: false })
      return result.poll
    },

    vote: async (pollId, optionId) => {
      const poll = get().polls[pollId]
      if (!poll || poll.closed) return
      await mutate(`/api/polls/${pollId}/votes`, 'POST', { option_id: optionId })
    },

    addOptionSuggestion: (pollId, text) =>
      mutate(`/api/polls/${pollId}/options`, 'POST', { text }),

    addComment: (pollId, text) => mutate(`/api/polls/${pollId}/comments`, 'POST', { text }),

    toggleClosePoll: async (pollId) => {
      const poll = get().polls[pollId]
      if (!poll) return
      await mutate(`/api/polls/${pollId}`, 'PATCH', { closed: !poll.closed })
    },

    deletePoll: async (pollId) => {
      const result = await request(`/api/polls/${pollId}`, 'DELETE')
      if (!result.ok) {
        reportFailure(result.status)
        return
      }
      get().removePoll(pollId)
    },
  }
})
