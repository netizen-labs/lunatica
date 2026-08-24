import { useEffect, useState } from 'react'
import { ArrowRight, Code2, History, Lightbulb, LogIn, Menu, Search, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MessageComposer } from '../components/chat/MessageComposer'
import { Logo } from '../components/ui/Logo'
import { Modal } from '../components/ui/Modal'

const suggestions = [
  { label: 'Escrever código', prompt: 'Crie uma API TypeScript segura e explique as principais decisões de arquitetura.', icon: Code2 },
  { label: 'Explicar um assunto', prompt: 'Explique um assunto complexo de forma simples, com exemplos e uma analogia útil.', icon: Lightbulb },
  { label: 'Criar ideias', prompt: 'Vamos desenvolver ideias originais para um projeto digital útil e divertido.', icon: Sparkles },
  { label: 'Analisar um problema', prompt: 'Ajude a analisar um problema por diferentes perspectivas e montar um plano de ação.', icon: Search },
]

export function GuestPage() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const openLogin = () => navigate('/login?mode=login')
  const openSignup = () => navigate('/login?mode=signup')

  async function requestConversation() {
    setAuthPromptOpen(true)
  }

  const sidebar = (
    <aside className="flex h-full w-[286px] flex-col border-r bg-zinc-100/80 dark:bg-ink-900">
      <div className="flex h-20 items-center justify-between px-4">
        <Logo />
        <button type="button" onClick={() => setMobileOpen(false)} className="icon-btn lg:hidden" aria-label="Fechar menu"><X className="h-5 w-5" /></button>
      </div>
      <div className="px-3">
        <button type="button" onClick={() => setAuthPromptOpen(true)} className="flex w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-sm font-medium shadow-sm transition hover:border-lunar-400/60 dark:bg-white/[0.04]"><Sparkles className="h-4 w-4 text-lunar-400" /> Começar conversa</button>
      </div>
      <div className="flex-1 px-4 py-7">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-400">Sua experiência</p>
        <div className="mt-4 space-y-4 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex gap-3"><History className="mt-0.5 h-4 w-4 shrink-0 text-lunar-400" /><p><strong className="block font-medium text-zinc-700 dark:text-zinc-200">Histórico sincronizado</strong>Continue suas conversas de qualquer lugar.</p></div>
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lunar-400" /><p><strong className="block font-medium text-zinc-700 dark:text-zinc-200">Conversas privadas</strong>Seus dados ficam vinculados à sua conta.</p></div>
        </div>
      </div>
      <div className="border-t p-3">
        <p className="mb-3 px-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Entre para conversar com a Lunatica e salvar seu histórico.</p>
        <button type="button" onClick={openLogin} className="btn-secondary w-full"><LogIn className="h-4 w-4" /> Entrar</button>
        <button type="button" onClick={openSignup} className="btn-primary mt-2 w-full"><UserPlus className="h-4 w-4" /> Criar conta</button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-50 dark:bg-ink-950">
      <div className="hidden h-full lg:block">{sidebar}</div>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" /><div className="relative h-full animate-slide-in">{sidebar}</div></div>}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-zinc-50/90 px-4 backdrop-blur-md dark:bg-ink-950/90 sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="icon-btn lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <Logo compact className="lg:hidden" />
          <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex"><span className="text-sm font-medium">Lunatica 1.5</span><span className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:bg-white/[0.04] dark:text-lunar-300">Modelo de IA</span></div>
          <div className="ml-auto flex items-center gap-2"><button type="button" onClick={openLogin} className="hidden px-3 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white sm:inline-flex">Entrar</button><button type="button" onClick={openSignup} className="btn-primary !px-3.5 !py-2">Criar conta <ArrowRight className="h-4 w-4" /></button></div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-10 text-center sm:py-14">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border bg-white shadow-sm dark:bg-white/[0.04]"><span className="text-xl font-semibold text-violet-600 dark:text-lunar-300">L</span></div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-zinc-500 shadow-sm dark:bg-white/[0.03] dark:text-zinc-300"><Sparkles className="h-3.5 w-3.5 text-lunar-400" /> Conheça o modelo Lunatica 1.5</div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-.045em] sm:text-5xl">Como posso ajudar?</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">Uma IA colaborativa, divertida e especialmente preparada para programação sênior, textos bem formados e ideias que saem do papel.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={openLogin} className="btn-secondary"><LogIn className="h-4 w-4" /> Já tenho conta</button><button type="button" onClick={openSignup} className="btn-primary"><UserPlus className="h-4 w-4" /> Criar conta grátis</button></div>
            <div className="mt-9 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">{suggestions.map(({ label, prompt, icon: Icon }) => <button key={label} type="button" onClick={() => setDraft(prompt)} className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:border-lunar-400/60 hover:shadow-sm dark:bg-white/[0.025]"><Icon className="h-4 w-4 text-lunar-400" />{label}</button>)}</div>
          </section>
        </div>

        <div className="shrink-0 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent pt-2 dark:from-ink-950 dark:via-ink-950">
          <div className="mx-auto mb-2 flex max-w-3xl items-center justify-center gap-2 px-4 text-center text-xs text-zinc-500 dark:text-zinc-400"><LogIn className="h-3.5 w-3.5" /> Entre ou crie uma conta para enviar mensagens.</div>
          <MessageComposer generating={false} disabled={!online} value={draft} clearOnSend={false} onValueChange={setDraft} onSend={requestConversation} onStop={() => undefined} />
        </div>
      </main>

      <Modal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} title="Pronto para conversar?" description="Entre ou crie uma conta para enviar mensagens, salvar o histórico e continuar depois.">
        <div className="space-y-3"><button type="button" onClick={openSignup} className="btn-primary w-full"><UserPlus className="h-4 w-4" /> Criar conta</button><button type="button" onClick={openLogin} className="btn-secondary w-full"><LogIn className="h-4 w-4" /> Entrar na minha conta</button></div>
      </Modal>
    </div>
  )
}
