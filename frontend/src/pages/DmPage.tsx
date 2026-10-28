/**
 * Direct messages view.
 * Real DM UI implemented in Phase 5.
 */
export default function DmPage() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="text-4xl">💬</div>
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Direct Messages
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          Friends and direct messages will appear here in Phase 5.
        </p>
      </div>
    </div>
  )
}
