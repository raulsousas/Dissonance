import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useSocketStore } from '@/stores/socketStore'
import { getSocket } from '@/lib/socket'

export function ConnectionBanner() {
  const status = useSocketStore((state) => state.status)

  if (status === 'connected') return null

  return (
    <div className="bg-[#f23f43] text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold z-40 shrink-0 select-none shadow-md">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="shrink-0 animate-bounce" />
        <span>Conexão perdida com o servidor. Reconectando em tempo real...</span>
      </div>
      <button
        onClick={() => {
          const socket = getSocket()
          socket.disconnect()
          socket.connect()
        }}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-black/20 hover:bg-black/30 rounded text-[11px] font-bold transition-colors cursor-pointer"
      >
        <RefreshCw size={12} className="animate-spin" />
        Tentar agora
      </button>
    </div>
  )
}
