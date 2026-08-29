import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Clock3, Coins, FileText, LoaderCircle, Mic, MicOff, Paperclip, Square, X } from 'lucide-react'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'

interface MessageComposerProps {
  generating: boolean
  disabled?: boolean
  value?: string
  clearOnSend?: boolean
  allowAttachments?: boolean
  remainingCredits?: number | null
  unlimited?: boolean
  temporary?: boolean
  onValueChange?: (value: string) => void
  onSend: (content: string, files: File[]) => Promise<void>
  onStop: () => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json']
const MAX_SIZE = 5 * 1024 * 1024
const MAX_TOTAL = 12 * 1024 * 1024
const MAX_ATTACHMENTS = 3

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

function normalizedFile(file: File) {
  if (file.type) return file
  const extension = file.name.split('.').pop()?.toLowerCase()
  const inferred: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json' }
  const type = extension ? inferred[extension] : undefined
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file
}

export function MessageComposer({ generating, disabled = false, value: controlledValue, clearOnSend = true, allowAttachments = false, remainingCredits, unlimited = false, temporary = false, onValueChange, onSend, onStop }: MessageComposerProps) {
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
  const insufficientCredits = !unlimited && remainingCredits !== undefined && remainingCredits !== null && remainingCredits < cost
  const speech = useSpeechRecognition({ value, onChange: updateValue, onError: setFileError })
  const previewUrls = useMemo(() => files.map((file) => file.type.startsWith('image/') ? URL.createObjectURL(file) : ''), [files])

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`
  }, [value])

  useEffect(() => {
    return () => previewUrls.forEach((url) => { if (url) URL.revokeObjectURL(url) })
  }, [previewUrls])

  useEffect(() => {
    if (generating && speech.listening) speech.stop()
  }, [generating, speech])

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).map(normalizedFile)
    event.target.value = ''
    const next = [...files, ...selected]
    if (next.length > MAX_ATTACHMENTS) return setFileError('Você pode enviar no máximo 3 anexos por mensagem.')
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
        {files.length > 0 && <div className="attachment-preview-list">{files.map((file, index) => <article key={`${file.name}-${file.lastModified}-${index}`} className="attachment-preview-card">{previewUrls[index] ? <img src={previewUrls[index]} alt={`Prévia de ${file.name}`} /> : <span className="attachment-file-icon"><FileText className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><strong>{file.name}</strong><small>{file.type.startsWith('image/') ? 'Imagem' : 'Arquivo'} · {fileSize(file.size)}</small></div><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={sending} aria-label={`Remover ${file.name}`}><X className="h-4 w-4" /></button></article>)}</div>}
        <div className="flex items-end gap-2 p-2">
          {allowAttachments && <><input ref={inputRef} className="sr-only" type="file" multiple accept={`image/*,${ACCEPTED_TYPES.filter((type) => !type.startsWith('image/')).join(',')}`} onChange={addFiles} /><button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || generating || sending || files.length >= MAX_ATTACHMENTS} className="attachment-button mb-0.5 shrink-0" aria-label="Anexar fotos e arquivos" title="Anexar fotos e arquivos"><Paperclip className="h-[18px] w-[18px]" /><span className="hidden md:inline">Anexar</span></button></>}
          <textarea ref={textareaRef} value={value} onChange={(event) => updateValue(event.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={12000} disabled={disabled} placeholder={disabled ? 'Você está offline' : 'Envie uma mensagem para a Lunatica'} aria-label="Mensagem para a Lunatica" className="max-h-44 min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60" />
          <button type="button" onClick={speech.toggle} disabled={disabled || generating || sending} className={`voice-button ${speech.listening ? 'listening' : ''}`} aria-label={speech.listening ? 'Parar ditado' : 'Usar microfone'} title={speech.supported ? 'Ditado por voz' : 'Ditado indisponível neste navegador'}>{speech.listening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}</button>
          {generating ? <button type="button" onClick={onStop} className="composer-action stop" aria-label="Parar geração"><Square className="h-3.5 w-3.5 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={disabled || !hasPayload || sending || insufficientCredits} className="composer-action" aria-label="Enviar mensagem">{sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}</button>}
        </div>
        {(allowAttachments || remainingCredits !== undefined || temporary) && <div className="flex items-center justify-between gap-3 px-3 pb-2 text-[10px] text-[var(--muted)]"><span>{sending ? 'Enviando sua mensagem…' : fileError ? fileError : temporary ? <span className="flex items-center gap-1 text-lunar-500"><Clock3 className="h-3 w-3" /> Temporário · expira em 24 h</span> : <><span className="sm:hidden">3 anexos · 12 MB total</span><span className="hidden sm:inline">Até 3 anexos · 5 MB cada · 12 MB no total</span></>}</span>{unlimited ? <span className="flex shrink-0 items-center gap-1 text-lunar-500"><Coins className="h-3 w-3" /> Ilimitado</span> : remainingCredits !== undefined && remainingCredits !== null && <span className={`flex shrink-0 items-center gap-1 ${insufficientCredits ? 'text-red-400' : ''}`}><Coins className="h-3 w-3" /><span className="sm:hidden">{cost} · {remainingCredits}</span><span className="hidden sm:inline">Custo {cost} · Restam {remainingCredits}</span></span>}</div>}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">A Lunatica pode cometer erros. Verifique informações importantes.</p>
    </div>
  )
}
