import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ConversationRecipient {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string | null
}

export interface ConversationLastMessage {
  id: string
  content: string
  insertedAt: string
  authorId: string
}

export interface Conversation {
  id: string
  insertedAt: string
  recipient: ConversationRecipient
  lastMessage: ConversationLastMessage | null
  unreadCount?: number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status })
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const data = await apiFetch<{ data: Conversation[] }>('/api/dm')
      return data.data
    },
    staleTime: 1000 * 15,
  })
}

export function useConversation(conversationId: string | undefined) {
  return useQuery<Conversation>({
    queryKey: ['conversations', conversationId],
    queryFn: async () => {
      const data = await apiFetch<{ data: Conversation }>(`/api/dm/${conversationId}`)
      return data.data
    },
    enabled: Boolean(conversationId),
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ data: Conversation }>('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
