import { useEffect } from 'react'
import { Outlet, useMatch, useLocation } from 'react-router-dom'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import DmSidebar from './DmSidebar'
import UserBar from './UserBar'
import MemberPanel from './MemberPanel'
import { MembersPanelHandle } from './MembersPanelHandle'
import { SidebarResizeHandle } from './SidebarResizeHandle'
import { VoiceControlsBar } from '@/components/voice/VoiceControlsBar'
import { ConnectionBanner } from '@/components/ui/ConnectionBanner'
import { useUserNotifications } from '@/hooks/useUserNotifications'
import { useUIStore } from '@/stores/uiStore'

export default function AppLayout() {
  useUserNotifications()
  const location = useLocation()

  const matchServer = useMatch('/app/servers/:serverId')
  const matchChannel = useMatch('/app/servers/:serverId/channels/:channelId')
  const matchConversation = useMatch('/app/dm/:conversationId')
  const serverId = matchChannel?.params.serverId ?? matchServer?.params.serverId ?? null

  const hasActiveChat = Boolean(matchChannel || matchConversation)

  const {
    isMobileNavOpen,
    isMobileMembersOpen,
    isMembersPanelCollapsed,
    sidebarWidth,
    closeMobileNav,
    closeMobileMembers,
  } = useUIStore()

  // Automatically close mobile drawers on navigation
  useEffect(() => {
    closeMobileNav()
    closeMobileMembers()
  }, [location.pathname, closeMobileNav, closeMobileMembers])

  return (
    <div className="flex h-full w-full overflow-hidden relative select-none bg-[#1B1C20] text-[#F2F3F5]">
      {/* ── MOBILE BACKDROP OVERLAY (only when in active chat and drawer is opened) ── */}
      {hasActiveChat && (isMobileNavOpen || isMobileMembersOpen) && (
        <div
          onClick={() => {
            closeMobileNav()
            closeMobileMembers()
          }}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* ── LEFT NAVIGATION (DESKTOP: SIDEBAR / MOBILE: FULL VIEW OR DRAWER) ── */}
      <div
        style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
        className={`${
          !hasActiveChat
            ? 'flex w-full md:w-auto h-full relative z-10'
            : `fixed md:relative inset-y-0 left-0 z-50 flex w-[calc(100vw-48px)] max-w-[360px] md:w-auto transition-transform duration-200 ease-out md:translate-x-0 ${
                isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
              }`
        }`}
      >
        {/* Server icon bar (68-72px) */}
        <div
          className="w-[72px] shrink-0 flex flex-col overflow-y-auto overflow-x-hidden bg-[#1B1C20] border-r border-[#3C3F48]/30 z-10"
        >
          <ServerSidebar selectedServerId={serverId} />
        </div>

        {/* Channel / DM list sidebar + voice controls + UserBar at bottom */}
        <div
          className="flex-1 md:w-[var(--sidebar-w)] shrink-0 flex flex-col overflow-hidden bg-[#202127] rounded-tl-[24px] md:rounded-tl-none border-r border-[#3C3F48]/40 shadow-2xl md:shadow-none"
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {serverId ? <ChannelSidebar serverId={serverId} /> : <DmSidebar />}
          </div>
          <VoiceControlsBar />
          <UserBar />
        </div>

        {/* Drag handle on the right edge of the channel / DM list (desktop) */}
        <SidebarResizeHandle />
      </div>

      {/* ── MAIN CONTENT VIEW (HIDDEN ON MOBILE WHEN ON HOME/SERVER LIST VIEW) ── */}
      <main
        className={`flex-1 flex-col overflow-hidden w-full min-w-0 bg-[#1B1C20] ${
          !hasActiveChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConnectionBanner />
        <Outlet />
      </main>

      {/* ── Draggable collapse / expand handle on the member panel's left edge (desktop) ── */}
      {serverId && hasActiveChat && <MembersPanelHandle />}

      {/* ── RIGHT MEMBER PANEL (DESKTOP ASIDE & MOBILE DRAWER) ───────── */}
      {serverId && hasActiveChat && (
        <aside
          className={`fixed md:static inset-y-0 right-0 z-50 w-64 md:w-60 shrink-0 overflow-y-auto border-l border-[#3C3F48]/40 transition-transform duration-200 ease-out bg-[#202127] ${
            isMobileMembersOpen
              ? 'translate-x-0 shadow-2xl block'
              : isMembersPanelCollapsed
              ? 'translate-x-full hidden'
              : 'translate-x-full md:translate-x-0 hidden xl:block'
          }`}
        >
          <MemberPanel serverId={serverId} />
        </aside>
      )}
    </div>
  )
}
