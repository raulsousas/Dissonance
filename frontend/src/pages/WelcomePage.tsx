import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChannels } from '@/hooks/useServers'

/**
 * Welcome / empty state shown when no channel is selected.
 * Automatically navigates to the first channel if channels exist on the selected server.
 */
export default function WelcomePage() {
  const { serverId } = useParams<{ serverId?: string }>()
  const { data: categories = [] } = useChannels(serverId ?? null)
  const navigate = useNavigate()

  useEffect(() => {
    if (serverId && categories.length > 0) {
      const firstChannel = categories.flatMap((c) => c.channels)[0]
      if (firstChannel) {
        navigate(`/app/servers/${serverId}/channels/${firstChannel.id}`, { replace: true })
      }
    }
  }, [serverId, categories, navigate])

  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="text-5xl">⚔️</div>
        <h2
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Welcome to Guilda
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          Select a server and channel from the sidebar to start chatting.
        </p>
      </div>
    </div>
  )
}
