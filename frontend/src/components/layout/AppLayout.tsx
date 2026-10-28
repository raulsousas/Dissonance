import { Outlet, useMatch } from 'react-router-dom'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import UserBar from './UserBar'
import MemberPanel from './MemberPanel'

export default function AppLayout() {
  // useParams only sees params defined at this route level (/app).
  // useMatch reads the full current URL so we can extract serverId from
  // any child route pattern (/app/servers/:serverId/...).
  const matchServer = useMatch('/app/servers/:serverId')
  const matchChannel = useMatch('/app/servers/:serverId/channels/:channelId')
  const serverId = matchChannel?.params.serverId ?? matchServer?.params.serverId ?? null

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Left: server icon bar + user bar */}
      <div className="flex flex-col shrink-0" style={{ width: '72px', background: 'var(--color-bg-primary)' }}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <ServerSidebar selectedServerId={serverId} />
        </div>
        <UserBar />
      </div>

      {/* Channel list sidebar */}
      <div className="w-60 shrink-0 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
        <ChannelSidebar serverId={serverId} />
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
        <Outlet />
      </main>

      {/* Right: member panel */}
      <aside className="w-60 shrink-0 hidden xl:block overflow-y-auto" style={{ background: 'var(--color-bg-secondary)' }}>
        <MemberPanel />
      </aside>
    </div>
  )
}
