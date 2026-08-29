import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechResultEvent extends Event {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
}

interface SpeechErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface SpeechRecognitionOptions {
  value: string
  onChange: (value: string) => void
  onError: (message: string) => void
}

export function useSpeechRecognition({ value, onChange, onError }: SpeechRecognitionOptions) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const baseValueRef = useRef('')
  const Recognition = typeof window === 'undefined' ? undefined : window.SpeechRecognition ?? window.webkitSpeechRecognition
  const supported = Boolean(Recognition)

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) {
      stop()
      return
    }
    if (!Recognition) {
      onError('O ditado por voz não é suportado neste navegador.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true
    baseValueRef.current = value.trim()
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0]?.transcript ?? ''
      const next = [baseValueRef.current, transcript.trim()].filter(Boolean).join(' ')
      onChange(next)
    }
    recognition.onerror = (event) => {
      setListening(false)
      recognitionRef.current = null
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') onError('Permita o acesso ao microfone para usar o ditado.')
      else if (event.error !== 'aborted' && event.error !== 'no-speech') onError('Não foi possível ouvir. Tente novamente.')
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      onError('O microfone já está em uso. Aguarde e tente novamente.')
    }
  }, [Recognition, listening, onChange, onError, stop, value])

  return { supported, listening, toggle, stop }
}
