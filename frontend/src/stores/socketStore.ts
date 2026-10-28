import { create } from 'zustand'

export type SocketStatus = 'connected' | 'connecting' | 'disconnected'

interface SocketState {
  status: SocketStatus
  setStatus: (status: SocketStatus) => void
}

export const useSocketStore = create<SocketState>((set) => ({
  status: 'connected',
  setStatus: (status) => set({ status }),
}))
