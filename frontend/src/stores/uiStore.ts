import { create } from 'zustand'

interface UIState {
  isMobileNavOpen: boolean
  isMobileMembersOpen: boolean
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
  toggleMobileNav: () => set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen, isMobileMembersOpen: false })),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  openMobileNav: () => set({ isMobileNavOpen: true, isMobileMembersOpen: false }),
  toggleMobileMembers: () => set((state) => ({ isMobileMembersOpen: !state.isMobileMembersOpen, isMobileNavOpen: false })),
  closeMobileMembers: () => set({ isMobileMembersOpen: false }),
  openMobileMembers: () => set({ isMobileMembersOpen: true, isMobileNavOpen: false }),
}))
