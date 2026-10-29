import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// The proxy target is the backend service name inside the Docker network.
// When running outside Docker (host dev), falls back to localhost:4000.
const BACKEND = process.env.VITE_API_URL ?? 'http://localhost:4000'
const LIVEKIT = process.env.VITE_LIVEKIT_BACKEND ?? 'http://livekit:7880'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    watch: {
      // Use polling on Docker/WSL2 where inotify does not propagate host changes
      usePolling: true,
      interval: 300,
    },
    proxy: {
      // Static uploaded files proxied to Phoenix backend
      '/uploads': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
      // OAuth routes proxied to Phoenix backend
      '/auth': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
      // All /api requests are proxied to the Phoenix backend.
      // changeOrigin: true rewrites the Host header to match the target,
      // which is required for Phoenix to accept the request.
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
      // WebSocket for Phoenix Channels (Phase 4)
      '/socket': {
        target: BACKEND,
        ws: true,
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
      // LiveKit WebRTC signaling WebSocket
      '/rtc': {
        target: LIVEKIT,
        ws: true,
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
    },
  },
})
