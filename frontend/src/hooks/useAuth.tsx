import { createContext, useContext, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { updateGlobalStatus, updateGlobalProfile } from '@/stores/presenceStore'

export interface CurrentUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  status: 'online' | 'away' | 'dnd' | 'invisible' | 'offline'
  role: 'member' | 'admin'
  token?: string | null
}

interface AuthContextValue {
  currentUser: CurrentUser | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  updateStatus: (status: CurrentUser['status']) => Promise<void>
  updateUser: (fields: Partial<CurrentUser>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (res.status === 401) throw new Error('unauthenticated')
  if (!res.ok) throw new Error('failed to fetch user')
  const body = await res.json()
  return body.data as CurrentUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: currentUser, isLoading } = useQuery<CurrentUser | null>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await fetchCurrentUser()
      } catch {
        return null
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  })

  async function logout() {
    await fetch('/auth/logout', { method: 'DELETE', credentials: 'include' })
    queryClient.clear()
    window.location.href = '/login'
  }

  async function updateStatus(status: CurrentUser['status']) {
    // 1. Optimistically update local query cache
    queryClient.setQueryData<CurrentUser | null>(['currentUser'], (prev) =>
      prev ? { ...prev, status } : prev
    )

    // 2. Broadcast via socket presence
    if (currentUser?.id) {
      updateGlobalStatus(status, currentUser.id)
    }

    // 3. Persist to backend database
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      })
    } catch (err) {
      console.error('Failed to persist status to backend:', err)
    }
  }

  async function updateUser(fields: Partial<CurrentUser>) {
    queryClient.setQueryData<CurrentUser | null>(['currentUser'], (prev) =>
      prev ? { ...prev, ...fields } : prev
    )

    if (fields.status && currentUser?.id) {
      updateGlobalStatus(fields.status, currentUser.id)
    }

    if ((fields.displayName !== undefined || fields.avatarUrl !== undefined) && currentUser?.id) {
      updateGlobalProfile(fields.displayName ?? currentUser.displayName, fields.avatarUrl !== undefined ? fields.avatarUrl : currentUser.avatarUrl)
    }

    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: fields.displayName,
          avatarUrl: fields.avatarUrl,
          status: fields.status,
        }),
        credentials: 'include',
      })
      queryClient.invalidateQueries({ queryKey: ['server'] })
    } catch (err) {
      console.error('Failed to update user profile:', err)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser ?? null,
        isLoading,
        isAuthenticated: !!currentUser,
        logout,
        updateStatus,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
