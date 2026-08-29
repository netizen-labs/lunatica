export type MemoryCategory = 'identity' | 'education' | 'work' | 'preference' | 'personal' | 'project' | 'goal' | 'custom'

export interface MemoryDraft {
  summary: string
  category: MemoryCategory
}

const categories = new Set<MemoryCategory>(['identity', 'education', 'work', 'preference', 'personal', 'project', 'goal', 'custom'])

export async function summarizeMemories(content: string, existing: string[], manual: boolean, signal: AbortSignal) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
  if (!apiKey) throw new Error('Gemini não configurado')

  const prompt = `Você organiza a memória pessoal da Lunatica 1.5.

Extraia apenas fatos estáveis e úteis sobre o próprio usuário: nome, estudo, profissão, local, preferências duradouras, objetivos, projetos pessoais ou contexto criativo relevante.
Use a categoria "project" para algo que o usuário está construindo ou criando e "goal" para um objetivo duradouro.
Não salve perguntas, pedidos momentâneos, dados sensíveis, senhas, chaves, informações financeiras, médicas ou inferências incertas.
Escreva cada memória em português, em uma frase curta, objetiva e na terceira pessoa, começando com "O usuário".
Não repita fatos já existentes. ${manual ? 'O usuário pediu explicitamente para memorizar o conteúdo; produza no máximo uma memória.' : 'Se não houver um fato pessoal estável, retorne uma lista vazia.'}

Memórias existentes:
${existing.length ? existing.map((item) => `- ${item}`).join('\n') : '- nenhuma'}

Conteúdo novo:
${content.slice(0, 4000)}`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 512,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
              type: 'object',
              properties: {
                memories: {
                  type: 'array',
                  maxItems: manual ? 1 : 3,
                  items: {
                    type: 'object',
                    properties: {
                      summary: { type: 'string', minLength: 3, maxLength: 300 },
                      category: { type: 'string', enum: [...categories] },
                    },
                    required: ['summary', 'category'],
                  },
                },
              },
              required: ['memories'],
        },
      },
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
  })

  if (!response.ok) {
    console.error('Memory Gemini request failed', response.status, (await response.text()).slice(0, 300))
    throw new Error(response.status === 429 ? 'Limite do Gemini atingido' : 'Não foi possível organizar a memória')
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  const parsed = JSON.parse(text) as { memories?: Array<{ summary?: unknown; category?: unknown }> }
  return (parsed.memories ?? []).slice(0, manual ? 1 : 3).flatMap((item): MemoryDraft[] => {
    const summary = typeof item.summary === 'string' ? item.summary.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
    const category = typeof item.category === 'string' && categories.has(item.category as MemoryCategory) ? item.category as MemoryCategory : 'personal'
    return summary.length >= 3 ? [{ summary, category }] : []
  })
}
