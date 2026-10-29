import { useMemo, useState } from 'react'
import { BarChart3, Menu, Plus } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { usePollsChannel } from '@/hooks/usePollsChannel'
import { usePollStore, pollsOfChannel, isPollClosed } from '@/stores/pollStore'
import { PollMessageCard } from '@/components/messaging/PollMessageCard'
import { CreatePollModal } from '@/components/modals/CreatePollModal'
import { PollDetailsModal } from '@/components/modals/PollDetailsModal'

type Filter = 'open' | 'closed' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Abertas' },
  { id: 'closed', label: 'Encerradas' },
  { id: 'all', label: 'Todas' },
]

/** A channel that only lists (and creates) polls, keeping chat channels clean. */
export function PollsChannelView({ channelId, channelName }: { channelId: string; channelName: string }) {
  const { status } = usePollsChannel(channelId)
  const { openMobileNav } = useUIStore()
  const polls = usePollStore((s) => s.polls)
  const { isCreatePollOpen, openCreatePoll, closeCreatePoll, activePollModalId, openPollDetails, closePollDetails } =
    usePollStore()
  const [filter, setFilter] = useState<Filter>('open')

  const all = useMemo(() => pollsOfChannel(polls, channelId), [polls, channelId])
  const visible = useMemo(
    () =>
      all.filter((p) => {
        if (filter === 'all') return true
        return filter === 'closed' ? isPollClosed(p) : !isPollClosed(p)
      }),
    [all, filter]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 px-3 sm:px-4 flex items-center justify-between border-b border-[#3C3F48]/40 shrink-0 shadow-sm select-none bg-[#202127]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={openMobileNav}
            className="p-1 -ml-1 text-[#858B98] hover:text-[#F2F3F5] md:hidden cursor-pointer shrink-0"
            title="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <BarChart3 size={20} className="text-[#858B98] shrink-0" />
          <span className="font-bold text-sm text-[#F2F3F5] truncate">{channelName}</span>
        </div>
        <button
          type="button"
          onClick={() => openCreatePoll(channelId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7667F5] hover:bg-[#6554E6] text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus size={14} /> Nova enquete
        </button>
      </div>

      <div className="px-4 pt-3 flex items-center gap-1.5 shrink-0" role="tablist" aria-label="Filtrar enquetes">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              filter === f.id ? 'bg-[#34363E] text-white' : 'text-[#858B98] hover:text-[#F2F3F5]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {status === 'loading' && all.length === 0 && (
          <p className="text-sm text-[#858B98] text-center py-10">Carregando enquetes...</p>
        )}

        {status === 'error' && (
          <p role="alert" className="text-sm text-[#F04747] text-center py-10">
            Não foi possível carregar as enquetes. Tente novamente em instantes.
          </p>
        )}

        {status === 'ready' && visible.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-[#B5BAC3]">
              {all.length === 0
                ? 'Nenhuma enquete criada ainda.'
                : filter === 'open'
                ? 'Nenhuma enquete aberta no momento.'
                : 'Nenhuma enquete encerrada.'}
            </p>
            {all.length === 0 && (
              <button
                type="button"
                onClick={() => openCreatePoll(channelId)}
                className="text-xs font-semibold text-[#7667F5] hover:underline cursor-pointer"
              >
                Criar a primeira enquete
              </button>
            )}
          </div>
        )}

        {visible.map((poll) => (
          <PollMessageCard key={poll.id} pollId={poll.id} onOpenDetails={openPollDetails} />
        ))}
      </div>

      <CreatePollModal open={isCreatePollOpen} onClose={closeCreatePoll} channelId={channelId} scope="channel" />
      <PollDetailsModal pollId={activePollModalId} onClose={closePollDetails} channelName={channelName} />
    </div>
  )
}
