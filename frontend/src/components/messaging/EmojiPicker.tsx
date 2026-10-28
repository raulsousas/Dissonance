/**
 * EmojiPicker — Discord-style emoji selection popover.
 */

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Smile, Search } from 'lucide-react'

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Frequentes & Rostos',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳',
      '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
      '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳',
      '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭',
    ],
  },
  {
    name: 'Gestos & Pessoas',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '💪', '🧠', '👀', '👁️', '👅', '👄', '💋', '❤️', '🧡',
      '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
    ],
  },
  {
    name: 'Símbolos & Especiais',
    emojis: [
      '🔥', '✨', '⭐', '🌟', '💫', '💥', '💯', '💢', '💬', '👁️‍🗨️',
      '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀',
      '🎮', '🕹️', '🎲', '🎯', '🚀', '🛸', '🛰️', '⚡', '☀️', '🌙',
      '💡', '🔒', '🔑', '💎', '👑', '🛡️', '⚔️', '🔮', '🍕', '🍔',
    ],
  },
]

interface Props {
  onSelectEmoji: (emoji: string) => void
  disabled?: boolean
}

export function EmojiPicker({ onSelectEmoji, disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredCategories = EMOJI_CATEGORIES.map((cat) => ({
    name: cat.name,
    emojis: cat.emojis.filter((e) => !search || e.includes(search)),
  })).filter((cat) => cat.emojis.length > 0)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Inserir emoji"
          aria-label="Inserir emoji"
          className="p-1.5 rounded-full text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#35373c] transition-colors cursor-pointer disabled:opacity-40"
        >
          <Smile size={20} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="w-72 max-h-80 bg-[#2b2d31] rounded-lg shadow-2xl border border-[#1f2023] p-2 flex flex-col z-50 text-[#dbdee1] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search Input */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-2 text-[#949ba4]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar emoji..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded bg-[#1e1f22] text-[#f2f3f5] outline-none border border-[#1e1f22] focus:border-[#5865f2]"
            />
          </div>

          {/* Emoji Grid */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-60">
            {filteredCategories.map((cat) => (
              <div key={cat.name}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] px-1 mb-1">
                  {cat.name}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onSelectEmoji(emoji)
                        setOpen(false)
                      }}
                      className="w-7 h-7 flex items-center justify-center text-lg rounded hover:bg-[#35373c] transition-transform hover:scale-125 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
