/**
 * MessageInput — textarea with send, Shift+Enter for newline,
 * file attachment upload & progress preview, reply preview, and character counter.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { SendHorizonal, X, FileText, Hash, Volume2, Users, Plus, Vote } from 'lucide-react'
import type { Message, Attachment } from '@/stores/messagingStore'
import { EmojiPicker } from './EmojiPicker'
import { GifPicker } from './GifPicker'
import { usePollStore } from '@/stores/pollStore'

export interface MentionMember {
  id: string
  displayName: string
  avatarUrl?: string | null
}

export interface MentionChannel {
  id: string
  name: string
  type: string
}

interface Props {
  channelName: string
  disabled?: boolean
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string, replyToId?: string, attachments?: Attachment[], files?: File[]) => void
  onTyping: () => void
  onStopTyping: () => void
  members?: MentionMember[]
  channels?: MentionChannel[]
}

const MAX_LENGTH = 4000

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function MessageInput({
  channelName,
  disabled,
  replyTo,
  onCancelReply,
  onSend,
  onTyping,
  onStopTyping,
  members = [],
  channels = [],
}: Props) {
  const [content, setContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl?: string }[]>([])
  const [autocomplete, setAutocomplete] = useState<{
    trigger: '@' | '#' | '$'
    query: string
    startIndex: number
  } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const openCreatePoll = usePollStore((s) => s.openCreatePoll)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    console.info(`[Guilda:Chat] ${fileArray.length} file(s) selected:`, fileArray.map((f) => ({ name: f.name, size: f.size, type: f.type })))
    const list: { file: File; previewUrl?: string }[] = []
    fileArray.forEach((file) => {
      const isImg = file.type.startsWith('image/')
      list.push({
        file,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      })
    })
    setPendingFiles((prev) => [...prev, ...list])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  function handleRemoveFile(index: number) {
    setPendingFiles((prev) => {
      const removed = prev[index]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault()
      console.info('[Guilda:Chat] File(s) pasted from clipboard')
      addFiles(e.clipboardData.files)
    }
  }

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    if ((!trimmed && pendingFiles.length === 0) || trimmed.length > MAX_LENGTH) return

    const filesToSend = pendingFiles.map((p) => p.file)

    console.info('[Guilda:Chat] Sending message:', {
      contentLength: trimmed.length,
      replyToId: replyTo?.id,
      filesCount: filesToSend.length,
    })

    if (filesToSend.length > 0) {
      onSend(trimmed, replyTo?.id, undefined, filesToSend)
    } else {
      onSend(trimmed, replyTo?.id)
    }

    setContent('')
    setPendingFiles([])
    onCancelReply()
    onStopTyping()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [content, pendingFiles, replyTo, onSend, onCancelReply, onStopTyping])

  // Compute autocomplete options based on trigger and query
  const autocompleteItems = (() => {
    if (!autocomplete) return []
    const q = autocomplete.query.toLowerCase()

    if (autocomplete.trigger === '@') {
      const list: Array<{ id: string; name: string; avatarUrl?: string | null; isSpecial?: boolean; desc?: string }> = []
      if ('everyone'.includes(q)) {
        list.push({ id: 'everyone', name: 'everyone', isSpecial: true, desc: 'Notificar todos no canal' })
      }
      if ('here'.includes(q)) {
        list.push({ id: 'here', name: 'here', isSpecial: true, desc: 'Notificar membros online' })
      }
      members
        .filter((m) => m.displayName.toLowerCase().includes(q))
        .forEach((m) => {
          list.push({ id: m.id, name: m.displayName, avatarUrl: m.avatarUrl })
        })
      return list.slice(0, 8)
    }

    if (autocomplete.trigger === '#') {
      return channels
        .filter((c) => c.name.toLowerCase().includes(q))
        .map((c) => ({ id: c.id, name: c.name, type: c.type }))
        .slice(0, 8)
    }

    if (autocomplete.trigger === '$') {
      const actions = [
        {
          id: 'create_poll',
          name: 'Criar enquete',
          isPoll: true,
          desc: 'Crie uma votação para o servidor',
        },
      ]
      return actions.filter(
        (a) => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
      )
    }

    return []
  })()

  // Reset selectedIndex when query/items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [autocomplete?.query, autocomplete?.trigger])

  function selectAutocompleteItem(item: { name: string; isPoll?: boolean }) {
    if (!autocomplete || !textareaRef.current) return
    const beforeTrigger = content.slice(0, autocomplete.startIndex)
    const afterCursor = content.slice(textareaRef.current.selectionStart || autocomplete.startIndex + autocomplete.query.length + 1)

    if (item.isPoll || autocomplete.trigger === '$') {
      // Remove the $ character without sending it and open poll creation modal
      setContent(beforeTrigger + afterCursor)
      setAutocomplete(null)
      openCreatePoll()
      return
    }

    const insertion = `${autocomplete.trigger}${item.name} `
    const newContent = beforeTrigger + insertion + afterCursor
    setContent(newContent)
    setAutocomplete(null)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPos = beforeTrigger.length + insertion.length
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos
      }
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (autocomplete && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % autocompleteItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const chosen = autocompleteItems[selectedIndex]
        if (chosen) {
          selectAutocompleteItem(chosen)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAutocomplete(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    onTyping()
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`

    // Check for @, # or $ triggers
    const cursor = el.selectionStart || val.length
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/(?:^|\s)([@#$])([a-zA-Z0-9_\-\u00C0-\u017F]*)$/)

    if (match) {
      const trigger = match[1] as '@' | '#' | '$'
      const query = match[2]
      const startIndex = cursor - query.length - 1
      setAutocomplete({ trigger, query, startIndex })
    } else {
      setAutocomplete(null)
    }
  }

  const overLimit = content.length > MAX_LENGTH
  const canSend = (content.trim().length > 0 || pendingFiles.length > 0) && !overLimit && !disabled

  function handleInsertEmoji(emoji: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      setContent((prev) => prev + emoji)
      return
    }
    const start = textarea.selectionStart ?? content.length
    const end = textarea.selectionEnd ?? content.length
    const newContent = content.substring(0, start) + emoji + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length
    }, 0)
  }

  return (
    <div className="relative px-4 pb-6 shrink-0">
      {/* Autocomplete Mention / Channel Popover */}
      {autocomplete && autocompleteItems.length > 0 && (
        <div className="absolute left-4 right-4 bottom-[calc(100%-8px)] mb-2 bg-[#2B2D33] rounded-lg shadow-2xl border border-[#3C3F48] overflow-hidden z-50 text-xs">
          <div className="px-3 py-1.5 bg-[#202127] text-[#858B98] font-semibold uppercase text-[10px] tracking-wider border-b border-[#3C3F48] flex items-center justify-between">
            <span>
              {autocomplete.trigger === '@'
                ? 'Membros & Menções'
                : autocomplete.trigger === '#'
                ? 'Canais'
                : 'Ações & Enquetes'}
            </span>
            <span className="text-[9px] font-normal lowercase">Tab ou Enter para selecionar</span>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {autocompleteItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectAutocompleteItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#34363E] text-white' : 'text-[#B5BAC3] hover:bg-[#3B3E47]/50'
                  }`}
                >
                  {autocomplete.trigger === '@' ? (
                    'isSpecial' in item && item.isSpecial ? (
                      <div className="w-6 h-6 rounded-full bg-[#F4B942]/20 text-[#F4B942] flex items-center justify-center font-bold text-xs shrink-0">
                        <Users size={13} />
                      </div>
                    ) : 'avatarUrl' in item && item.avatarUrl ? (
                      <img src={item.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#7667F5] text-white flex items-center justify-center font-semibold text-xs shrink-0">
                        {item.name[0]?.toUpperCase() ?? '?'}
                      </div>
                    )
                  ) : 'isPoll' in item && item.isPoll ? (
                    <div className="w-6 h-6 rounded-lg bg-[#7667F5]/20 text-[#7667F5] flex items-center justify-center font-bold text-xs shrink-0">
                      <Vote size={14} />
                    </div>
                  ) : 'type' in item && item.type === 'voice' ? (
                    <Volume2 size={16} className="text-[#858B98] shrink-0" />
                  ) : (
                    <Hash size={16} className="text-[#858B98] shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm truncate block">{item.name}</span>
                    {'desc' in item && item.desc && (
                      <span className="text-[11px] text-[#858B98] block truncate">{item.desc}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Reply preview */}
      {replyTo && (
        <div
          className="mb-1 px-3 py-2 rounded-t-lg flex items-center justify-between gap-2 text-xs bg-[#202127] border-b border-[#3C3F48] text-[#858B98] shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
            <span className="shrink-0 text-[#858B98]">↩ Replying to</span>
            <span className="font-semibold text-[#28A9F5] shrink-0">@{replyTo.authorName ?? 'Unknown'}</span>
            <span className="truncate text-[#B5BAC3]">{replyTo.content || '[Anexo]'}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-[#34363E] text-[#858B98] hover:text-[#F04747] transition-colors ml-1 cursor-pointer shrink-0"
            aria-label="Cancel reply"
            title="Cancelar resposta"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment Preview Chips inside text area (Discord Style) */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 p-2 rounded-t-lg bg-[#202127] flex flex-wrap gap-2 border-b border-[#3C3F48]">
          {pendingFiles.map((item, idx) => (
            <div
              key={idx}
              className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#2B2D33] text-[#F2F3F5] border border-[#3C3F48] max-w-[220px]"
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
              ) : (
                <FileText size={18} className="text-[#858B98] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.file.name}</p>
                <p className="text-[10px] text-[#858B98]">{formatFileSize(item.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveFile(idx)}
                className="p-1 rounded text-[#858B98] hover:text-[#F04747] hover:bg-[#3B3E47] transition-colors cursor-pointer"
                title="Remover anexo"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 bg-[#2B2D33] border border-[#3C3F48]/50 focus-within:border-[#7667F5] transition-colors ${
          replyTo || pendingFiles.length > 0 ? 'rounded-t-none' : ''
        }`}
      >
        {/* Circular + attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 w-6 h-6 rounded-full bg-[#34363E] hover:bg-[#7667F5] text-[#B5BAC3] hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          title="Adicionar arquivo ou imagem"
          aria-label="Attach file"
        >
          <Plus size={14} className="stroke-[3] shrink-0" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm py-0.5 placeholder-[#858B98] text-[#F2F3F5]"
          style={{ maxHeight: '200px' }}
          placeholder={
            disabled
              ? 'Você não tem permissão para enviar mensagens.'
              : `Conversar em #${channelName}`
          }
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={onStopTyping}
          disabled={disabled}
          maxLength={MAX_LENGTH + 1}
          aria-label="Message input"
        />

        {/* Character counter when near limit */}
        {content.length > MAX_LENGTH - 200 && (
          <span
            className="text-xs shrink-0"
            style={{ color: overLimit ? '#F04747' : '#858B98' }}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}

        {/* Right utility buttons inside input */}
        <div className="flex items-center gap-2 text-[#858B98] shrink-0">
          <button
            type="button"
            onClick={() => openCreatePoll()}
            disabled={disabled}
            className="p-1 rounded hover:bg-[#3B3E47] text-[#858B98] hover:text-[#7667F5] transition-colors cursor-pointer"
            title="Criar enquete ($)"
            aria-label="Criar enquete"
          >
            <Vote size={18} />
          </button>
          <GifPicker
            onSelectGif={(url) => {
              onSend(url, replyTo?.id)
              if (replyTo) onCancelReply()
            }}
            disabled={disabled}
          />
          <EmojiPicker onSelectEmoji={handleInsertEmoji} disabled={disabled} />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="p-1 rounded hover:bg-[#3B3E47] transition-colors disabled:opacity-30 cursor-pointer text-[#858B98] hover:text-[#7667F5]"
            title="Enviar"
            aria-label="Send"
          >
            <SendHorizonal
              size={18}
              style={{ color: canSend ? '#7667F5' : '#858B98' }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
