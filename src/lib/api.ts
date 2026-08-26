import type { Session } from '@supabase/supabase-js'
import type { ApiErrorBody, ChatRequest, MemoryResponse, PlanRedemptionResponse, UsageStatus } from '../types/chat'
import { supabaseProjectUrl, supabasePublicKey } from './supabase'

interface StreamChatOptions {
  conversationId: string
  session: Session
  signal: AbortSignal
  onText: (text: string) => void
}

interface GroundingSource {
  title: string
  uri: string
}

function contentFromGeminiEvent(payload: string): { text: string; sources: GroundingSource[] } {
  try {
    const parsed = JSON.parse(payload) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> }
      }>
    }
    const candidate = parsed.candidates?.[0]
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    const sources = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk): GroundingSource[] => {
      const uri = chunk.web?.uri?.trim()
      if (!uri || !/^https:\/\//i.test(uri)) return []
      return [{ title: chunk.web?.title?.trim() || new URL(uri).hostname, uri }]
    })
    return { text, sources }
  } catch {
    return { text: '', sources: [] }
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
  const groundingSources = new Map<string, string>()

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
        if (data && data !== '[DONE]') {
          const next = contentFromGeminiEvent(data)
          if (next.text) onText(next.text)
          for (const source of next.sources) groundingSources.set(source.uri, source.title)
        }
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data:')) {
        const next = contentFromGeminiEvent(line.slice(5).trim())
        if (next.text) onText(next.text)
        for (const source of next.sources) groundingSources.set(source.uri, source.title)
      }
    }
  }

  if (groundingSources.size) {
    const sources = [...groundingSources.entries()].slice(0, 8).map(([uri, title]) => `- [${title.replace(/[[\]]/g, '')}](${uri})`).join('\n')
    onText(`\n\n### Fontes\n${sources}`)
  }
}

export async function getUsageStatus(session: Session, signal?: AbortSignal): Promise<UsageStatus> {
  if (!supabaseProjectUrl) throw new Error('Supabase não configurado')
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/chat`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublicKey,
    },
    signal,
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(`${response.status}: ${body.error || 'Falha ao consultar o limite diário'}`)
  }
  return response.json() as Promise<UsageStatus>
}

export async function requestMemory(session: Session, payload: { action: 'analyze'; messageId: string } | { action: 'add'; content: string }, signal?: AbortSignal): Promise<MemoryResponse> {
  if (!supabaseProjectUrl) throw new Error('Supabase não configurado')
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/memory`, {
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
    throw new Error(`${response.status}: ${body.error || 'Não foi possível salvar a memória'}`)
  }
  return response.json() as Promise<MemoryResponse>
}

export async function redeemLunaMax(session: Session, code: string, acceptedDisclaimer: boolean): Promise<PlanRedemptionResponse> {
  if (!supabaseProjectUrl) throw new Error('Supabase não configurado')
  const response = await fetch(`${supabaseProjectUrl}/functions/v1/redeem-plan`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, acceptedDisclaimer }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(`${response.status}: ${body.error || 'Não foi possível ativar o LunaMax'}`)
  }
  return response.json() as Promise<PlanRedemptionResponse>
}
