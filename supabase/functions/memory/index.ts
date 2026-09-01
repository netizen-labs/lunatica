import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.112.4'
import { corsHeaders } from '../_shared/cors.ts'
import { summarizeMemories } from '../_shared/memory.ts'

const MAX_MEMORIES = 50
const MAX_REQUESTS_PER_MINUTE = 20
interface Clients { admin: SupabaseClient; userClient: SupabaseClient; user: User }

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function authenticate(request: Request): Promise<Clients | Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Serviço não configurado' }, 500)
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Autenticação necessária' }, 401)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(authorization.slice(7))
  if (error || !data.user) return json({ error: 'Sessão inválida ou expirada' }, 401)
  return {
    admin,
    user: data.user,
    userClient: createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }),
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const clients = await authenticate(request)
    if (clients instanceof Response) return clients
    const { admin, user, userClient } = clients
    const body = await request.json().catch(() => null) as { action?: unknown; messageId?: unknown; content?: unknown } | null
    if (!body || (body.action !== 'analyze' && body.action !== 'add')) return json({ error: 'Ação inválida' }, 400)

    const minuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: requestCount, error: rateCountError } = await admin.from('rate_limits').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', minuteAgo)
    if (rateCountError) throw rateCountError
    if ((requestCount ?? 0) >= MAX_REQUESTS_PER_MINUTE) return json({ error: 'Muitas solicitações. Aguarde um minuto.' }, 429)

    let content = ''
    let sourceMessageId: string | null = null
    const manual = body.action === 'add'
    if (manual) {
      if (typeof body.content !== 'string' || body.content.trim().length < 3 || body.content.length > 800) return json({ error: 'Descreva a memória em até 800 caracteres.' }, 400)
      content = body.content.trim()
    } else {
      if (typeof body.messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.messageId)) return json({ error: 'Mensagem inválida' }, 400)
      const { data: message, error } = await userClient.from('messages').select('id, content, role').eq('id', body.messageId).eq('role', 'user').single()
      if (error || !message) return json({ error: 'Mensagem não encontrada' }, 404)
      content = message.content
      sourceMessageId = message.id
    }

    const { count: memoryCount, error: countError } = await userClient.from('memories').select('id', { count: 'exact', head: true })
    if (countError) throw countError
    if ((memoryCount ?? 0) >= MAX_MEMORIES) return json({ error: 'Você atingiu o limite de 50 memórias. Exclua uma para adicionar outra.' }, 409)
    const { data: existing, error: existingError } = await userClient.from('memories').select('summary').order('updated_at', { ascending: false }).limit(30)
    if (existingError) throw existingError

    const analysis = await summarizeMemories(content, (existing ?? []).map((item) => item.summary), manual, request.signal)
    const drafts = analysis.memories
    if (!drafts.length) return json({ created: [], recalled: analysis.recalled })
    const { error: rateError } = await admin.from('rate_limits').insert({ user_id: user.id })
    if (rateError) throw rateError

    const created: unknown[] = []
    for (const draft of drafts.slice(0, Math.max(0, MAX_MEMORIES - (memoryCount ?? 0)))) {
      const { data, error } = await admin.from('memories').insert({ user_id: user.id, source_message_id: sourceMessageId, summary: draft.summary, category: manual ? 'custom' : draft.category }).select().single()
      if (error?.code === '23505') continue
      if (error) throw error
      created.push(data)
    }
    return json({ created, recalled: false })
  } catch (error) {
    console.error('Memory function error', error instanceof Error ? error.message : 'unknown')
    return json({ error: error instanceof Error && /Gemini|memória|solicitações/i.test(error.message) ? error.message : 'Não foi possível salvar a memória.' }, 500)
  }
})
