/**
 * PollDetailsModal — Dedicated interactive view and isolated discussion thread for a Poll.
 *
 * Implements real-time voting, vote percentage progress bars, community suggestions,
 * and isolated comment discussions.
 */

import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import {
  Calendar,
  X,
  Plus,
  Check,
  MessageSquare,
  Send,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react'
import { usePollStore, isPollClosed } from '@/stores/pollStore'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  pollId: string | null
  onClose: () => void
  channelName?: string
}

function formatCommentTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '20:42'
  }
}

export function PollDetailsModal({ pollId, onClose, channelName = 'geral' }: Props) {
  const { currentUser } = useAuth()
  const poll = usePollStore((s) => (pollId ? s.polls[pollId] : null))
  const vote = usePollStore((s) => s.vote)
  const addOptionSuggestion = usePollStore((s) => s.addOptionSuggestion)
  const addComment = usePollStore((s) => s.addComment)
  const toggleClosePoll = usePollStore((s) => s.toggleClosePoll)
  const deletePoll = usePollStore((s) => s.deletePoll)

  const [commentText, setCommentText] = useState('')
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const totalVotes = poll
    ? poll.options.reduce((acc, opt) => acc + opt.votes.length, 0)
    : 0

  const uniqueVoters = poll
    ? new Set(poll.options.flatMap((o) => o.votes)).size
    : 0

  const isAuthor = Boolean(currentUser && poll && currentUser.id === poll.authorId)
  const closed = poll ? isPollClosed(poll) : false

  function handleVote(optionId: string) {
    if (!poll || !currentUser || closed) return
    void vote(poll.id, optionId)
  }

  async function handleAddSuggestion(e: React.FormEvent) {
    e.preventDefault()
    if (!poll || !currentUser || !suggestionText.trim() || closed) return

    const ok = await addOptionSuggestion(poll.id, suggestionText.trim())
    if (ok) {
      setSuggestionText('')
      setIsSuggesting(false)
    }
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!poll || !currentUser || !commentText.trim()) return

    const ok = await addComment(poll.id, commentText.trim())
    if (!ok) return
    setCommentText('')

    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  if (!poll) return null

  return (
    <Dialog.Root open={Boolean(pollId)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[92vh] flex flex-col bg-[#1B1C20] text-[#F2F3F5] rounded-2xl border border-[#3C3F48] shadow-2xl z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-150 select-none overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-4 border-b border-[#3C3F48]/40 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#7667F5]/20 text-[#7667F5] flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar size={20} />
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-base sm:text-lg font-bold text-[#F2F3F5] leading-snug">
                    {poll.title}
                  </Dialog.Title>
                  <p className="text-xs text-[#858B98] mt-0.5 truncate">
                    #{channelName} · Enquete criada por <span className="text-[#B5BAC3] font-semibold">{poll.authorName}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${
                    closed
                      ? 'bg-[#858B98]/20 text-[#858B98]'
                      : 'bg-[#35C98A]/15 text-[#35C98A]'
                  }`}
                >
                  {closed ? 'Encerrada' : 'Aberta'}
                </span>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-[#858B98] hover:text-[#F2F3F5] hover:bg-[#2B2D33] transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Poll Status bar */}
            <div className="flex items-center justify-between text-xs text-[#858B98] mt-3">
              <span>
                {poll.options.length} {poll.options.length === 1 ? 'opção' : 'opções'} · {uniqueVoters}{' '}
                {uniqueVoters === 1 ? 'participante votou' : 'participantes votaram'}
              </span>

              {isAuthor && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void toggleClosePoll(poll.id)}
                    className="flex items-center gap-1 text-[11px] text-[#858B98] hover:text-white transition-colors cursor-pointer"
                  >
                    {poll.closed ? <Unlock size={12} /> : <Lock size={12} />}
                    <span>{poll.closed ? 'Reabrir' : 'Encerrar'}</span>
                  </button>
                  <button
                    onClick={() => void deletePoll(poll.id)}
                    className="flex items-center gap-1 text-[11px] text-[#858B98] hover:text-[#F04747] transition-colors cursor-pointer"
                    title="Excluir enquete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Options List with Progress Bars */}
            <div className="space-y-3.5">
              {poll.options.map((opt) => {
                const count = opt.votes.length
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                const hasVoted = Boolean(currentUser && opt.votes.includes(currentUser.id))

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleVote(opt.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleVote(opt.id)
                    }}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      hasVoted
                        ? 'bg-[#7667F5]/10 border-[#7667F5]/60 shadow-xs'
                        : 'bg-[#202127] border-[#3C3F48]/60 hover:border-[#3C3F48] hover:bg-[#2B2D33]/60'
                    } ${closed ? 'opacity-85 cursor-default' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5 font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            hasVoted
                              ? 'bg-[#7667F5] text-white'
                              : 'border border-[#3C3F48] text-transparent'
                          }`}
                        >
                          <Check size={10} strokeWidth={3} />
                        </div>
                        <span className={`truncate ${hasVoted ? 'text-white font-bold' : 'text-[#F2F3F5]'}`}>
                          {opt.text}
                        </span>
                        {opt.isCommunitySuggestion && (
                          <span className="text-[10px] font-bold text-[#858B98] bg-[#1B1C20] px-1.5 py-0.5 rounded border border-[#3C3F48]">
                            sugestão
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold text-[#858B98] group-hover:text-[#F2F3F5] transition-colors shrink-0">
                        {count} {count === 1 ? 'voto' : 'votos'} ({pct}%)
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-2 rounded-full bg-[#1B1C20] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: hasVoted ? '#7667F5' : '#7667F5/80',
                          backgroundColor: '#7667F5',
                        }}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Suggestion Box */}
              {poll.allowSuggestions && !closed && (
                <div className="pt-1">
                  {!isSuggesting ? (
                    <button
                      onClick={() => setIsSuggesting(true)}
                      className="w-full py-2 px-4 rounded-full border border-[#3C3F48] hover:border-[#7667F5] bg-[#202127]/60 hover:bg-[#202127] text-xs font-semibold text-[#B5BAC3] hover:text-[#F2F3F5] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Sugerir outro horário</span>
                    </button>
                  ) : (
                    <form onSubmit={handleAddSuggestion} className="space-y-2 p-3 rounded-xl bg-[#202127] border border-[#3C3F48]">
                      <input
                        value={suggestionText}
                        onChange={(e) => setSuggestionText(e.target.value)}
                        placeholder="Digite sua sugestão de horário ou opção..."
                        autoFocus
                        className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-xs text-[#F2F3F5] outline-none border border-[#3C3F48] focus:border-[#7667F5]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!suggestionText.trim()}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#7667F5] hover:bg-[#6858E5] text-white transition-opacity disabled:opacity-50 cursor-pointer"
                        >
                          Adicionar sugestão
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsSuggesting(false); setSuggestionText('') }}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#858B98] hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Isolated Discussion Section */}
            {poll.allowComments && (
              <div className="pt-4 border-t border-[#3C3F48]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#F2F3F5]">
                    <MessageSquare size={16} className="text-[#7667F5]" />
                    <span>Discussão da enquete</span>
                  </div>
                  <span className="text-xs font-semibold text-[#858B98]">
                    {poll.comments.length}{' '}
                    {poll.comments.length === 1 ? 'comentário' : 'comentários'}
                  </span>
                </div>

                {/* Comments List */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {poll.comments.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#858B98] bg-[#202127]/40 rounded-xl border border-[#3C3F48]/30">
                      Nenhum comentário ainda. Inicie a discussão sobre esta enquete!
                    </div>
                  ) : (
                    poll.comments.map((comm) => (
                      <div key={comm.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#202127]/60 transition-colors">
                        <Avatar.Root className="w-7 h-7 rounded-full overflow-hidden block bg-[#2B2D33] shrink-0 mt-0.5">
                          <Avatar.Image src={comm.authorAvatar ?? undefined} alt={comm.authorName} className="w-full h-full object-cover" />
                          <Avatar.Fallback className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-[#7667F5]">
                            {comm.authorName[0]?.toUpperCase()}
                          </Avatar.Fallback>
                        </Avatar.Root>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-xs font-bold text-[#F2F3F5] truncate">
                              {comm.authorName}
                            </span>
                            <span className="text-[10px] text-[#858B98]">
                              {formatCommentTime(comm.insertedAt)}
                            </span>
                          </div>
                          <p className="text-xs text-[#B5BAC3] leading-relaxed break-words">
                            {comm.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Info Disclaimer */}
                <p className="text-[11px] text-[#858B98] text-center pt-1">
                  Os comentários ficam somente nesta discussão, não no canal #{channelName}.
                </p>
              </div>
            )}
          </div>

          {/* Comment input footer */}
          {poll.allowComments && (
            <div className="p-3 px-5 border-t border-[#3C3F48]/40 bg-[#1B1C20] shrink-0">
              <form onSubmit={handleSendComment} className="relative flex items-center w-full">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Comentar nesta enquete..."
                  className="w-full h-10 pl-4 pr-11 rounded-full text-xs bg-[#202127] text-[#F2F3F5] placeholder-[#858B98] outline-none border border-[#3C3F48] focus:border-[#7667F5] transition-all"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="absolute right-1.5 w-7 h-7 rounded-full bg-[#7667F5] text-white flex items-center justify-center transition-opacity disabled:opacity-40 cursor-pointer"
                  title="Enviar comentário"
                >
                  <Send size={13} className="ml-0.5" />
                </button>
              </form>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
