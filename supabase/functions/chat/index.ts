import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.112.4'
import { corsHeaders } from '../_shared/cors.ts'
import { GeminiError, streamResponse, type GeminiAttachment, type HistoryMessage } from '../_shared/gemini.ts'

const MAX_REQUESTS_PER_MINUTE = 20
const FREE_DAILY_CREDIT_LIMIT = 30
const LUNAMAX_DAILY_CREDIT_LIMIT = 300
const HISTORY_LIMIT = 40
const MAX_ATTACHMENTS = 3
const MAX_INLINE_BYTES = 12 * 1024 * 1024

function planLimits(lunaMax: boolean) {
  return lunaMax
    ? { daily: LUNAMAX_DAILY_CREDIT_LIMIT, messages: 60, conversationAttachments: 30 }
    : { daily: FREE_DAILY_CREDIT_LIMIT, messages: 12, conversationAttachments: 3 }
}

interface Clients {
  admin: SupabaseClient
  userClient: SupabaseClient
  user: User
}

interface AttachmentRow {
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function authenticate(request: Request): Promise<Clients | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Serviço não configurado' }, 500)
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Autenticação necessária' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (error || !data.user) return jsonResponse({ error: 'Sessão inválida ou expirada' }, 401)
  return {
    admin,
    user: data.user,
    userClient: createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    }),
  }
}

function dayWindow() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const reset = new Date(start)
  reset.setUTCDate(reset.getUTCDate() + 1)
  return { start: start.toISOString(), resetsAt: reset.toISOString() }
}

async function hasLunaMax(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from('user_plans').select('status, expires_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.status === 'active' && new Date(data.expires_at).getTime() > Date.now()
}

async function usageStatus(admin: SupabaseClient, userId: string, lunaMax?: boolean) {
  const { start, resetsAt } = dayWindow()
  const activeLunaMax = lunaMax ?? await hasLunaMax(admin, userId)
  const limits = planLimits(activeLunaMax)
  const { data, error } = await admin.from('usage_events').select('cost').eq('user_id', userId).gte('created_at', start).limit(500)
  if (error) throw error
  const used = (data ?? []).reduce((total, event) => total + Number(event.cost), 0)
  return {
    limit: limits.daily,
    used,
    remaining: Math.max(0, limits.daily - used),
    resetsAt,
    plan: activeLunaMax ? 'lunamax' : 'free',
    conversation: { messageLimit: limits.messages, attachmentLimit: limits.conversationAttachments },
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 32768, bytes.length)))
  }
  return btoa(binary)
}

async function downloadAttachments(admin: SupabaseClient, rows: AttachmentRow[]): Promise<GeminiAttachment[]> {
  const files: GeminiAttachment[] = []
  for (const row of rows) {
    const { data, error } = await admin.storage.from('attachments').download(row.storage_path)
    if (error || !data) throw new Error('Falha ao ler um anexo')
    const bytes = new Uint8Array(await data.arrayBuffer())
    const isText = row.mime_type.startsWith('text/') || row.mime_type === 'application/json'
    files.push({
      fileName: row.file_name,
      mimeType: row.mime_type,
      data: isText ? new TextDecoder().decode(bytes).slice(0, 80_000) : bytesToBase64(bytes),
    })
  }
  return files
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405)

  try {
    const clients = await authenticate(request)
    if (clients instanceof Response) return clients
    const { admin, user, userClient } = clients
    const lunaMax = await hasLunaMax(admin, user.id)
    const limits = planLimits(lunaMax)

    if (request.method === 'GET') return jsonResponse(await usageStatus(admin, user.id, lunaMax))

    const body = await request.json().catch(() => null) as { conversationId?: unknown } | null
    if (!body || typeof body.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) {
      return jsonResponse({ error: 'Conversa inválida' }, 400)
    }

    const { data: conversation, error: conversationError } = await userClient.from('conversations').select('id').eq('id', body.conversationId).single()
    if (conversationError || !conversation) return jsonResponse({ error: 'Conversa não encontrada' }, 404)

    const minuteAgo = new Date(Date.now() - 60_000).toISOString()
    const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString()
    await admin.from('rate_limits').delete().eq('user_id', user.id).lt('created_at', tenMinutesAgo)
    const { count, error: countError } = await admin.from('rate_limits').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', minuteAgo)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_REQUESTS_PER_MINUTE) return jsonResponse({ error: 'Muitas solicitações. Aguarde um minuto.' }, 429)

    const { data: history, error: historyError } = await userClient.from('messages').select('id, role, content, created_at').eq('conversation_id', body.conversationId).order('created_at', { ascending: false }).limit(lunaMax ? 120 : HISTORY_LIMIT)
    if (historyError) throw historyError
    if (!history?.length || history[0].role !== 'user') return jsonResponse({ error: 'A conversa precisa terminar com uma mensagem do usuário' }, 400)

    const { data: attachmentRows, error: attachmentError } = await userClient.from('message_attachments').select('storage_path, file_name, mime_type, size_bytes').eq('message_id', history[0].id).order('created_at', { ascending: true })
    if (attachmentError) throw attachmentError
    const attachments = (attachmentRows ?? []) as AttachmentRow[]
    if (attachments.length > MAX_ATTACHMENTS) return jsonResponse({ error: 'Use no máximo 3 anexos por mensagem.' }, 400)
    const totalBytes = attachments.reduce((total, file) => total + Number(file.size_bytes), 0)
    if (totalBytes > MAX_INLINE_BYTES) return jsonResponse({ error: 'Os anexos desta mensagem ultrapassam 12 MB no total.' }, 400)

    const [{ count: messageCount, error: messageCountError }, { count: conversationAttachmentCount, error: conversationAttachmentCountError }] = await Promise.all([
      userClient.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', body.conversationId).eq('role', 'user'),
      userClient.from('message_attachments').select('id', { count: 'exact', head: true }).eq('conversation_id', body.conversationId),
    ])
    if (messageCountError || conversationAttachmentCountError) throw messageCountError ?? conversationAttachmentCountError
    if ((messageCount ?? 0) > limits.messages || (conversationAttachmentCount ?? 0) > limits.conversationAttachments) {
      return jsonResponse({
        error: 'Esta conversa atingiu o limite de contexto. Comece um novo chat limpo para continuar.',
        code: 'NEW_CHAT_REQUIRED',
      }, 409)
    }

    const cost = 1 + attachments.length
    const usage = await usageStatus(admin, user.id, lunaMax)
    if (usage.remaining < cost) return jsonResponse({ error: `Limite diário insuficiente. Esta mensagem custa ${cost} crédito${cost === 1 ? '' : 's'}.` }, 429)

    const { error: rateError } = await admin.from('rate_limits').insert({ user_id: user.id })
    if (rateError) throw rateError

    const { data: profile, error: profileError } = await admin.from('profiles').select('custom_instructions').eq('id', user.id).single()
    if (profileError) throw profileError
    const { data: memoryRows, error: memoryError } = await userClient.from('memories').select('summary').order('updated_at', { ascending: false }).limit(20)
    if (memoryError) throw memoryError
    const files = await downloadAttachments(admin, attachments)
    const messages = [...history].reverse().map(({ role, content }) => ({ role, content })) as HistoryMessage[]
    const stream = await streamResponse(messages, request.signal, { customInstructions: profile.custom_instructions, attachments: files, memories: (memoryRows ?? []).map((row) => row.summary), lunaMax })
    const { error: usageError } = await admin.from('usage_events').insert({ user_id: user.id, cost, attachment_count: attachments.length })
    if (usageError) throw usageError
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
