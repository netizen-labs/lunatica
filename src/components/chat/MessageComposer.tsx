import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'

interface MessageComposerProps {
  generating: boolean
  disabled?: boolean
  value?: string
  clearOnSend?: boolean
  onValueChange?: (value: string) => void
  onSend: (content: string) => Promise<void>
  onStop: () => void
}

export function MessageComposer({ generating, disabled = false, value: controlledValue, clearOnSend = true, onValueChange, onSend, onStop }: MessageComposerProps) {
  const [internalValue, setInternalValue] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const value = controlledValue ?? internalValue
  const updateValue = onValueChange ?? setInternalValue

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`
  }, [value])

  async function send() {
    if (!value.trim() || sending || generating || disabled) return
    const content = value
    if (clearOnSend) updateValue('')
    setSending(true)
    try { await onSend(content) } finally { setSending(false); textareaRef.current?.focus() }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-composer transition focus-within:border-lunar-400 dark:bg-ink-800">
        <textarea ref={textareaRef} value={value} onChange={(event) => updateValue(event.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={12000} disabled={disabled} placeholder={disabled ? 'Você está offline' : 'Envie uma mensagem para a Lunatica'} aria-label="Mensagem para a Lunatica" className="max-h-44 min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" />
        {generating ? <button type="button" onClick={onStop} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900" aria-label="Parar geração"><Square className="h-3.5 w-3.5 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={disabled || !value.trim() || sending} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lunar-500 text-white transition hover:bg-lunar-400 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-white/10" aria-label="Enviar mensagem"><ArrowUp className="h-5 w-5" /></button>}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-400">A Lunatica pode cometer erros. Verifique informações importantes.</p>
    </div>
  )
}
