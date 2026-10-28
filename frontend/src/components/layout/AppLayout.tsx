import { Outlet, useMatch } from 'react-router-dom'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import DmSidebar from './DmSidebar'
import UserBar from './UserBar'
import MemberPanel from './MemberPanel'
import { VoiceControlsBar } from '@/components/voice/VoiceControlsBar'
import { ConnectionBanner } from '@/components/ui/ConnectionBanner'
import { useUserNotifications } from '@/hooks/useUserNotifications'

export default function AppLayout() {
  useUserNotifications()
  // useParams only sees params defined at this route level (/app).
  // useMatch reads the full current URL so we can extract serverId from
  // any child route pattern (/app/servers/:serverId/...).
  const matchServer = useMatch('/app/servers/:serverId')
  const matchChannel = useMatch('/app/servers/:serverId/channels/:channelId')
  const serverId = matchChannel?.params.serverId ?? matchServer?.params.serverId ?? null

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Left: server icon bar (72px) */}
      <div className="w-[72px] shrink-0 flex flex-col overflow-y-auto overflow-x-hidden" style={{ background: 'var(--color-bg-primary)' }}>
        <ServerSidebar selectedServerId={serverId} />
      </div>

      {/* Channel / DM list sidebar (240px) + voice controls + UserBar at bottom */}
      <div className="w-60 shrink-0 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {serverId ? <ChannelSidebar serverId={serverId} /> : <DmSidebar />}
        </div>
        <VoiceControlsBar />
        <UserBar />
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
        <ConnectionBanner />
        <Outlet />
      </main>

      {/* Right: member panel (only for servers) */}
      {serverId && (
        <aside className="w-60 shrink-0 hidden xl:block overflow-y-auto border-l" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
          <MemberPanel />
        </aside>
      )}
    </div>
  )
}
