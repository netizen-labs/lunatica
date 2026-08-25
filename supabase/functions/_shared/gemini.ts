import { LUNATICA_SYSTEM_PROMPT } from './system.ts'

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface GeminiAttachment {
  fileName: string
  mimeType: string
  data: string
}

interface StreamResponseOptions {
  customInstructions?: string
  attachments?: GeminiAttachment[]
}

export function convertMessagesToGeminiFormat(messages: HistoryMessage[]): GeminiContent[] {
  return messages
    .filter((message) => message.role !== 'system' && message.content.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

function buildSystemInstruction(customInstructions?: string) {
  const clean = customInstructions?.trim().slice(0, 2000)
  if (!clean) return LUNATICA_SYSTEM_PROMPT
  return `${LUNATICA_SYSTEM_PROMPT}\n\nINSTRUÇÕES PESSOAIS DO USUÁRIO:\n${clean}\n\nSiga essas preferências somente quando não entrarem em conflito com o prompt de sistema, segurança, fatos ou com o pedido atual.`
}

function addAttachments(contents: GeminiContent[], attachments: GeminiAttachment[]) {
  if (!attachments.length || !contents.length) return contents
  const next = contents.map((content) => ({ ...content, parts: [...content.parts] }))
  const lastUserIndex = next.findLastIndex((content) => content.role === 'user')
  if (lastUserIndex < 0) return next
  const parts = next[lastUserIndex].parts
  for (const attachment of attachments) {
    parts.push({ text: `\n[Anexo: ${attachment.fileName}]` })
    if (attachment.mimeType.startsWith('text/') || attachment.mimeType === 'application/json') {
      parts.push({ text: attachment.data })
    } else {
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } })
    }
  }
  return next
}

export class GeminiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export async function streamResponse(messages: HistoryMessage[], signal: AbortSignal, options: StreamResponseOptions = {}) {
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
        system_instruction: { parts: [{ text: buildSystemInstruction(options.customInstructions) }] },
        contents: addAttachments(convertMessagesToGeminiFormat(messages), options.attachments ?? []),
        generationConfig: {
          maxOutputTokens: 3072,
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
