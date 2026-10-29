/**
 * NudgeButton — a subtle "get attention" action for friends.
 *
 * Design choices to keep it from becoming annoying:
 *  - only available between friends, and never for friends who opted out;
 *  - a 5 min cooldown per friend (enforced by the backend, mirrored locally);
 *  - the receiver only gets a quiet sound + a short toast (no modal, no focus steal);
 *  - friends in "Do not disturb" are never interrupted.
 */

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { useNudgeFriend } from '@/hooks/useFriends'
import { toast } from '@/stores/toastStore'

const COOLDOWN_MS = 5 * 60 * 1000

// Survives popover close/open so the cooldown can't be bypassed by reopening the profile.
const cooldownUntil: Record<string, number> = {}

interface Props {
  friendId: string
  friendName: string
  allowNudges?: boolean
}

export function NudgeButton({ friendId, friendName, allowNudges = true }: Props) {
  const nudge = useNudgeFriend()
  const [until, setUntil] = useState(cooldownUntil[friendId] ?? 0)

  useEffect(() => {
    const remaining = until - Date.now()
    if (remaining <= 0) return
    const t = setTimeout(() => setUntil(0), remaining)
    return () => clearTimeout(t)
  }, [until])

  const coolingDown = until > Date.now()

  function startCooldown(ms: number) {
    const end = Date.now() + ms
    cooldownUntil[friendId] = end
    setUntil(end)
  }

  async function handleClick() {
    try {
      await nudge.mutateAsync(friendId)
      startCooldown(COOLDOWN_MS)
      toast.success(`Você chamou a atenção de ${friendName}`)
    } catch (err: any) {
      if (err?.status === 429) {
        startCooldown((err.retryAfter ?? 300) * 1000)
        toast.info('Você já chamou a atenção há pouco', 'Tente novamente em alguns minutos.')
      } else if (err?.message === 'nudges_disabled') {
        toast.info(`${friendName} desativou os chamados de atenção`)
      } else {
        toast.error('Não foi possível chamar a atenção')
      }
    }
  }

  const disabled = !allowNudges || coolingDown || nudge.isPending
  const title = !allowNudges
    ? `${friendName} desativou os chamados de atenção`
    : coolingDown
    ? 'Você já chamou a atenção há pouco'
    : `Chamar a atenção de ${friendName}`

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="py-1.5 px-3 rounded text-xs font-semibold bg-[#34363E] hover:bg-[#3B3E47] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <BellRing size={14} />
      {coolingDown ? 'Chamado' : 'Chamar'}
    </button>
  )
}
