import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { copyText } from '../../lib/utils'

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children)
  return ''
}

function CodeContainer({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    await copyText(extractText(children).replace(/\n$/, ''))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="group/code relative my-4">
      <button type="button" onClick={() => void copyCode()} className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-300 opacity-100 backdrop-blur transition hover:bg-black/70 sm:opacity-0 sm:group-hover/code:opacity-100" aria-label="Copiar bloco de código">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Copiar'}
      </button>
      <pre>{children}</pre>
    </div>
  )
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
          table: ({ children, ...props }) => <div className="my-4 overflow-x-auto"><table {...props}>{children}</table></div>,
          pre: ({ children }) => <CodeContainer>{children}</CodeContainer>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
