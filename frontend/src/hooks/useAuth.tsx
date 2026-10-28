import { createContext, useContext, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface CurrentUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  status: 'online' | 'away' | 'dnd' | 'invisible' | 'offline'
  role: 'member' | 'admin'
}

interface AuthContextValue {
  currentUser: CurrentUser | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
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

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser ?? null,
        isLoading,
        isAuthenticated: !!currentUser,
        logout,
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
