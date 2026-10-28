import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'amoled'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'guilda-theme'

const initialTheme = (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark'
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme)
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme: Theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
    set({ theme })
  },
}))
