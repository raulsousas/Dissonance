import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  children: React.ReactNode
  requireAdmin?: boolean
}

/**
 * Wraps any route that requires authentication.
 * While auth state is loading, shows nothing (prevents flash).
 * If the user is not authenticated, redirects to /login.
 * If requireAdmin is true and role !== 'admin', redirects to /app.
 */
export default function ProtectedRoute({ children, requireAdmin }: Props) {
  const { currentUser, isAuthenticated, isLoading } = useAuth()

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

  if (requireAdmin && currentUser?.role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
