export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function createConversationTitle(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= 48) return compact || 'Nova conversa'
  return `${compact.slice(0, 47).trimEnd()}…`
}

export function formatRelativeDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export async function copyText(content: string) {
  await navigator.clipboard.writeText(content)
}

export function friendlyError(error: unknown) {
  if (!navigator.onLine) return 'Você está offline. Verifique sua conexão.'
  if (error instanceof DOMException && error.name === 'AbortError') return 'Geração interrompida.'
  if (error instanceof Error) {
    if (/401|jwt|session|auth/i.test(error.message)) return 'Sua sessão expirou. Entre novamente.'
    if (/429|rate limit/i.test(error.message)) return 'Muitas solicitações. Aguarde um pouco e tente novamente.'
    if (/timeout/i.test(error.message)) return 'A resposta demorou demais. Tente novamente.'
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}
