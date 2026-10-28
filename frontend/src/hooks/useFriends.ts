import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface FriendUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  status: string | null
  friendshipId: string
  since: string
}

export interface FriendRequestUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  status: string | null
}

export interface FriendRequest {
  id: string
  status: 'pending'
  insertedAt: string
  user: FriendRequestUser
}

export interface PendingRequests {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
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

export function useFriends() {
  return useQuery<FriendUser[]>({
    queryKey: ['friends'],
    queryFn: async () => {
      const data = await apiFetch<{ data: FriendUser[] }>('/api/friends')
      return data.data
    },
    staleTime: 1000 * 30,
  })
}

export function usePendingRequests() {
  return useQuery<PendingRequests>({
    queryKey: ['friend-requests'],
    queryFn: async () => {
      const data = await apiFetch<{ data: PendingRequests }>('/api/friends/requests')
      return data.data
    },
    staleTime: 1000 * 15,
  })
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: string) =>
      apiFetch('/api/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      apiFetch(`/api/friends/requests/${requestId}/accept`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      apiFetch(`/api/friends/requests/${requestId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })
}

export function useRemoveFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (friendId: string) =>
      apiFetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })
}
