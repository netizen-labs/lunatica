import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import { corsHeaders } from '../_shared/cors.ts'
import { GeminiError, streamResponse, type HistoryMessage } from '../_shared/gemini.ts'

const MAX_REQUESTS_PER_MINUTE = 20
const HISTORY_LIMIT = 40

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Serviço não configurado' }, 500)
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Autenticação necessária' }, 401)

    const token = authorization.slice('Bearer '.length)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return jsonResponse({ error: 'Sessão inválida ou expirada' }, 401)
    const user = authData.user

    const body = await request.json().catch(() => null) as { conversationId?: unknown } | null
    if (!body || typeof body.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) {
      return jsonResponse({ error: 'Conversa inválida' }, 400)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: conversation, error: conversationError } = await userClient
      .from('conversations')
      .select('id')
      .eq('id', body.conversationId)
      .single()
    if (conversationError || !conversation) return jsonResponse({ error: 'Conversa não encontrada' }, 404)

    const minuteAgo = new Date(Date.now() - 60_000).toISOString()
    const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString()
    await admin.from('rate_limits').delete().eq('user_id', user.id).lt('created_at', tenMinutesAgo)
    const { count, error: countError } = await admin.from('rate_limits').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', minuteAgo)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_REQUESTS_PER_MINUTE) return jsonResponse({ error: 'Muitas solicitações. Aguarde um minuto.' }, 429)
    const { error: rateError } = await admin.from('rate_limits').insert({ user_id: user.id })
    if (rateError) throw rateError

    const { data: history, error: historyError } = await userClient
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', body.conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    if (historyError) throw historyError
    if (!history?.length || history[0].role !== 'user') return jsonResponse({ error: 'A conversa precisa terminar com uma mensagem do usuário' }, 400)

    const messages = [...history].reverse().map(({ role, content }) => ({ role, content })) as HistoryMessage[]
    const stream = await streamResponse(messages, request.signal)
    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    if (error instanceof GeminiError) return jsonResponse({ error: error.message }, error.status)
    console.error('Unexpected chat function error', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'Não foi possível gerar uma resposta. Tente novamente.' }, 500)
  }
})
