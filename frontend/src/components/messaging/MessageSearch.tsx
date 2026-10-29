/**
 * MessageSearch — server-side search box for the channel header.
 *
 * Replaces the old in-memory filter (which only saw the ~50 loaded messages)
 * with a search across the whole server history. Supports the filters
 * `from:`, `has:link|image|file`, `is:pinned` (see `lib/search.ts`).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Pin, Paperclip, Hash, Loader2 } from 'lucide-react'
import {
  isSearchable,
  parseSearchQuery,
  searchServerMessages,
  type SearchResult,
} from '@/lib/search'
import { toast } from '@/stores/toastStore'

const DEBOUNCE_MS = 300
const PAGE_SIZE = 20

const FILTER_HINTS = [
  { insert: 'from:', label: 'from:', desc: 'de um usuário', color: 'text-[#28A9F5]' },
  { insert: 'has:link', label: 'has:link', desc: 'com links', color: 'text-[#35C98A]' },
  { insert: 'has:image', label: 'has:image', desc: 'com imagens', color: 'text-[#F4B942]' },
  { insert: 'has:file', label: 'has:file', desc: 'com anexos', color: 'text-[#B5BAC3]' },
  { insert: 'is:pinned', label: 'is:pinned', desc: 'mensagens fixadas', color: 'text-[#F04747]' },
]

interface Props {
  serverId: string
  channelId: string
  channelName: string
}

/** Scrolls to a message once it is rendered (it may need a route change first). */
function jumpToMessage(messageId: string, attempt = 0) {
  const el = document.getElementById(`message-${messageId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('bg-[#7667F5]/20')
    setTimeout(() => el.classList.remove('bg-[#7667F5]/20'), 2000)
    return
  }
  if (attempt < 12) {
    setTimeout(() => jumpToMessage(messageId, attempt + 1), 250)
  } else {
    toast.info('Mensagem antiga', 'Ela não está entre as mensagens carregadas deste canal.')
  }
}

function snippet(content: string | null, attachmentCount: number) {
  const text = (content ?? '').replace(/\s+/g, ' ').trim()
  if (text) return text.length > 140 ? `${text.slice(0, 140)}…` : text
  return attachmentCount > 0 ? '[Anexo]' : ''
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function MessageSearch({ serverId, channelId, channelName }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [onlyThisChannel, setOnlyThisChannel] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const parsed = useMemo(() => parseSearchQuery(query), [query])
  const searchable = isSearchable(parsed)
  const scopeChannelId = onlyThisChannel ? channelId : undefined

  // Debounced search; every new query cancels the previous request.
  useEffect(() => {
    if (!searchable) {
      setResults([])
      setHasMore(false)
      setLoading(false)
      setFailed(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setFailed(false)

    const timer = setTimeout(() => {
      searchServerMessages(serverId, parsed, {
        channelId: scopeChannelId,
        limit: PAGE_SIZE,
        signal: controller.signal,
      })
        .then((page) => {
          setResults(page.results)
          setHasMore(page.has_more)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return
          setResults([])
          setHasMore(false)
          setFailed(true)
          setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [serverId, parsed, searchable, scopeChannelId])

  // Close when clicking outside.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  async function loadMore() {
    const last = results[results.length - 1]
    if (!last || loading) return
    setLoading(true)
    try {
      const page = await searchServerMessages(serverId, parsed, {
        channelId: scopeChannelId,
        before: last.id,
        limit: PAGE_SIZE,
      })
      setResults((prev) => [...prev, ...page.results])
      setHasMore(page.has_more)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  function openResult(result: SearchResult) {
    setFocused(false)
    if (result.channelId !== channelId) {
      navigate(`/app/servers/${serverId}/channels/${result.channelId}`)
    }
    jumpToMessage(result.id)
  }

  function clear() {
    setQuery('')
    setResults([])
  }

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setFocused(false)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="Buscar no servidor"
        aria-label="Buscar mensagens no servidor"
        className="w-44 focus:w-64 transition-all pl-2.5 pr-7 py-1 text-xs rounded-lg bg-[#1B1C20] text-[#F2F3F5] placeholder-[#858B98] outline-none border border-[#3C3F48]/40 focus:border-[#7667F5]"
      />
      {query ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Limpar busca"
          className="absolute right-2 top-1.5 text-[#858B98] hover:text-white cursor-pointer"
        >
          <X size={12} />
        </button>
      ) : (
        <Search size={13} className="absolute right-2 top-1.5 text-[#858B98] pointer-events-none" />
      )}

      {focused && (
        <div
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute right-0 top-full mt-1.5 w-96 max-w-[90vw] bg-[#2B2D33] rounded-xl shadow-2xl border border-[#3C3F48] z-50 text-[11px] text-[#F2F3F5] overflow-hidden"
        >
          {!searchable ? (
            <div className="p-2 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-[#858B98] tracking-wider block px-1">
                Filtros de busca
              </span>
              {FILTER_HINTS.map((hint) => (
                <button
                  key={hint.insert}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setQuery((q) => (q ? `${q.trimEnd()} ${hint.insert}` : hint.insert))
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#34363E] flex items-center justify-between cursor-pointer"
                >
                  <strong className={hint.color}>{hint.label}</strong>
                  <span className="text-[10px] text-[#858B98]">{hint.desc}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#3C3F48]/60">
                <span className="text-[10px] uppercase font-bold text-[#858B98] tracking-wider">
                  {loading && results.length === 0
                    ? 'Buscando…'
                    : `${results.length}${hasMore ? '+' : ''} ${results.length === 1 ? 'resultado' : 'resultados'}`}
                </span>
                <label className="flex items-center gap-1.5 text-[10px] text-[#B5BAC3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyThisChannel}
                    onChange={(e) => setOnlyThisChannel(e.target.checked)}
                    className="accent-[#7667F5]"
                  />
                  Somente #{channelName}
                </label>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {failed && (
                  <p className="px-3 py-4 text-center text-[#F04747]">
                    Não foi possível buscar agora. Tente novamente.
                  </p>
                )}
                {!failed && !loading && results.length === 0 && (
                  <p className="px-3 py-6 text-center text-[#858B98]">Nenhuma mensagem encontrada.</p>
                )}
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => openResult(r)}
                    className="w-full text-left px-3 py-2 hover:bg-[#34363E] border-b border-[#3C3F48]/30 last:border-b-0 cursor-pointer space-y-0.5"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-[#858B98]">
                      <Hash size={10} />
                      <span className="truncate">{r.channelName}</span>
                      <span>·</span>
                      <span>{formatWhen(r.insertedAt)}</span>
                      {r.pinned && <Pin size={10} className="text-[#F4B942] fill-current" />}
                      {r.attachmentCount > 0 && <Paperclip size={10} />}
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold text-[#28A9F5]">{r.authorName ?? 'Membro'}</span>
                      <span className="text-[#B5BAC3]"> {snippet(r.content, r.attachmentCount)}</span>
                    </div>
                  </button>
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loading}
                    className="w-full py-2 text-center text-[#7667F5] hover:bg-[#34363E] font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={12} className="inline animate-spin" /> : 'Carregar mais'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
