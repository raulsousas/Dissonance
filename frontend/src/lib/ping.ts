export type PingQuality = 'unknown' | 'good' | 'fair' | 'poor'

/** Color-codes a round-trip time. `0` means the SDK has not measured one yet. */
export function classifyPing(ms: number | null | undefined): PingQuality {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return 'unknown'
  if (ms < 100) return 'good'
  if (ms < 200) return 'fair'
  return 'poor'
}

export function formatPing(ms: number | null | undefined): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return 'Medindo...'
  return `${Math.round(ms)} ms`
}

export const PING_COLORS: Record<PingQuality, string> = {
  unknown: '#858B98',
  good: '#35C98A',
  fair: '#F4B942',
  poor: '#F04747',
}
