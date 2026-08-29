import { lazy, Suspense, useState } from 'react'
import { Check, Copy, FileText, Image, Pencil, RotateCcw, X } from 'lucide-react'
import type { ChatMessage, Message } from '../../types/database'
import { copyText } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { LogoMark } from '../ui/Logo'

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer').then((module) => ({ default: module.MarkdownRenderer })))

interface MessageBubbleProps {
  message: ChatMessage
  canRegenerate: boolean
  generating: boolean
  onRegenerate: (message: Message) => Promise<void>
  onEdit: (message: Message, content: string) => Promise<void>
}

export function MessageBubble({ message, canRegenerate, generating, onRegenerate, onEdit }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [busy, setBusy] = useState(false)
  const { showToast } = useToast()
  const isUser = message.role === 'user'

  async function copy() {
    try {
      await copyText(message.content)
      showToast('Conteúdo copiado.', 'success')
    } catch {
      showToast('Não foi possível copiar.', 'error')
    }
  }

  async function saveEdit() {
    setBusy(true)
    try {
      await onEdit(message, draft)
      setEditing(false)
    } catch (error) {
      showToast('Não foi possível editar a mensagem.', 'error')
      if (import.meta.env.DEV) console.error(error)
    } finally {
      setBusy(false)
    }
  }

  if (isUser) {
    return (
      <article className="group mx-auto flex w-full max-w-3xl justify-end px-4 sm:px-6">
        <div className="max-w-[88%] sm:max-w-[78%]">
          {editing ? (
            <div className="rounded-2xl border bg-white p-3 shadow-sm dark:bg-ink-800">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-24 w-full resize-y bg-transparent text-[15px] leading-6 outline-none" autoFocus />
              <div className="mt-2 flex justify-end gap-2"><button type="button" className="icon-btn" onClick={() => setEditing(false)} aria-label="Cancelar edição"><X className="h-4 w-4" /></button><button type="button" className="btn-primary !px-3 !py-2" onClick={() => void saveEdit()} disabled={busy || !draft.trim()}><Check className="h-4 w-4" /> Salvar e enviar</button></div>
            </div>
          ) : (
            <div className="user-message-card"><div className="whitespace-pre-wrap">{message.content}</div>{message.attachments && message.attachments.length > 0 && <div className="message-attachment-grid">{message.attachments.map((file) => file.previewUrl ? <a key={file.id} href={file.previewUrl} target="_blank" rel="noreferrer" className="message-image-preview" aria-label={`Abrir ${file.file_name}`}><img src={file.previewUrl} alt={file.file_name} /><span>{file.file_name}</span></a> : <span key={file.id} className="attachment-chip !bg-black/10">{file.mime_type.startsWith('image/') ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}<span className="max-w-44 truncate">{file.file_name}</span></span>)}</div>}</div>
          )}
          {!editing && <div className="mt-1.5 flex justify-end gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"><button type="button" className="icon-btn !h-8 !w-8" onClick={copy} aria-label="Copiar mensagem"><Copy className="h-3.5 w-3.5" /></button><button type="button" className="icon-btn !h-8 !w-8" onClick={() => setEditing(true)} disabled={generating} aria-label="Editar mensagem"><Pencil className="h-3.5 w-3.5" /></button></div>}
        </div>
      </article>
    )
  }

  return (
    <article className="group mx-auto w-full max-w-3xl px-4 sm:px-6">
      <div className="flex gap-3 sm:gap-4">
        <LogoMark className="assistant-mark" />
        <div className="min-w-0 flex-1 pt-0.5">
          {message.content ? <Suspense fallback={<div className="h-16 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-white/[0.04]" />}><MarkdownRenderer content={message.content} /></Suspense> : <div className="flex h-7 items-center gap-1" aria-label="Lunatica está pensando"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lunar-400" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lunar-400 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lunar-400 [animation-delay:240ms]" /></div>}
          {message.content && <div className="mt-2 flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"><button type="button" className="icon-btn !h-8 !w-8" onClick={copy} aria-label="Copiar resposta"><Copy className="h-3.5 w-3.5" /></button>{canRegenerate && <button type="button" className="icon-btn !h-8 !w-8" onClick={() => void onRegenerate(message)} disabled={generating} aria-label="Regenerar resposta"><RotateCcw className="h-3.5 w-3.5" /></button>}</div>}
        </div>
      </div>
    </article>
  )
}
