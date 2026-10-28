/**
 * FormattedMessage — Discord-style Markdown renderer with syntax code blocks, inline code, bold, italics, quotes, and links.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  content: string
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-1.5 rounded-md overflow-hidden bg-[#1e1f22] border border-[#2b2d31] font-mono text-xs max-w-2xl select-text">
      <div className="flex items-center justify-between px-3 py-1 bg-[#111214] text-[#949ba4] text-[11px] border-b border-[#2b2d31]">
        <span>{language ? language.toUpperCase() : 'CODE'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          title="Copiar código"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[#dbdee1] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to split by bold (**text**), strikethrough (~~text~~), italics (*text* or _text_), inline code (`code`), URL, or mentions (@user, #channel)
  const tokenRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)|(```[\s\S]*?```)|(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(_[^_]+_)|(@everyone|@here|@[a-zA-Z0-9_\-\u00C0-\u017F]+)|(#[a-zA-Z0-9_\-]+)/g

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    const matched = match[0]

    if (matched.startsWith('http://') || matched.startsWith('https://') || matched.startsWith('www.')) {
      let cleanUrl = matched
      let trailingPunct = ''
      const punctMatch = cleanUrl.match(/[.,!?:;)]+$/)
      if (punctMatch) {
        trailingPunct = punctMatch[0]
        cleanUrl = cleanUrl.slice(0, -trailingPunct.length)
      }

      const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl
      const isImageOrGif =
        /\.(gif|jpe?g|png|webp)($|\?)/i.test(cleanUrl) ||
        cleanUrl.includes('giphy.com/media') ||
        cleanUrl.includes('tenor.com')

      parts.push(
        <span key={match.index} className="inline-block">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00a8fc] hover:underline break-all"
          >
            {cleanUrl}
          </a>
          {trailingPunct}
          {isImageOrGif && (
            <div className="mt-1.5 rounded-lg overflow-hidden max-w-sm max-h-80 border border-[#2b2d31] bg-[#1e1f22]">
              <img
                src={href}
                alt="GIF / Anexo"
                className="w-full h-auto object-contain rounded"
                loading="lazy"
              />
            </div>
          )}
        </span>
      )
    } else if (matched.startsWith('`') && matched.endsWith('`') && matched.length > 2) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-[#1e1f22] text-[#e0e1e5] font-mono text-xs border border-[#2b2d31]"
        >
          {matched.slice(1, -1)}
        </code>
      )
    } else if (matched.startsWith('**') && matched.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-bold text-white">
          {matched.slice(2, -2)}
        </strong>
      )
    } else if (matched.startsWith('~~') && matched.endsWith('~~')) {
      parts.push(
        <s key={match.index} className="line-through text-[#949ba4]">
          {matched.slice(2, -2)}
        </s>
      )
    } else if (
      (matched.startsWith('*') && matched.endsWith('*')) ||
      (matched.startsWith('_') && matched.endsWith('_'))
    ) {
      parts.push(
        <em key={match.index} className="italic text-[#dbdee1]">
          {matched.slice(1, -1)}
        </em>
      )
    } else if (matched === '@everyone' || matched === '@here') {
      parts.push(
        <span
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-[#f0b232]/20 text-[#f0b232] font-semibold select-all cursor-pointer hover:bg-[#f0b232]/30 transition-colors"
        >
          {matched}
        </span>
      )
    } else if (matched.startsWith('@')) {
      parts.push(
        <span
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-[#5865f2]/20 text-[#c9cdfb] hover:bg-[#5865f2] hover:text-white font-medium select-all cursor-pointer transition-colors"
        >
          {matched}
        </span>
      )
    } else if (matched.startsWith('#')) {
      parts.push(
        <span
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-[#35373c] text-[#dbdee1] hover:bg-[#404249] font-medium cursor-pointer transition-colors inline-flex items-center gap-0.5"
        >
          {matched}
        </span>
      )
    } else {
      parts.push(matched)
    }

    lastIndex = match.index + matched.length
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}

export function FormattedMessage({ content }: Props) {
  // Check if content contains triple backtick code blocks
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  const blocks: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const normalText = content.substring(lastIndex, match.index)
      blocks.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {renderInlineMarkdown(normalText)}
        </span>
      )
    }

    const language = match[1] || ''
    const code = match[2] || ''
    blocks.push(<CodeBlock key={`code-${match.index}`} code={code} language={language} />)

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex)
    blocks.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(remainingText)}
      </span>
    )
  }

  return (
    <div className="text-sm break-words leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
      {blocks}
    </div>
  )
}
