import { useEffect, useState } from 'react'
import { ArrowRight, Code2, Compass, History, Lightbulb, LogIn, Menu, Orbit, Search, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MessageComposer } from '../components/chat/MessageComposer'
import { Logo } from '../components/ui/Logo'
import { Modal } from '../components/ui/Modal'

const suggestions = [
  { label: 'Construir com código', prompt: 'Crie uma API TypeScript segura e explique as principais decisões de arquitetura.', icon: Code2 },
  { label: 'Entender de verdade', prompt: 'Explique um assunto complexo de forma simples, com exemplos e uma analogia útil.', icon: Lightbulb },
  { label: 'Explorar possibilidades', prompt: 'Vamos desenvolver ideias originais para um projeto digital útil e divertido.', icon: Sparkles },
  { label: 'Investigar um problema', prompt: 'Ajude a analisar um problema por diferentes perspectivas e montar um plano de ação.', icon: Search },
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
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  const openLogin = () => navigate('/login?mode=login')
  const openSignup = () => navigate('/login?mode=signup')
  async function requestConversation() { setAuthPromptOpen(true) }

  const sidebar = (
    <aside className="guest-sidebar">
      <div className="flex h-20 items-center justify-between px-5"><Logo /><button type="button" onClick={() => setMobileOpen(false)} className="icon-btn lg:hidden" aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
      <div className="px-4"><button type="button" onClick={() => setAuthPromptOpen(true)} className="new-chat-button"><Sparkles className="h-4 w-4" /> Abrir um novo sinal <ArrowRight className="ml-auto h-4 w-4" /></button></div>
      <div className="flex-1 px-5 py-8"><span className="micro-label">MEMÓRIA DA MISSÃO</span><div className="mt-5 space-y-5"><div className="sidebar-feature"><History /><p><strong>Histórico contínuo</strong><span>Retome ideias exatamente de onde parou.</span></p></div><div className="sidebar-feature"><ShieldCheck /><p><strong>Espaço privado</strong><span>RLS protege cada conversa no banco.</span></p></div><div className="sidebar-feature"><Compass /><p><strong>Do seu jeito</strong><span>Perfil, tema e instruções pessoais.</span></p></div></div></div>
      <div className="border-t border-white/10 p-4"><p className="mb-4 text-xs leading-5 text-zinc-500">Crie sua conta para conversar, anexar arquivos e salvar seu histórico.</p><button type="button" onClick={openLogin} className="btn-secondary w-full"><LogIn className="h-4 w-4" /> Entrar</button><button type="button" onClick={openSignup} className="btn-primary mt-2 w-full"><UserPlus className="h-4 w-4" /> Criar conta grátis</button></div>
    </aside>
  )

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <div className="hidden h-full lg:block">{sidebar}</div>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" /><div className="relative h-full animate-slide-in">{sidebar}</div></div>}

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="lunar-orbit lunar-orbit-a" aria-hidden="true" />
        <header className="mission-header relative z-10"><button type="button" onClick={() => setMobileOpen(true)} className="icon-btn lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><Logo compact className="lg:hidden" /><div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex"><span className="micro-label">MODELO LUNATICA 1.5</span><span className="status-dot">online</span></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={openLogin} className="hidden px-3 py-2 text-sm text-zinc-400 hover:text-white sm:inline-flex">Entrar</button><button type="button" onClick={openSignup} className="btn-primary !px-3.5 !py-2">Criar conta <ArrowRight className="h-4 w-4" /></button></div></header>

        <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto">
          <section className="mx-auto grid min-h-full max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.08fr_.92fr] lg:px-10">
            <div className="animate-fade-in"><span className="micro-label flex items-center gap-2"><Orbit className="h-3.5 w-3.5" /> UM SINAL PARA IDEIAS FORA DA ÓRBITA</span><h1 className="mt-6 text-5xl font-semibold leading-[.98] tracking-[-.065em] sm:text-7xl xl:text-[84px]">Pense longe.<br /><span className="text-lunar-300">Construa perto.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-zinc-400">Lunatica 1.5 é uma IA colaborativa, divertida e afiada para programação sênior, textos bem formados e problemas que pedem outra perspectiva.</p><div className="mt-7 flex flex-wrap gap-2"><button type="button" onClick={openSignup} className="btn-primary"><Sparkles className="h-4 w-4" /> Começar agora</button><button type="button" onClick={openLogin} className="btn-secondary"><LogIn className="h-4 w-4" /> Continuar missão</button></div>
              <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">{suggestions.map(({ label, prompt, icon: Icon }, index) => <button key={label} type="button" onClick={() => setDraft(prompt)} className="guest-suggestion"><span>0{index + 1}</span><Icon className="h-4 w-4" /><strong>{label}</strong></button>)}</div>
            </div>

            <div className="relative hidden lg:block"><div className="model-card"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div><span className="micro-label">TRANSMISSÃO ATIVA</span><h2 className="mt-1 text-sm font-medium">Lunatica 1.5</h2></div><span className="status-dot">respondendo</span></div><div className="mt-6 flex justify-end"><div className="preview-user">Como podemos deixar uma ideia comum memorável?</div></div><div className="mt-7 flex gap-3"><div className="assistant-mark">L</div><div className="min-w-0 flex-1"><p className="text-sm leading-7 text-zinc-300">Comece removendo o que é esperado. Depois escolha uma tensão clara: familiar, mas com um detalhe que cause curiosidade.</p><div className="mt-4 grid grid-cols-3 gap-2"><div className="signal-stat"><strong>01</strong><span>clareza</span></div><div className="signal-stat"><strong>02</strong><span>contraste</span></div><div className="signal-stat"><strong>03</strong><span>ritmo</span></div></div></div></div><div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-4 text-[10px] uppercase tracking-[.16em] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-lunar-400" /> Resposta progressiva · Markdown · Código</div></div><div className="absolute -bottom-5 -left-5 rounded-2xl border border-white/10 bg-[#0b0a0e] px-4 py-3 shadow-xl"><strong className="block text-xs text-white">Privada por padrão</strong><span className="text-[10px] text-zinc-500">Auth + RLS + Storage privado</span></div></div>
          </section>
        </div>

        <div className="composer-dock relative z-10"><div className="mx-auto mb-2 flex max-w-4xl items-center justify-center gap-2 px-4 text-center text-xs text-zinc-500"><LogIn className="h-3.5 w-3.5" /> Entre ou crie uma conta para enviar.</div><MessageComposer generating={false} disabled={!online} value={draft} clearOnSend={false} onValueChange={setDraft} onSend={requestConversation} onStop={() => undefined} /></div>
      </main>

      <Modal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} title="Seu sinal está pronto" description="Entre ou crie uma conta para enviar a mensagem, anexar arquivos e continuar depois."><div className="space-y-3"><button type="button" onClick={openSignup} className="btn-primary w-full"><UserPlus className="h-4 w-4" /> Criar conta grátis</button><button type="button" onClick={openLogin} className="btn-secondary w-full"><LogIn className="h-4 w-4" /> Entrar na minha conta</button></div></Modal>
    </div>
  )
}
