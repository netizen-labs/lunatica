import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Coins, FileText, Paperclip, Square, X } from 'lucide-react'

interface MessageComposerProps {
  generating: boolean
  disabled?: boolean
  value?: string
  clearOnSend?: boolean
  allowAttachments?: boolean
  remainingCredits?: number
  onValueChange?: (value: string) => void
  onSend: (content: string, files: File[]) => Promise<void>
  onStop: () => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json']
const MAX_SIZE = 5 * 1024 * 1024
const MAX_TOTAL = 12 * 1024 * 1024

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

export function MessageComposer({ generating, disabled = false, value: controlledValue, clearOnSend = true, allowAttachments = false, remainingCredits, onValueChange, onSend, onStop }: MessageComposerProps) {
  const [internalValue, setInternalValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const value = controlledValue ?? internalValue
  const updateValue = onValueChange ?? setInternalValue
  const cost = 1 + files.length
  const hasPayload = Boolean(value.trim() || files.length)
  const insufficientCredits = remainingCredits !== undefined && remainingCredits < cost

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`
  }, [value])

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    const next = [...files, ...selected]
    if (next.length > 4) return setFileError('Você pode enviar no máximo 4 anexos.')
    if (selected.some((file) => !ACCEPTED_TYPES.includes(file.type))) return setFileError('Use imagens, PDF, TXT, Markdown, CSV ou JSON.')
    if (selected.some((file) => file.size > MAX_SIZE)) return setFileError('Cada anexo deve ter no máximo 5 MB.')
    if (next.reduce((total, file) => total + file.size, 0) > MAX_TOTAL) return setFileError('Os anexos devem somar no máximo 12 MB.')
    setFileError('')
    setFiles(next)
  }

  async function send() {
    if (!hasPayload || sending || generating || disabled || insufficientCredits) return
    const content = value
    const selectedFiles = files
    if (clearOnSend) { updateValue(''); setFiles([]); setFileError('') }
    setSending(true)
    try {
      await onSend(content, selectedFiles)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="composer-shell">
        {files.length > 0 && <div className="flex flex-wrap gap-2 border-b border-white/10 px-3 pb-3 pt-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="attachment-chip"><FileText className="h-3.5 w-3.5" /><span className="max-w-40 truncate">{file.name}</span><small>{fileSize(file.size)}</small><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${file.name}`}><X className="h-3.5 w-3.5" /></button></span>)}</div>}
        <div className="flex items-end gap-2 p-2">
          {allowAttachments && <><input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPTED_TYPES.join(',')} onChange={addFiles} /><button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || generating || files.length >= 4} className="attachment-button mb-0.5 shrink-0" aria-label="Anexar fotos e arquivos" title="Anexar fotos e arquivos"><Paperclip className="h-[18px] w-[18px]" /><span className="hidden md:inline">Anexar</span></button></>}
          <textarea ref={textareaRef} value={value} onChange={(event) => updateValue(event.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={12000} disabled={disabled} placeholder={disabled ? 'Você está offline' : 'Envie uma mensagem para a Lunatica'} aria-label="Mensagem para a Lunatica" className="max-h-44 min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60" />
          {generating ? <button type="button" onClick={onStop} className="composer-action stop" aria-label="Parar geração"><Square className="h-3.5 w-3.5 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={disabled || !hasPayload || sending || insufficientCredits} className="composer-action" aria-label="Enviar mensagem"><ArrowUp className="h-5 w-5" /></button>}
        </div>
        {(allowAttachments || remainingCredits !== undefined) && <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-[var(--muted)]"><span>{fileError || 'Até 4 anexos · 5 MB cada · 12 MB no total'}</span>{remainingCredits !== undefined && <span className={`flex items-center gap-1 ${insufficientCredits ? 'text-red-400' : ''}`}><Coins className="h-3 w-3" /> Esta mensagem: {cost} · Restam {remainingCredits}</span>}</div>}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">A Lunatica pode cometer erros. Verifique informações importantes.</p>
    </div>
  )
}
