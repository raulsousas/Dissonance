import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Server {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  ownerId: string
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice' | 'polls'
  topic: string | null
  position: number
  categoryId: string | null
}

export interface Category {
  id: string
  name: string
  position: number
  channels: Channel[]
}

export interface ServerDetail extends Server {
  roles: { id: string; name: string; permissions: number; position: number; isDefault: boolean }[]
  categories: Category[]
  channels: Channel[]
  members: { userId: string; displayName: string; avatarUrl: string | null; role: { id: string; name: string } | null }[]
}

export interface Invite {
  code: string
  maxUses: number | null
  uses: number
  expiresAt: string | null
  createdBy: string
}

// ── Servers ──────────────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status })
  }
  if (res.status === 204) return undefined as T
  return res.json().then((b) => b.data ?? b)
}

export function useServers() {
  return useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: () => apiFetch('/api/servers'),
    staleTime: 1000 * 30,
  })
}

export function useServerDetail(serverId: string | null) {
  return useQuery<ServerDetail>({
    queryKey: ['server', serverId],
    queryFn: () => apiFetch(`/api/servers/${serverId}`),
    enabled: !!serverId,
    staleTime: 1000 * 30,
  })
}

export function useCreateServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attrs: { name: string; description?: string }) =>
      apiFetch<Server>('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attrs),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  })
}

export function useJoinServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<Server>('/api/servers/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  })
}

export function useLeaveServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (serverId: string) =>
      apiFetch(`/api/servers/${serverId}/members/me`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  })
}

export function useDeleteServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (serverId: string) =>
      apiFetch(`/api/servers/${serverId}?confirm=true`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  })
}

export function useUpdateServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serverId, attrs }: { serverId: string; attrs: { name?: string; description?: string } }) =>
      apiFetch<Server>(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attrs),
      }),
    onSuccess: (_data, { serverId }) => {
      qc.invalidateQueries({ queryKey: ['servers'] })
      qc.invalidateQueries({ queryKey: ['server', serverId] })
    },
  })
}

// ── Channels ─────────────────────────────────────────────────────────────────

export function useChannels(serverId: string | null) {
  return useQuery<Category[]>({
    queryKey: ['channels', serverId],
    queryFn: () => apiFetch(`/api/servers/${serverId}/channels`),
    enabled: !!serverId,
    staleTime: 1000 * 30,
  })
}

export function useCreateChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serverId, attrs }: { serverId: string; attrs: { name: string; type?: string; categoryId?: string; category_id?: string } }) =>
      apiFetch<Channel>(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: attrs.name,
          type: attrs.type ?? 'text',
          category_id: attrs.category_id ?? attrs.categoryId,
        }),
      }),
    onSuccess: (_data, { serverId }) => qc.invalidateQueries({ queryKey: ['channels', serverId] }),
  })
}

export function useDeleteChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serverId, channelId }: { serverId: string; channelId: string }) =>
      apiFetch(`/api/servers/${serverId}/channels/${channelId}`, { method: 'DELETE' }),
    onSuccess: (_data, { serverId }) => qc.invalidateQueries({ queryKey: ['channels', serverId] }),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serverId, name }: { serverId: string; name: string }) =>
      apiFetch<Category>(`/api/servers/${serverId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    onSuccess: (_data, { serverId }) => qc.invalidateQueries({ queryKey: ['channels', serverId] }),
  })
}

// ── Invites ───────────────────────────────────────────────────────────────────

export function useInvites(serverId: string | null, enabled: boolean = true) {
  return useQuery<Invite[]>({
    queryKey: ['invites', serverId],
    queryFn: () => apiFetch(`/api/servers/${serverId}/invites`),
    enabled: !!serverId && enabled,
    staleTime: 1000 * 10,
    retry: false,
  })
}

export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serverId, opts }: { serverId: string; opts?: { maxUses?: number; expiresInHours?: number } }) =>
      apiFetch<Invite>(`/api/servers/${serverId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts ?? {}),
      }),
    onSuccess: (_data, { serverId }) => qc.invalidateQueries({ queryKey: ['invites', serverId] }),
  })
}

export function useDeleteInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serverId, code }: { serverId: string; code: string }) =>
      apiFetch(`/api/servers/${serverId}/invites/${code}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, { serverId }) => qc.invalidateQueries({ queryKey: ['invites', serverId] }),
  })
}
