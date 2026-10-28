/**
 * MessageInput — textarea with send, Shift+Enter for newline,
 * file attachment upload & progress preview, reply preview, and character counter.
 */

import { useState, useRef, useCallback } from 'react'
import { SendHorizonal, X, FileText } from 'lucide-react'
import type { Message, Attachment } from '@/stores/messagingStore'
import { EmojiPicker } from './EmojiPicker'

interface Props {
  channelName: string
  disabled?: boolean
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (content: string, replyToId?: string, attachments?: Attachment[], files?: File[]) => void
  onTyping: () => void
  onStopTyping: () => void
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
}: Props) {
  const [content, setContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl?: string }[]>([])
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    onTyping()
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
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
    <div className="px-4 pb-6 shrink-0">
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
          className="mb-1 mx-1 px-3 py-1.5 rounded-t-lg flex items-center gap-2 text-xs"
          style={{
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-muted)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span className="flex-1 truncate">
            ↩ Replying to <strong>{replyTo.authorName ?? 'Unknown'}</strong>: {replyTo.content}
          </span>
          <button
            onClick={onCancelReply}
            className="hover:opacity-70 transition-opacity ml-1 cursor-pointer"
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment Preview Chips inside text area (Discord Style) */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 p-2 rounded-t-lg bg-[#2b2d31] flex flex-wrap gap-2 border-b border-[#1f2023]">
          {pendingFiles.map((item, idx) => (
            <div
              key={idx}
              className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#1e1f22] text-[#dbdee1] border border-[#35373c] max-w-[220px]"
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
              ) : (
                <FileText size={18} className="text-[#949ba4] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.file.name}</p>
                <p className="text-[10px] text-[#949ba4]">{formatFileSize(item.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveFile(idx)}
                className="p-1 rounded text-[#949ba4] hover:text-[#f23f43] hover:bg-[#35373c] transition-colors cursor-pointer"
                title="Remover anexo"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
          replyTo || pendingFiles.length > 0 ? 'rounded-t-none' : ''
        }`}
        style={{ background: '#383a40' }}
      >
        {/* Circular + attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 w-6 h-6 rounded-full bg-[#4e5058] hover:bg-[#b5bac1] text-[#2b2d31] hover:text-[#111214] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          title="Adicionar arquivo ou imagem"
          aria-label="Attach file"
        >
          <span className="text-base font-bold leading-none">+</span>
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm py-1 placeholder-[#80848e]"
          style={{ color: '#dbdee1', maxHeight: '200px' }}
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
            style={{ color: overLimit ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}

        {/* Right utility buttons inside input */}
        <div className="flex items-center gap-2 text-[#b5bac1] shrink-0">
          <button title="Presente" className="hover:text-white cursor-pointer transition-colors p-0.5">
            🎁
          </button>
          <button title="GIF" className="hover:text-white cursor-pointer transition-colors text-xs font-bold px-1 rounded bg-[#2b2d31]">
            GIF
          </button>
          <EmojiPicker onSelectEmoji={handleInsertEmoji} disabled={disabled} />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
            title="Enviar"
            aria-label="Send"
          >
            <SendHorizonal
              size={18}
              style={{ color: canSend ? '#5865f2' : '#80848e' }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
