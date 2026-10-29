/**
 * PollMessageCard — Compact interactive card rendered inside the channel chat history.
 *
 * Avoids polluting the channel with multiple messages while giving an instant preview
 * of votes and a button to open the isolated discussion thread.
 */

import { useEffect } from 'react'
import {
  Calendar,
  Check,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'
import { usePollStore, isPollClosed } from '@/stores/pollStore'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  pollId: string
  onOpenDetails: (pollId: string) => void
}

export function PollMessageCard({ pollId, onOpenDetails }: Props) {
  const { currentUser } = useAuth()
  const poll = usePollStore((s) => s.polls[pollId])
  const unavailable = usePollStore((s) => s.unavailable[pollId])
  const loadPoll = usePollStore((s) => s.loadPoll)
  const vote = usePollStore((s) => s.vote)

  useEffect(() => {
    void loadPoll(pollId)
  }, [pollId, loadPoll])

  if (!poll) {
    return (
      <div className="p-3 rounded-xl bg-[#202127] border border-[#3C3F48]/40 text-xs text-[#858B98] max-w-md">
        {unavailable ? '📊 Enquete indisponível ou removida.' : '📊 Carregando enquete...'}
      </div>
    )
  }

  const closed = isPollClosed(poll)
  const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0)
  const uniqueVoters = new Set(poll.options.flatMap((o) => o.votes)).size

  function handleVote(optionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUser || closed) return
    void vote(poll.id, optionId)
  }

  return (
    <div
      onClick={() => onOpenDetails(poll.id)}
      className="mt-1.5 p-4 rounded-2xl bg-[#202127] hover:bg-[#202127]/90 border border-[#3C3F48]/60 hover:border-[#3C3F48] transition-all max-w-lg shadow-lg cursor-pointer group/card select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#7667F5]/20 text-[#7667F5] flex items-center justify-center shrink-0 mt-0.5">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-[#F2F3F5] group-hover/card:text-white transition-colors truncate">
              {poll.title}
            </h4>
            <p className="text-[11px] text-[#858B98] truncate">
              Enquete criada por <span className="text-[#B5BAC3] font-semibold">{poll.authorName}</span> ·{' '}
              {uniqueVoters} {uniqueVoters === 1 ? 'voto' : 'votos'}
            </p>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
            closed
              ? 'bg-[#858B98]/20 text-[#858B98]'
              : 'bg-[#35C98A]/15 text-[#35C98A]'
          }`}
        >
          {closed ? 'Encerrada' : 'Aberta'}
        </span>
      </div>

      {/* Options preview */}
      <div className="space-y-2 mb-3">
        {poll.options.slice(0, 4).map((opt) => {
          const count = opt.votes.length
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const hasVoted = Boolean(currentUser && opt.votes.includes(currentUser.id))

          return (
            <div
              key={opt.id}
              onClick={(e) => handleVote(opt.id, e)}
              className={`p-2.5 rounded-xl border transition-all text-xs ${
                hasVoted
                  ? 'bg-[#7667F5]/10 border-[#7667F5]/60'
                  : 'bg-[#1B1C20] border-[#3C3F48]/40 hover:border-[#3C3F48]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                      hasVoted
                        ? 'bg-[#7667F5] text-white'
                        : 'border border-[#3C3F48] text-transparent'
                    }`}
                  >
                    <Check size={8} strokeWidth={3} />
                  </div>
                  <span className={`truncate ${hasVoted ? 'text-white font-bold' : 'text-[#F2F3F5]'}`}>
                    {opt.text}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#858B98] shrink-0">
                  {count} {count === 1 ? 'voto' : 'votos'}
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full h-1.5 rounded-full bg-[#202127] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: '#7667F5',
                  }}
                />
              </div>
            </div>
          )
        })}

        {poll.options.length > 4 && (
          <p className="text-[11px] text-[#858B98] text-center pt-0.5">
            + {poll.options.length - 4} outras opções...
          </p>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-[#3C3F48]/40 flex items-center justify-between gap-2 text-xs">
        {poll.allowComments ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetails(poll.id)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B2D33] hover:bg-[#34363E] text-[#B5BAC3] hover:text-[#F2F3F5] transition-colors font-medium cursor-pointer"
          >
            <MessageSquare size={14} className="text-[#7667F5]" />
            <span>
              {poll.comments.length > 0
                ? `${poll.comments.length} ${poll.comments.length === 1 ? 'comentário' : 'comentários'}`
                : 'Discussão da enquete'}
            </span>
          </button>
        ) : (
          <span className="text-[11px] text-[#858B98]">Comentários desabilitados</span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetails(poll.id)
          }}
          className="flex items-center gap-1 text-[#7667F5] hover:text-[#8B7EF8] font-bold text-xs transition-colors cursor-pointer"
        >
          <span>Abrir enquete</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
