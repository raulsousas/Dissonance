import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useJoinServer } from '@/hooks/useServers'

/**
 * /invite/:code — handles invite links.
 * If authenticated, auto-joins and redirects to the server.
 * If not authenticated, redirects to login with the code saved.
 */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const join = useJoinServer()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      navigate(`/login?redirect=/invite/${code}`, { replace: true })
      return
    }

    if (!code) {
      navigate('/app', { replace: true })
      return
    }

    join.mutateAsync(code)
      .then((server) => navigate(`/app/servers/${server.id}`, { replace: true }))
      .catch(() => navigate('/app?error=invite_failed', { replace: true }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, code])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
      <p className="text-sm animate-pulse" style={{ color: 'var(--color-text-muted)' }}>
        Joining server…
      </p>
    </div>
  )
}
