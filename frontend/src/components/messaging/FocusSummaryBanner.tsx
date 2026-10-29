import { useEffect, useState } from 'react'
import { BellOff, BellRing, Link2, AtSign, X } from 'lucide-react'
import { fetchFocusSummary, isEmptySummary, summaryHeadline, type FocusSummary } from '@/lib/focus'
import { useFocusStore } from '@/stores/focusStore'
import { toast } from '@/stores/toastStore'

function jumpToMessage(messageId: string) {
  document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * Shown at the top of a silenced channel: what happened while the user was away
 * (who talked, links, mentions). The summary is fetched once when the channel is
 * opened, before reading moves the "since" marker forward.
 */
export function FocusSummaryBanner({ channelId }: { channelId: string }) {
  const isMuted = useFocusStore((s) => Boolean(s.muted[channelId]))
  const unmute = useFocusStore((s) => s.unmute)
  const [summary, setSummary] = useState<FocusSummary | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Fetched once per opened channel, before reading moves the "since" marker.
  // If the muted list has not loaded yet (page reload) we still ask: the server
  // answers 404 for channels that are not silenced.
  useEffect(() => {
    setSummary(null)
    setDismissed(false)
    const { loaded, muted } = useFocusStore.getState()
    if (loaded && !muted[channelId]) return

    const controller = new AbortController()
    void fetchFocusSummary(channelId, controller.signal).then((result) => {
      if (!controller.signal.aborted) setSummary(result)
    })
    return () => controller.abort()
  }, [channelId])

  if (!isMuted || dismissed || !summary) return null

  async function handleUnmute() {
    const ok = await unmute(channelId)
    if (ok) toast.success('Canal reativado')
    else toast.error('Não foi possível reativar o canal')
  }

  const empty = isEmptySummary(summary)

  return (
    <div
      role="region"
      aria-label="Resumo do modo foco"
      className="mx-3 sm:mx-4 mt-3 rounded-xl border border-[#3C3F48] bg-[#2B2D33] p-3 text-xs text-[#F2F3F5] space-y-2 shrink-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-[13px]">
          <BellOff size={15} className="text-[#7667F5] shrink-0" />
          <span>Modo foco · {summaryHeadline(summary)}</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-[#858B98] hover:text-white cursor-pointer"
          title="Dispensar resumo"
          aria-label="Dispensar resumo"
        >
          <X size={14} />
        </button>
      </div>

      {!empty && summary.authors.length > 0 && (
        <p className="text-[#B5BAC3]">
          <span className="text-[#858B98]">Quem falou: </span>
          {summary.authors.map((a) => `${a.authorName ?? 'Alguém'} (${a.count})`).join(', ')}
        </p>
      )}

      {summary.mentions.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[#858B98]">
            <AtSign size={12} /> Menções
          </p>
          {summary.mentions.map((m) => (
            <button
              key={m.messageId}
              type="button"
              onClick={() => jumpToMessage(m.messageId)}
              className="block w-full text-left px-2 py-1 rounded bg-[#1B1C20] hover:bg-[#25272d] cursor-pointer truncate"
              title="Ir para a mensagem"
            >
              <span className="text-[#28A9F5]">{m.authorName ?? 'Alguém'}</span>
              {m.kind === 'everyone' ? ' (@everyone)' : ''}: {m.preview}
            </button>
          ))}
        </div>
      )}

      {summary.links.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[#858B98]">
            <Link2 size={12} /> Links
          </p>
          {summary.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[#28A9F5] hover:underline"
            >
              {l.url}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleUnmute}
          className="flex items-center gap-1 text-[#B5BAC3] hover:text-white cursor-pointer"
        >
          <BellRing size={12} /> Reativar notificações
        </button>
      </div>
    </div>
  )
}
