import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChannels } from '@/hooks/useServers'
import logoVetorizada from '@/images/logo_vetorizada.png'

/**
 * Welcome / empty state shown when no channel is selected.
 * Automatically navigates to the first channel if channels exist on the selected server.
 */
export default function WelcomePage() {
  const { serverId } = useParams<{ serverId?: string }>()
  const { data: categories = [] } = useChannels(serverId ?? null)
  const navigate = useNavigate()

  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
    if (isDesktop && serverId && categories.length > 0) {
      const firstChannel = categories.flatMap((c) => c.channels)[0]
      if (firstChannel) {
        navigate(`/app/servers/${serverId}/channels/${firstChannel.id}`, { replace: true })
      }
    }
  }, [serverId, categories, navigate])

  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <img
          src={logoVetorizada}
          alt="Dissonance Logo"
          className="w-20 h-20 mx-auto object-contain drop-shadow-md"
        />
        <h2
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Welcome to Dissonance
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          Select a server and channel from the sidebar to start chatting.
        </p>
      </div>
    </div>
  )
}
