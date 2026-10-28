/**
 * GifPicker — Discord-style GIF selection popover with categories & search.
 */

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Search } from 'lucide-react'

const CURATED_GIFS: { category: string; gifs: { url: string; title: string }[] }[] = [
  {
    category: 'Tendências & Reações',
    gifs: [
      { url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', title: 'GG / Party' },
      { url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif', title: 'Dance' },
      { url: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif', title: 'Thumbs Up' },
      { url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', title: 'Excited' },
      { url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', title: 'Mind Blown' },
      { url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', title: 'Applause' },
    ],
  },
  {
    category: 'Games & Diversão',
    gifs: [
      { url: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif', title: 'Gaming / Cat' },
      { url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif', title: 'Victory / Anime' },
      { url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', title: 'Popcorn' },
      { url: 'https://media.giphy.com/media/Yk4fK49I73L3uC79kE/giphy.gif', title: 'Let’s Go' },
    ],
  },
  {
    category: 'Memes',
    gifs: [
      { url: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', title: 'Big Brain' },
      { url: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif', title: 'Awkward / Monkey' },
      { url: 'https://media.giphy.com/media/QMHoU66sBXCAweq09a/giphy.gif', title: 'This is fine' },
      { url: 'https://media.giphy.com/media/94EQmVHkveNck/giphy.gif', title: 'Crying Money' },
    ],
  },
]

interface Props {
  onSelectGif: (url: string) => void
  disabled?: boolean
}

export function GifPicker({ onSelectGif, disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const allGifs = CURATED_GIFS.flatMap((c) => c.gifs)
  const filteredGifs = search.trim()
    ? allGifs.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Inserir GIF"
          className="hover:text-white cursor-pointer transition-colors text-xs font-bold px-1.5 py-0.5 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1] disabled:opacity-40"
        >
          GIF
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="w-80 max-h-96 bg-[#2b2d31] rounded-lg shadow-2xl border border-[#1f2023] p-2 flex flex-col z-50 text-[#dbdee1] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search Bar */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-2 text-[#949ba4]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no Tenor / GIPHY..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded bg-[#1e1f22] text-[#f2f3f5] outline-none border border-[#1e1f22] focus:border-[#5865f2]"
            />
          </div>

          {/* GIFs Container */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-72">
            {search.trim() ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] px-1 mb-1.5">
                  Resultados da Busca
                </p>
                {filteredGifs.length === 0 ? (
                  <p className="text-xs text-center text-[#949ba4] py-4">
                    Nenhum GIF encontrado para &quot;{search}&quot;
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredGifs.map((gif) => (
                      <button
                        key={gif.url}
                        type="button"
                        onClick={() => {
                          onSelectGif(gif.url)
                          setOpen(false)
                        }}
                        className="rounded overflow-hidden relative group aspect-video bg-[#1e1f22] hover:ring-2 hover:ring-[#5865f2] transition-all cursor-pointer"
                      >
                        <img
                          src={gif.url}
                          alt={gif.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {gif.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              CURATED_GIFS.map((section) => (
                <div key={section.category}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] px-1 mb-1.5">
                    {section.category}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {section.gifs.map((gif) => (
                      <button
                        key={gif.url}
                        type="button"
                        onClick={() => {
                          onSelectGif(gif.url)
                          setOpen(false)
                        }}
                        className="rounded overflow-hidden relative group aspect-video bg-[#1e1f22] hover:ring-2 hover:ring-[#5865f2] transition-all cursor-pointer"
                      >
                        <img
                          src={gif.url}
                          alt={gif.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {gif.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
