/**
 * Phoenix Socket client singleton.
 *
 * Usage:
 *   import { getSocket } from '@/lib/socket'
 *   const socket = getSocket(sessionToken)
 *   socket.connect()
 */

import { Socket } from 'phoenix'
import { useSocketStore } from '@/stores/socketStore'

let _socket: Socket | null = null
let _currentToken: string | undefined = undefined

export function getSocket(token?: string | null): Socket {
  const effectiveToken = token ?? undefined
  if (!_socket || (effectiveToken && effectiveToken !== _currentToken)) {
    if (_socket) {
      _socket.disconnect()
    }
    _currentToken = effectiveToken
    _socket = new Socket('/socket', {
      params: effectiveToken ? { token: effectiveToken } : {},
    })

    _socket.onOpen(() => {
      useSocketStore.getState().setStatus('connected')
    })

    _socket.onClose(() => {
      useSocketStore.getState().setStatus('disconnected')
    })

    _socket.onError(() => {
      useSocketStore.getState().setStatus('disconnected')
    })
  }
  return _socket
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
    _currentToken = undefined
    useSocketStore.getState().setStatus('disconnected')
  }
}
