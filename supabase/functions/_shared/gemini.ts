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
  memories?: string[]
  lunaMax?: boolean
}

export function convertMessagesToGeminiFormat(messages: HistoryMessage[]): GeminiContent[] {
  return messages
    .filter((message) => message.role !== 'system' && message.content.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

function buildSystemInstruction(customInstructions?: string, memories: string[] = [], webSearchEnabled = false) {
  const clean = customInstructions?.trim().slice(0, 2000)
  const sections = [LUNATICA_SYSTEM_PROMPT]
  sections.push(webSearchEnabled
    ? 'STATUS DA BUSCA WEB: ATIVA. Para perguntas sobre lançamentos, notícias, preços, pessoas, produtos ou qualquer fato que possa ter mudado, use a ferramenta Google Search antes de responder. Só diga que pesquisou quando a ferramenta realmente retornar resultados. Baseie a resposta nesses resultados; a aplicação anexará as fontes verificáveis.'
    : 'STATUS DA BUSCA WEB: INDISPONÍVEL NESTA CONVERSA. Nunca diga “pesquisei”, “fiz uma busca”, “consultei fontes” ou algo equivalente. Se o pedido depender de informação recente, explique brevemente que não pode confirmar em tempo real e não transforme conhecimento antigo em fato atual.')
  if (clean) sections.push(`INSTRUÇÕES PESSOAIS DO USUÁRIO:\n${clean}\n\nSiga essas preferências somente quando não entrarem em conflito com o prompt de sistema, segurança, fatos ou com o pedido atual.`)
  if (memories.length) sections.push(`MEMÓRIAS CONFIRMADAS PELO USUÁRIO:\n${memories.slice(0, 20).map((memory) => `- ${memory}`).join('\n')}\n\nUse essas memórias apenas quando forem relevantes. Não as revele sem necessidade nem trate inferências como fatos.`)
  return sections.join('\n\n')
}

function addAttachments(contents: GeminiContent[], attachments: GeminiAttachment[]) {
  if (!attachments.length || !contents.length) return contents
  const next = contents.map((content) => ({ ...content, parts: [...content.parts] }))
  let lastUserIndex = -1
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index].role === 'user') { lastUserIndex = index; break }
  }
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
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
  if (!apiKey) throw new GeminiError(500, 'Gemini não configurado')

  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystemInstruction(options.customInstructions, options.memories, Boolean(options.lunaMax)) }] },
        contents: addAttachments(convertMessagesToGeminiFormat(messages), options.attachments ?? []),
        ...(options.lunaMax ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          maxOutputTokens: options.lunaMax ? 6144 : 3072,
          thinkingConfig: { thinkingBudget: options.lunaMax ? 2048 : 1024 },
        },
      }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(75_000)]),
      },
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new GeminiError(504, 'A IA demorou demais. Tente novamente.')
    throw error
  }

  if (!response.ok) {
    const details = await response.text()
    console.error('Gemini request failed', response.status, details.slice(0, 500))
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400
    throw new GeminiError(status, status === 429 ? 'Limite do Gemini atingido' : 'Falha ao consultar o Gemini')
  }
  if (!response.body) throw new GeminiError(502, 'Gemini retornou uma resposta vazia')
  return response.body
}
