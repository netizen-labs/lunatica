import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.112.4'
import { corsHeaders } from '../_shared/cors.ts'

interface Clients { admin: SupabaseClient; user: User }

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function authenticate(request: Request): Promise<Clients | Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !serviceKey) return json({ error: 'Serviço não configurado' }, 500)
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Autenticação necessária' }, 401)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(authorization.slice(7))
  if (error || !data.user) return json({ error: 'Sessão inválida ou expirada' }, 401)
  return { admin, user: data.user }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const clients = await authenticate(request)
    if (clients instanceof Response) return clients
    const { admin, user } = clients
    if (!user.email_confirmed_at) return json({ error: 'Confirme seu email antes de ativar o LunaMax.', code: 'EMAIL_NOT_VERIFIED' }, 403)

    const body = await request.json().catch(() => null) as { code?: unknown; acceptedDisclaimer?: unknown } | null
    if (!body || body.acceptedDisclaimer !== true) return json({ error: 'Você precisa aceitar o aviso sobre possíveis erros da IA.', code: 'DISCLAIMER_REQUIRED' }, 400)
    if (typeof body.code !== 'string') return json({ error: 'Digite uma chave válida de 16 caracteres.', code: 'INVALID_CODE' }, 400)
    const normalized = body.code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!/^[A-Z0-9]{16}$/.test(normalized)) return json({ error: 'A chave deve conter exatamente 16 letras ou números.', code: 'INVALID_CODE' }, 400)

    const { data, error } = await admin.rpc('redeem_lunamax_code', {
      p_user_id: user.id,
      p_code_hash: await sha256(normalized),
    })
    if (error) {
      const alreadyUsed = error.message.includes('code_already_used')
      return json({
        error: alreadyUsed ? 'Esta chave já foi usada nesta conta.' : 'Chave inválida, expirada ou já utilizada.',
        code: alreadyUsed ? 'CODE_ALREADY_USED' : 'INVALID_CODE',
      }, 400)
    }
    const plan = Array.isArray(data) ? data[0] : data
    if (!plan) throw new Error('Plano não retornado após o resgate')
    return json(plan)
  } catch (error) {
    console.error('Plan redemption error', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Não foi possível ativar o LunaMax. Tente novamente.' }, 500)
  }
})
