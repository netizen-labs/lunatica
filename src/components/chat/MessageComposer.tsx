import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Check, Clock3, FileText, LoaderCircle, Mic, MicOff, Paperclip, Square, X } from 'lucide-react'
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
  onSend: (content: string, files: File[]) => Promise<boolean | void>
  onStop: () => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json']
const FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.txt,.md,.csv,.json,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,text/plain,text/markdown,text/csv,application/json'
const MAX_SIZE = 5 * 1024 * 1024
const MAX_TOTAL = 12 * 1024 * 1024
const MAX_ATTACHMENTS = 3

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

function normalizedFile(file: File) {
  const browserType = file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase()
  const inferred: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json' }
  const type = browserType === 'image/jpg' ? 'image/jpeg' : browserType || (extension ? inferred[extension] : '')
  return type && type !== file.type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file
}

export function MessageComposer({ generating, disabled = false, value: controlledValue, clearOnSend = true, allowAttachments = false, remainingCredits, unlimited = false, temporary = false, onValueChange, onSend, onStop }: MessageComposerProps) {
  const [internalValue, setInternalValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
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

  function queueFiles(incoming: File[]) {
    const selected = incoming.map(normalizedFile)
    if (!selected.length) return
    const next = [...files, ...selected]
    if (next.length > MAX_ATTACHMENTS) return setFileError('Você pode enviar no máximo 3 anexos por mensagem.')
    if (selected.some((file) => !ACCEPTED_TYPES.includes(file.type))) return setFileError('Formato não aceito. Use JPG, PNG, WEBP, HEIC, PDF, TXT, Markdown, CSV ou JSON.')
    if (selected.some((file) => file.size > MAX_SIZE)) return setFileError('Cada anexo deve ter no máximo 5 MB.')
    if (next.reduce((total, file) => total + file.size, 0) > MAX_TOTAL) return setFileError('Os anexos devem somar no máximo 12 MB.')
    setFileError('')
    setFiles(next)
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    queueFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function pasteFiles(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files)
    if (!pasted.length) return
    event.preventDefault()
    queueFiles(pasted)
  }

  function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled || generating || sending) return
    queueFiles(Array.from(event.dataTransfer.files))
  }

  async function send() {
    if (!hasPayload || sending || generating || disabled || insufficientCredits) return
    const content = value
    const selectedFiles = files
    setSending(true)
    try {
      const sent = await onSend(content, selectedFiles)
      if (clearOnSend && sent !== false) { updateValue(''); setFiles([]); setFileError('') }
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
      <div className={`composer-shell ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={dropFiles}>
        {dragging && <div className="attachment-drop-hint" aria-hidden="true"><Paperclip className="h-5 w-5" /> Solte para anexar</div>}
        {files.length > 0 && <div className="attachment-preview-list" aria-label="Anexos prontos para enviar">{files.map((file, index) => <article key={`${file.name}-${file.lastModified}-${index}`} className="attachment-preview-card">{previewUrls[index] ? <img src={previewUrls[index]} alt={`Prévia de ${file.name}`} /> : <span className="attachment-file-icon"><FileText className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><strong>{file.name}</strong><small><Check className="inline h-3 w-3" /> Pronto · {fileSize(file.size)}</small></div><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={sending} aria-label={`Remover ${file.name}`}><X className="h-4 w-4" /></button></article>)}</div>}
        <div className="flex items-end gap-2 p-2">
          {allowAttachments && <><input id={inputId} className="sr-only" type="file" multiple accept={FILE_ACCEPT} disabled={disabled || generating || sending || files.length >= MAX_ATTACHMENTS} onChange={addFiles} /><label htmlFor={inputId} aria-label="Anexar fotos e arquivos" aria-disabled={disabled || generating || sending || files.length >= MAX_ATTACHMENTS} title="Anexar fotos e arquivos" className={`attachment-button mb-0.5 shrink-0 ${(disabled || generating || sending || files.length >= MAX_ATTACHMENTS) ? 'pointer-events-none opacity-35' : ''}`}><Paperclip className="h-[18px] w-[18px]" /><span className="hidden md:inline">Anexar</span></label></>}
          <textarea ref={textareaRef} value={value} onChange={(event) => updateValue(event.target.value)} onPaste={pasteFiles} onKeyDown={onKeyDown} rows={1} maxLength={12000} disabled={disabled} placeholder={disabled ? 'Você está offline' : files.length ? 'Pergunte algo sobre os anexos…' : 'Envie uma mensagem para a Lunatica'} aria-label="Mensagem para a Lunatica" className="max-h-44 min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60" />
          <button type="button" onClick={speech.toggle} disabled={disabled || generating || sending} className={`voice-button ${speech.listening ? 'listening' : ''}`} aria-label={speech.listening ? 'Parar ditado' : 'Usar microfone'} title={speech.supported ? 'Ditado por voz' : 'Ditado indisponível neste navegador'}>{speech.listening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}</button>
          {generating ? <button type="button" onClick={onStop} className="composer-action stop" aria-label="Parar geração"><Square className="h-3.5 w-3.5 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={disabled || !hasPayload || sending || insufficientCredits} className="composer-action" aria-label="Enviar mensagem">{sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}</button>}
        </div>
        {(allowAttachments || temporary) && <div className={`px-3 pb-2 text-[10px] ${fileError ? 'text-red-400' : 'text-[var(--muted)]'}`} aria-live="polite"><span>{sending ? 'Enviando anexos com segurança…' : fileError ? fileError : files.length ? `${files.length} ${files.length === 1 ? 'anexo pronto' : 'anexos prontos'} · a Lunatica vai analisar o conteúdo` : temporary ? <span className="flex items-center gap-1 text-lunar-500"><Clock3 className="h-3 w-3" /> Temporário · expira em 24 h</span> : <><span className="sm:hidden">Fotos e arquivos · até 3</span><span className="hidden sm:inline">Anexe, cole ou arraste até 3 fotos e arquivos · 5 MB cada</span></>}</span></div>}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">A Lunatica pode cometer erros. Verifique informações importantes.</p>
    </div>
  )
}
