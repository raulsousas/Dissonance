/**
 * TypingIndicator — shows who is currently typing in the channel.
 */

import type { TypingUser } from '@/stores/messagingStore'

interface Props {
  users: TypingUser[]
}

export function TypingIndicator({ users }: Props) {
  if (users.length === 0) return null

  const names =
    users.length === 1
      ? `${users[0].displayName} is typing…`
      : users.length === 2
        ? `${users[0].displayName} and ${users[1].displayName} are typing…`
        : 'Several people are typing…'

  return (
    <div className="px-4 pb-1 flex items-center gap-1.5 h-5">
      <span className="flex gap-0.5 items-end">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1 h-1 rounded-full animate-bounce"
            style={{
              background: 'var(--color-text-muted)',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {names}
      </span>
    </div>
  )
}
