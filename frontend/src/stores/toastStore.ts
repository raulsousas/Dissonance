/**
 * Toast store for managing global notifications.
 */

import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  title: string
  description?: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (item) => {
    const id = Math.random().toString(36).slice(2, 9)
    const newToast: ToastItem = { ...item, id }
    set((state) => ({ toasts: [...state.toasts, newToast] }))
    return id
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, type: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, type: 'error' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, type: 'info' }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, type: 'warning' }),
}
