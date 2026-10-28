/**
 * Welcome / empty state shown when no channel is selected.
 * Real content added in Phase 4.
 */
export default function WelcomePage() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="text-5xl">⚔️</div>
        <h2
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Welcome to Guilda
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          Select a server and channel from the sidebar to start chatting.
        </p>
      </div>
    </div>
  )
}
