/**
 * Phoenix Socket client singleton.
 *
 * Usage:
 *   import { getSocket } from '@/lib/socket'
 *   const socket = getSocket(sessionToken)
 *   socket.connect()
 */

import { Socket } from 'phoenix'

let _socket: Socket | null = null

export function getSocket(token?: string): Socket {
  if (!_socket) {
    _socket = new Socket('/socket', {
      params: token ? { token } : {},
    })
  }
  return _socket
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
