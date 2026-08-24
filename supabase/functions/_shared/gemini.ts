import { LUNATICA_SYSTEM_PROMPT } from './system.ts'

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

export function convertMessagesToGeminiFormat(messages: HistoryMessage[]): GeminiContent[] {
  return messages
    .filter((message) => message.role !== 'system' && message.content.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

export class GeminiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export async function streamResponse(messages: HistoryMessage[], signal: AbortSignal) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.7-flash'
  if (!apiKey) throw new GeminiError(500, 'Gemini não configurado')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: LUNATICA_SYSTEM_PROMPT }] },
        contents: convertMessagesToGeminiFormat(messages),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
      signal,
    },
  )

  if (!response.ok) {
    const details = await response.text()
    console.error('Gemini request failed', response.status, details.slice(0, 500))
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400
    throw new GeminiError(status, status === 429 ? 'Limite do Gemini atingido' : 'Falha ao consultar o Gemini')
  }
  if (!response.body) throw new GeminiError(502, 'Gemini retornou uma resposta vazia')
  return response.body
}
