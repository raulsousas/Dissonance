import { create } from 'zustand'

/**
 * Global UI state — theme, sidebar toggles, etc.
 * Per-feature slices (messages, servers) are added in their respective phases.
 */
interface UIStore {
  theme: 'dark' | 'light'
  memberPanelOpen: boolean
  toggleTheme: () => void
  setMemberPanelOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'dark',
  memberPanelOpen: true,

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),

  setMemberPanelOpen: (open) => set({ memberPanelOpen: open }),
}))
