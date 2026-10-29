/**
 * QuickSwitcher — Discord-style "Quick Switcher" (Cmd+K / Ctrl+K) palette.
 * Allows instant search and jumping between Servers, Channels, Friends, and DMs.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { Search, Users, Server as ServerIcon, ArrowRight } from 'lucide-react'
import { useServers } from '@/hooks/useServers'
import { useConversations } from '@/hooks/useConversations'
import { useFriends } from '@/hooks/useFriends'

export function QuickSwitcher() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()

  const { data: servers = [] } = useServers()
  const { data: conversations = [] } = useConversations()
  const { data: friends = [] } = useFriends()

  // Listen for global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
        setSelectedIndex(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Aggregate searchable items
  interface SearchItem {
    id: string
    title: string
    subtitle: string
    type: 'server' | 'channel' | 'dm' | 'friend'
    icon: React.ReactNode
    onSelect: () => void
  }

  const items: SearchItem[] = []

  // Add Servers
  servers.forEach((s) => {
    items.push({
      id: `server-${s.id}`,
      title: s.name,
      subtitle: 'Servidor',
      type: 'server',
      icon: <ServerIcon size={16} className="text-[#7667F5]" />,
      onSelect: () => {
        navigate(`/app/servers/${s.id}`)
        setOpen(false)
      },
    })
  })

  // Add DMs
  conversations.forEach((c) => {
    items.push({
      id: `dm-${c.id}`,
      title: c.recipient.displayName,
      subtitle: `Mensagem Direta • ${c.recipient.status || 'offline'}`,
      type: 'dm',
      icon: (
        <Avatar.Root className="w-5 h-5 rounded-full overflow-hidden bg-[#1B1C20]">
          <Avatar.Image src={c.recipient.avatarUrl ?? undefined} alt={c.recipient.displayName} className="w-full h-full object-cover" />
          <Avatar.Fallback className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-[#7667F5]">
            {c.recipient.displayName[0]?.toUpperCase()}
          </Avatar.Fallback>
        </Avatar.Root>
      ),
      onSelect: () => {
        navigate(`/app/dm/${c.id}`)
        setOpen(false)
      },
    })
  })

  // Add Friends
  friends.forEach((f) => {
    if (!conversations.some((c) => c.recipient.id === f.id)) {
      items.push({
        id: `friend-${f.id}`,
        title: f.displayName,
        subtitle: `Amigo • ${f.status || 'offline'}`,
        type: 'friend',
        icon: <Users size={16} className="text-[#35C98A]" />,
        onSelect: () => {
          navigate('/app/dm')
          setOpen(false)
        },
      })
    }
  })

  const filtered = items.filter((item) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
  })

  // Keyboard navigation within list
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].onSelect()
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 p-4 animate-in fade-in duration-150">
          <Dialog.Content className="w-full max-w-xl bg-[#2B2D33] rounded-xl shadow-2xl border border-[#3C3F48] overflow-hidden flex flex-col text-[#F2F3F5] outline-none animate-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-[#1B1C20] border-b border-[#3C3F48]/40">
              <Search size={18} className="text-[#858B98] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Aonde você gostaria de ir? (Servidores, DMs, Amigos...)"
                className="w-full bg-transparent text-sm text-[#F2F3F5] placeholder-[#858B98] outline-none"
              />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2B2D33] text-[#858B98] border border-[#3C3F48] shrink-0">
                ESC
              </span>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#858B98]">
                  Nenhum resultado encontrado para &quot;{query}&quot;
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <div
                      key={item.id}
                      onClick={item.onSelect}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#7667F5] text-white font-semibold'
                          : 'hover:bg-[#34363E] text-[#B5BAC3] hover:text-[#F2F3F5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0">{item.icon}</div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm truncate font-medium">{item.title}</span>
                          <span
                            className={`text-[11px] truncate ${
                              isSelected ? 'text-white/80' : 'text-[#858B98]'
                            }`}
                          >
                            {item.subtitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-xs">
                        <ArrowRight size={14} className={isSelected ? 'text-white' : 'text-[#858B98]'} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer with key hints */}
            <div className="px-4 py-2 bg-[#1B1C20] border-t border-[#3C3F48]/40 flex items-center justify-between text-[11px] text-[#858B98]">
              <div className="flex items-center gap-3">
                <span>Navegar <kbd className="px-1 py-0.5 bg-[#2B2D33] rounded border border-[#3C3F48]">↑</kbd> <kbd className="px-1 py-0.5 bg-[#2B2D33] rounded border border-[#3C3F48]">↓</kbd></span>
                <span>Selecionar <kbd className="px-1 py-0.5 bg-[#2B2D33] rounded border border-[#3C3F48]">↵</kbd></span>
              </div>
              <span className="font-semibold text-[#7667F5]">Dissonance Maiahi</span>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
