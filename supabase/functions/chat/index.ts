import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.112.4'
import { corsHeaders } from '../_shared/cors.ts'
import { collectGeminiStream, GeminiError, streamResponse, type GeminiAttachment, type HistoryMessage } from '../_shared/gemini.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MAX_REQUESTS_PER_MINUTE = 20
const LUNAMAX_REQUESTS_PER_MINUTE = 60
const FREE_DAILY_CREDIT_LIMIT = 30
const HISTORY_LIMIT = 32
const LUNAMAX_HISTORY_LIMIT = 60
const MAX_ATTACHMENTS = 3
const MAX_INLINE_BYTES = 12 * 1024 * 1024

function planLimits(lunaMax: boolean) {
  return lunaMax
    ? { daily: null, messages: null, conversationAttachments: null }
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
  const active = data?.status === 'active' && new Date(data.expires_at).getTime() > Date.now()
  if (data?.status === 'active' && !active) await admin.from('user_plans').update({ status: 'expired' }).eq('user_id', userId)
  return active
}

async function usageStatus(admin: SupabaseClient, userId: string, lunaMax?: boolean) {
  const { start, resetsAt } = dayWindow()
  const activeLunaMax = lunaMax ?? await hasLunaMax(admin, userId)
  const limits = planLimits(activeLunaMax)
  if (activeLunaMax) return {
    limit: null,
    used: 0,
    remaining: null,
    unlimited: true,
    resetsAt,
    plan: 'lunamax',
    conversation: { messageLimit: null, attachmentLimit: null },
  }
  const { data, error } = await admin.from('usage_events').select('cost').eq('user_id', userId).gte('created_at', start).limit(500)
  if (error) throw error
  const used = (data ?? []).reduce((total, event) => total + Number(event.cost), 0)
  return {
    limit: limits.daily,
    used,
    remaining: Math.max(0, limits.daily - used),
    unlimited: false,
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
  return Promise.all(rows.map(async (row) => {
    const { data, error } = await admin.storage.from('attachments').download(row.storage_path)
    if (error || !data) throw new Error('Falha ao ler um anexo')
    const bytes = new Uint8Array(await data.arrayBuffer())
    const isText = row.mime_type.startsWith('text/') || row.mime_type === 'application/json'
    return {
      fileName: row.file_name,
      mimeType: row.mime_type,
      data: isText ? new TextDecoder().decode(bytes).slice(0, 80_000) : bytesToBase64(bytes),
    }
  }))
}

interface PersistGenerationOptions {
  admin: SupabaseClient
  generationId: string
  conversationId: string
  userId: string
  stream: ReadableStream<Uint8Array>
  cost: number
  attachmentCount: number
  lunaMax: boolean
}

async function persistGeneration({ admin, generationId, conversationId, userId, stream, cost, attachmentCount, lunaMax }: PersistGenerationOptions) {
  let lastCancellationCheck = 0
  const cancellationRequested = async (force = false) => {
    if (!force && Date.now() - lastCancellationCheck < 600) return false
    lastCancellationCheck = Date.now()
    const { data, error } = await admin.from('chat_generations').select('cancel_requested, status').eq('id', generationId).eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data?.cancel_requested === true || data?.status === 'cancelled'
  }

  try {
    const result = await collectGeminiStream(stream, () => cancellationRequested())
    if (result.cancelled || await cancellationRequested(true)) {
      await admin.from('chat_generations').update({ status: 'cancelled', cancel_requested: true, error_code: null }).eq('id', generationId).eq('user_id', userId)
      return
    }
    const content = result.content.trim()
    if (!content) {
      await admin.from('chat_generations').update({ status: 'failed', error_code: 'EMPTY_RESPONSE' }).eq('id', generationId).eq('user_id', userId)
      return
    }

    const { data: assistant, error: messageError } = await admin.from('messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content,
    }).select('id').single()
    if (messageError) throw messageError

    const { error: generationError } = await admin.from('chat_generations').update({
      status: 'completed',
      assistant_message_id: assistant.id,
      error_code: null,
    }).eq('id', generationId).eq('user_id', userId)
    if (generationError) throw generationError

    if (!lunaMax) {
      const { error: usageError } = await admin.from('usage_events').insert({ user_id: userId, cost, attachment_count: attachmentCount })
      if (usageError) console.error('Usage persistence failed', usageError.message)
    }
  } catch (error) {
    console.error('Generation persistence failed', error instanceof Error ? error.message : 'unknown')
    await admin.from('chat_generations').update({ status: 'failed', error_code: 'PERSISTENCE_FAILED' }).eq('id', generationId).eq('user_id', userId).eq('status', 'generating')
  }
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

    const body = await request.json().catch(() => null) as { action?: unknown; conversationId?: unknown; generationId?: unknown } | null
    if (body?.action === 'cancel') {
      if (typeof body.generationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.generationId)) return jsonResponse({ error: 'Geração inválida' }, 400)
      const { data, error } = await admin.from('chat_generations').update({ cancel_requested: true }).eq('id', body.generationId).eq('user_id', user.id).eq('status', 'generating').select('id').maybeSingle()
      if (error) throw error
      return jsonResponse({ cancelled: Boolean(data) })
    }
    if (!body || typeof body.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) {
      return jsonResponse({ error: 'Conversa inválida' }, 400)
    }
    if (typeof body.generationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.generationId)) return jsonResponse({ error: 'Geração inválida' }, 400)

    const { data: conversation, error: conversationError } = await userClient.from('conversations').select('id, is_temporary, expires_at').eq('id', body.conversationId).single()
    if (conversationError || !conversation) return jsonResponse({ error: 'Conversa não encontrada' }, 404)
    if (conversation.is_temporary && conversation.expires_at && new Date(conversation.expires_at).getTime() <= Date.now()) return jsonResponse({ error: 'Este chat temporário expirou.' }, 410)

    const minuteAgo = new Date(Date.now() - 60_000).toISOString()
    const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString()
    await admin.from('rate_limits').delete().eq('user_id', user.id).lt('created_at', tenMinutesAgo)
    const { count, error: countError } = await admin.from('rate_limits').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', minuteAgo)
    if (countError) throw countError
    if ((count ?? 0) >= (lunaMax ? LUNAMAX_REQUESTS_PER_MINUTE : MAX_REQUESTS_PER_MINUTE)) return jsonResponse({ error: 'Muitas solicitações. Aguarde um minuto.' }, 429)

    const { data: history, error: historyError } = await userClient.from('messages').select('id, role, content, created_at').eq('conversation_id', body.conversationId).order('created_at', { ascending: false }).limit(lunaMax ? LUNAMAX_HISTORY_LIMIT : HISTORY_LIMIT)
    if (historyError) throw historyError
    if (!history?.length || history[0].role !== 'user') return jsonResponse({ error: 'A conversa precisa terminar com uma mensagem do usuário' }, 400)

    const { data: ongoing, error: ongoingError } = await admin.from('chat_generations').select('id').eq('user_message_id', history[0].id).eq('user_id', user.id).eq('status', 'generating').maybeSingle()
    if (ongoingError) throw ongoingError
    if (ongoing) return jsonResponse({ error: 'A Lunatica já está respondendo esta mensagem.', code: 'GENERATION_IN_PROGRESS' }, 409)

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
    if (!lunaMax && ((messageCount ?? 0) > limits.messages! || (conversationAttachmentCount ?? 0) > limits.conversationAttachments!)) {
      return jsonResponse({
        error: 'Esta conversa atingiu o limite de contexto. Comece um novo chat limpo para continuar.',
        code: 'NEW_CHAT_REQUIRED',
      }, 409)
    }

    const cost = 1 + attachments.length
    const usage = await usageStatus(admin, user.id, lunaMax)
    if (!lunaMax && usage.remaining !== null && usage.remaining < cost) return jsonResponse({ error: `Limite diário insuficiente. Esta mensagem custa ${cost} crédito${cost === 1 ? '' : 's'}.` }, 429)

    const { error: rateError } = await admin.from('rate_limits').insert({ user_id: user.id })
    if (rateError) throw rateError

    const [profileResult, memoryResult, files] = await Promise.all([
      admin.from('profiles').select('custom_instructions').eq('id', user.id).single(),
      conversation.is_temporary
        ? Promise.resolve({ data: [] as Array<{ summary: string }>, error: null })
        : userClient.from('memories').select('summary').order('updated_at', { ascending: false }).limit(20),
      downloadAttachments(admin, attachments),
    ])
    const { data: profile, error: profileError } = profileResult
    if (profileError) throw profileError
    if (memoryResult.error) throw memoryResult.error
    const memoryRows = memoryResult.data ?? []
    const messages = [...history].reverse().map(({ role, content }) => ({ role, content })) as HistoryMessage[]

    const { error: generationError } = await admin.from('chat_generations').insert({
      id: body.generationId,
      conversation_id: body.conversationId,
      user_id: user.id,
      user_message_id: history[0].id,
    })
    if (generationError) throw generationError

    let stream: ReadableStream<Uint8Array>
    try {
      stream = await streamResponse(messages, { customInstructions: profile.custom_instructions, attachments: files, memories: memoryRows.map((row) => row.summary), lunaMax })
    } catch (error) {
      await admin.from('chat_generations').update({ status: 'failed', error_code: error instanceof GeminiError && error.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_FAILED' }).eq('id', body.generationId).eq('user_id', user.id)
      throw error
    }

    const [clientStream, persistenceStream] = stream.tee()
    EdgeRuntime.waitUntil(persistGeneration({
      admin,
      generationId: body.generationId,
      conversationId: body.conversationId,
      userId: user.id,
      stream: persistenceStream,
      cost,
      attachmentCount: attachments.length,
      lunaMax,
    }))

    return new Response(clientStream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Generation-Id': body.generationId,
      },
    })
  } catch (error) {
    if (error instanceof GeminiError) return jsonResponse({ error: error.message }, error.status)
    console.error('Unexpected chat function error', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'Não foi possível gerar uma resposta. Tente novamente.' }, 500)
  }
})
