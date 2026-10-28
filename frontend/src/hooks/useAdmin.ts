import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AdminUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: 'member' | 'admin'
  insertedAt: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status })
  }
  if (res.status === 204) return undefined as T
  return res.json().then((b) => b.data ?? b)
}

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => apiFetch('/api/admin/users'),
    staleTime: 1000 * 15,
  })
}

export function usePromoteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/admin/users/${userId}/promote`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useRevokeUserAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/admin/users/${userId}/access`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useAllowedEmails() {
  return useQuery<string[]>({
    queryKey: ['admin', 'allowed-emails'],
    queryFn: () => apiFetch('/api/admin/allowed-emails'),
    staleTime: 1000 * 15,
  })
}

export function useAddAllowedEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch('/api/admin/allowed-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'allowed-emails'] }),
  })
}

export function useRemoveAllowedEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch(`/api/admin/allowed-emails/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'allowed-emails'] }),
  })
}
