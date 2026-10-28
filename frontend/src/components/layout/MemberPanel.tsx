/**
 * Right panel showing online members of the current server.
 * Real data loaded in Phase 3.
 */
export default function MemberPanel() {
  return (
    <div className="p-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Members
      </h3>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Select a server to see members.
      </p>
    </div>
  )
}
