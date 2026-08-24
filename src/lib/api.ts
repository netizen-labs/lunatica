import type { Session } from '@supabase/supabase-js'
import type { ApiErrorBody, ChatRequest } from '../types/chat'
import { supabaseProjectUrl, supabasePublicKey } from './supabase'

interface StreamChatOptions {
  conversationId: string
  session: Session
  signal: AbortSignal
  onText: (text: string) => void
}

function textFromGeminiEvent(payload: string) {
  try {
    const parsed = JSON.parse(payload) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  } catch {
    return ''
  }
}

export async function streamChatResponse({ conversationId, session, signal, onText }: StreamChatOptions) {
  if (!supabaseProjectUrl) throw new Error('Supabase não configurado')

  const payload: ChatRequest = { conversationId }
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(`${response.status}: ${body.error || 'Falha ao gerar resposta'}`)
  }
  if (!response.body) throw new Error('Resposta sem conteúdo')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data && data !== '[DONE]') onText(textFromGeminiEvent(data))
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data:')) onText(textFromGeminiEvent(line.slice(5).trim()))
    }
  }
}
