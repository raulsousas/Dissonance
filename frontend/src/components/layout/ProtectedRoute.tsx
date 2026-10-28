import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  children: React.ReactNode
}

/**
 * Wraps any route that requires authentication.
 * While auth state is loading, shows nothing (prevents flash).
 * If the user is not authenticated, redirects to /login.
 */
export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg-primary)]">
        <span className="text-[var(--color-text-muted)] text-sm animate-pulse">Loading…</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
