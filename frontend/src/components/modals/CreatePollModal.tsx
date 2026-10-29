/**
 * CreatePollModal — Modal for creating interactive polls in Dissonance.
 *
 * Implements title, multiple voting options, community suggestion settings,
 * multiple choice, comments toggle, and expiration date.
 */

import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Vote,
  X,
  Plus,
  Check,
  Calendar,
  Clock,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import { usePollStore } from '@/stores/pollStore'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  open: boolean
  onClose: () => void
  channelId: string
  /** Where the poll lives: a server channel or a DM conversation. */
  scope: 'channel' | 'dm'
  onPollCreated?: (pollId: string, title: string) => void
}

function formatDatetimeToText(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' })
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${capitalizedWeekday}, ${day}/${month} às ${hours}:${minutes}`
}

function formatExpirationDisplay(isoString: string): string {
  if (!isoString) return 'Selecione uma data'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} às ${hours}:${minutes}`
}

function getDefaultExpirationDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 16)
}

export function CreatePollModal({ open, onClose, channelId, scope, onPollCreated }: Props) {
  const { currentUser } = useAuth()
  const createPoll = usePollStore((s) => s.createPoll)
  const expirationInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('Qual horário vamos fazer a raid?')
  const [options, setOptions] = useState<string[]>([
    'Sábado às 18h',
    'Sábado às 20h',
    'Domingo às 16h',
  ])
  const [allowSuggestions, setAllowSuggestions] = useState(true)
  const [multipleChoice, setMultipleChoice] = useState(false)
  const [allowComments, setAllowComments] = useState(true)
  const [expiresAt, setExpiresAt] = useState(getDefaultExpirationDate)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function openExpirationPicker() {
    if (expirationInputRef.current) {
      if (typeof expirationInputRef.current.showPicker === 'function') {
        expirationInputRef.current.showPicker()
      } else {
        expirationInputRef.current.focus()
      }
    }
  }

  function handleAddOption() {
    if (options.length >= 10) return
    setOptions((prev) => [...prev, ''])
  }

  function handleOptionChange(index: number, val: string) {
    setOptions((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
  }

  function handleRemoveOption(index: number) {
    if (options.length <= 2) {
      setError('A enquete precisa de no mínimo 2 opções.')
      return
    }
    setError(null)
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (submitting) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Por favor, informe o título da enquete.')
      return
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean)
    if (validOptions.length < 2) {
      setError('Adicione pelo menos 2 opções válidas para votação.')
      return
    }

    if (!currentUser) return

    setSubmitting(true)
    const poll = await createPoll({
      scope,
      channelId,
      title: trimmedTitle,
      options: validOptions,
      allowSuggestions,
      multipleChoice,
      allowComments,
      expiresAt: expiresAt.trim() || null,
    })
    setSubmitting(false)

    // On failure the store already showed an error toast; keep the form open.
    if (!poll) return

    onPollCreated?.(poll.id, poll.title)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#1B1C20] text-[#F2F3F5] rounded-2xl border border-[#3C3F48] p-6 shadow-2xl z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#3C3F48]/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#7667F5]/20 text-[#7667F5] flex items-center justify-center">
                <Vote size={18} />
              </div>
              <Dialog.Title className="text-lg font-bold text-[#F2F3F5] tracking-tight">
                Nova enquete
              </Dialog.Title>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#858B98] hover:text-[#F2F3F5] hover:bg-[#2B2D33] transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-[#F04747]/10 border border-[#F04747]/30 text-[#F04747] text-xs flex items-center gap-2 font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#B5BAC3]">
                Título da enquete
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Qual horário vamos fazer a raid?"
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl bg-[#202127] text-sm text-[#F2F3F5] placeholder-[#858B98] outline-none border border-[#3C3F48]/70 focus:border-[#7667F5] transition-colors"
              />
            </div>

            {/* Options List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B5BAC3]">
                  Opções para votação
                </label>
                <span className="text-[11px] text-[#858B98]">Digite ou use o relógio para escolher data/hora</span>
              </div>

              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="relative flex items-center gap-2">
                    {/* Highlighted Left Date/Time Button */}
                    <label
                      className="w-9 h-9 rounded-xl bg-[#7667F5]/20 hover:bg-[#7667F5] text-[#7667F5] hover:text-white border border-[#7667F5]/40 flex items-center justify-center transition-all cursor-pointer shrink-0 relative shadow-xs"
                      title="Escolher data e horário para esta opção"
                    >
                      <Clock size={16} />
                      <input
                        type="datetime-local"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleOptionChange(idx, formatDatetimeToText(e.target.value))
                          }
                        }}
                      />
                    </label>

                    <input
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Opção ${idx + 1} (ex: Sábado às 18h)`}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#202127] text-sm text-[#F2F3F5] placeholder-[#858B98] outline-none border border-[#3C3F48]/70 focus:border-[#7667F5] transition-colors"
                    />

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-2 rounded-lg text-[#858B98] hover:text-[#F04747] hover:bg-[#34363E] transition-colors cursor-pointer shrink-0"
                        title="Remover opção"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Quick suggestion pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Hoje às 19:00',
                  'Amanhã às 20:00',
                  'Sábado às 18:00',
                  'Sábado às 20:00',
                  'Domingo às 16:00',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const emptyIdx = options.findIndex((o) => !o.trim())
                      if (emptyIdx !== -1) {
                        handleOptionChange(emptyIdx, preset)
                      } else if (options.length < 10) {
                        setOptions((prev) => [...prev, preset])
                      }
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#202127] hover:bg-[#2B2D33] text-[#B5BAC3] hover:text-white border border-[#3C3F48] transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#3C3F48] hover:border-[#7667F5] bg-[#202127]/60 hover:bg-[#202127] text-xs font-semibold text-[#B5BAC3] hover:text-[#F2F3F5] flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-1"
                >
                  <Plus size={15} />
                  <span>Adicionar opção</span>
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="space-y-3 pt-2 border-t border-[#3C3F48]/40">
              <span className="block text-xs font-bold uppercase tracking-wider text-[#B5BAC3]">
                Configurações
              </span>

              <div className="space-y-2.5">
                {/* Allow Suggestions */}
                <button
                  type="button"
                  onClick={() => setAllowSuggestions(!allowSuggestions)}
                  className="flex items-center gap-3 w-full text-left cursor-pointer group"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      allowSuggestions
                        ? 'bg-[#7667F5] text-white'
                        : 'border border-[#3C3F48] bg-[#202127]'
                    }`}
                  >
                    {allowSuggestions && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-medium text-[#F2F3F5] group-hover:text-white">
                    Permitir que participantes sugiram outros horários ou opções
                  </span>
                </button>

                {/* Multiple choice */}
                <button
                  type="button"
                  onClick={() => setMultipleChoice(!multipleChoice)}
                  className="flex items-center gap-3 w-full text-left cursor-pointer group"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      multipleChoice
                        ? 'bg-[#7667F5] text-white'
                        : 'border border-[#3C3F48] bg-[#202127]'
                    }`}
                  >
                    {multipleChoice && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-medium text-[#F2F3F5] group-hover:text-white">
                    Permitir votar em mais de uma opção
                  </span>
                </button>

                {/* Allow comments */}
                <button
                  type="button"
                  onClick={() => setAllowComments(!allowComments)}
                  className="flex items-center gap-3 w-full text-left cursor-pointer group"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      allowComments
                        ? 'bg-[#7667F5] text-white'
                        : 'border border-[#3C3F48] bg-[#202127]'
                    }`}
                  >
                    {allowComments && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-medium text-[#F2F3F5] group-hover:text-white">
                    Habilitar comentários dentro da enquete
                  </span>
                </button>
              </div>

              {/* Expiration Date Input with Highlighted Left Button */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-[#858B98] mb-1.5">
                  Encerrar votação em
                </label>
                <div
                  onClick={openExpirationPicker}
                  className="relative flex items-center gap-3 w-full px-2.5 py-2 rounded-xl bg-[#202127] hover:bg-[#202127]/90 border border-[#3C3F48]/70 hover:border-[#7667F5] focus-within:border-[#7667F5] transition-all cursor-pointer group"
                >
                  {/* Highlighted Left Purple Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openExpirationPicker()
                    }}
                    className="w-9 h-9 rounded-lg bg-[#7667F5] hover:bg-[#6858E5] text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
                    title="Abrir seletor de data e hora"
                  >
                    <Calendar size={17} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[#F2F3F5] block">
                      {formatExpirationDisplay(expiresAt)}
                    </span>
                    <span className="text-[10px] text-[#858B98]">
                      Clique para alterar data e horário de encerramento
                    </span>
                  </div>

                  <ChevronDown size={16} className="text-[#858B98] group-hover:text-[#F2F3F5] transition-colors shrink-0 mr-1" />

                  {/* Native input hidden and triggered via ref */}
                  <input
                    ref={expirationInputRef}
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="sr-only"
                  />
                </div>

                {/* Quick preset expiration pills */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {[
                    { label: '24 horas', hours: 24 },
                    { label: '3 dias', hours: 72 },
                    { label: '7 dias', hours: 168 },
                    { label: '14 dias', hours: 336 },
                    { label: '1 mês', hours: 720 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setHours(d.getHours() + preset.hours)
                        setExpiresAt(d.toISOString().slice(0, 16))
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-[#202127] hover:bg-[#2B2D33] text-[#B5BAC3] hover:text-white border border-[#3C3F48] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-full bg-[#7667F5] hover:bg-[#6858E5] text-white font-bold text-sm tracking-tight transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Criando...' : 'Criar enquete'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
