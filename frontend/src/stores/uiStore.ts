import { create } from 'zustand'

const MEMBERS_COLLAPSED_KEY = 'guilda-members-panel-collapsed'
const SIDEBAR_WIDTH_KEY = 'guilda-sidebar-width'

export const SIDEBAR_DEFAULT_WIDTH = 288
export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 480

function clampSidebarWidth(w: number): number {
  return Math.min(Math.max(Math.round(w), SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH)
}

function readSidebarWidth(): number {
  try {
    const v = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? '', 10)
    return Number.isFinite(v) ? clampSidebarWidth(v) : SIDEBAR_DEFAULT_WIDTH
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

function readMembersCollapsed(): boolean {
  try {
    return localStorage.getItem(MEMBERS_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

interface UIState {
  isMobileNavOpen: boolean
  isMobileMembersOpen: boolean
  /** Desktop only: hides the right-hand member list. Persisted across reloads. */
  isMembersPanelCollapsed: boolean
  toggleMembersPanelCollapsed: () => void
  /** Desktop only: width in px of the channel / DM list column. Persisted across reloads. */
  sidebarWidth: number
  setSidebarWidth: (width: number, persist?: boolean) => void
  toggleMobileNav: () => void
  closeMobileNav: () => void
  openMobileNav: () => void
  toggleMobileMembers: () => void
  closeMobileMembers: () => void
  openMobileMembers: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isMobileNavOpen: false,
  isMobileMembersOpen: false,
  sidebarWidth: readSidebarWidth(),
  setSidebarWidth: (width, persist = true) => {
    const next = clampSidebarWidth(width)
    if (persist) {
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next))
      } catch {
        /* storage unavailable — keep in-memory width only */
      }
    }
    set({ sidebarWidth: next })
  },
  isMembersPanelCollapsed: readMembersCollapsed(),
  toggleMembersPanelCollapsed: () =>
    set((state) => {
      const next = !state.isMembersPanelCollapsed
      try {
        localStorage.setItem(MEMBERS_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable — keep in-memory state only */
      }
      return { isMembersPanelCollapsed: next }
    }),
  toggleMobileNav: () => set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen, isMobileMembersOpen: false })),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  openMobileNav: () => set({ isMobileNavOpen: true, isMobileMembersOpen: false }),
  toggleMobileMembers: () => set((state) => ({ isMobileMembersOpen: !state.isMobileMembersOpen, isMobileNavOpen: false })),
  closeMobileMembers: () => set({ isMobileMembersOpen: false }),
  openMobileMembers: () => set({ isMobileMembersOpen: true, isMobileNavOpen: false }),
}))
