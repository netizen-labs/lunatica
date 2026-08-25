import { useCallback, useEffect, useRef, useState } from 'react'
import { Coins, Lightbulb, Orbit, PenLine, Search, Sparkles, WifiOff } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageBubble } from '../components/chat/MessageBubble'
import { MessageComposer } from '../components/chat/MessageComposer'
import { MobileMenuButton, Sidebar } from '../components/sidebar/Sidebar'
import { SettingsDialog } from '../components/settings/SettingsDialog'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import { useToast } from '../contexts/ToastContext'
import { useChat } from '../hooks/useChat'
import { friendlyError } from '../lib/utils'

const suggestions = [
  { label: 'Escrever código', prompt: 'Mostre um exemplo de função TypeScript bem tipada e explique as decisões importantes.', icon: PenLine },
  { label: 'Explicar um assunto', prompt: 'Explique de forma clara e com exemplos como os modelos de linguagem funcionam.', icon: Lightbulb },
  { label: 'Criar ideias', prompt: 'Crie cinco ideias originais para um projeto digital simples e útil.', icon: Sparkles },
  { label: 'Analisar um problema', prompt: 'Ensine um método prático para analisar problemas complexos passo a passo.', icon: Search },
]

export function ChatPage() {
  const { user, session, signOut } = useAuth()
  const { profile, avatarUrl } = useProfile()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const bottomRef = useRef<HTMLDivElement>(null)

  if (!user || !session) throw new Error('ChatPage requer uma sessão autenticada')
  const chat = useChat({ user, session, onNotify: showToast })
  const openConversation = chat.openConversation

  useEffect(() => { void openConversation(conversationId ?? null) }, [conversationId, openConversation])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: chat.generating ? 'auto' : 'smooth' }) }, [chat.generating, chat.messages])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  const selectConversation = useCallback((id: string) => navigate(`/chat/${id}`), [navigate])
  const newChat = useCallback(() => navigate('/'), [navigate])

  async function send(content: string, files: File[] = []) {
    const id = await chat.sendMessage(content, files)
    if (id && id !== conversationId) navigate(`/chat/${id}`, { replace: true })
  }

  async function removeConversation(id: string) {
    try {
      await chat.deleteConversation(id)
      if (id === conversationId) navigate('/')
    } catch (error) {
      showToast(friendlyError(error), 'error')
      if (import.meta.env.DEV) console.error(error)
    }
  }

  const activeConversation = chat.conversations.find((conversation) => conversation.id === chat.activeId)
  const lastAssistantId = [...chat.messages].reverse().find((message) => message.role === 'assistant' && !message.id.startsWith('stream-'))?.id
  const userLabel = profile?.display_name || user.user_metadata.display_name as string | undefined || user.email?.split('@')[0] || 'Conta'

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeId}
        loading={chat.loadingConversations}
        mobileOpen={mobileOpen}
        userLabel={userLabel}
        username={profile?.username}
        avatarUrl={avatarUrl}
        remainingCredits={chat.usage?.remaining}
        onMobileClose={() => setMobileOpen(false)}
        onNewChat={newChat}
        onSelect={selectConversation}
        onRename={chat.renameConversation}
        onDelete={removeConversation}
        onSettings={() => setSettingsOpen(true)}
        onLogout={signOut}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="mission-header">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <div className="min-w-0 flex-1"><span className="micro-label hidden sm:block">SESSÃO ATIVA</span><h1 className="truncate text-sm font-medium text-zinc-200">{activeConversation?.title || 'Nova conversa'}</h1></div>
          {chat.usage && <span className="status-pill hidden sm:flex"><Coins className="h-3.5 w-3.5" /> {chat.usage.remaining} créditos</span>}
          {!online && <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-300"><WifiOff className="h-3.5 w-3.5" /> Offline</span>}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {chat.loadingMessages ? (
            <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">{Array.from({ length: 3 }).map((_, index) => <div key={index} className={`h-20 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-white/[0.04] ${index % 2 === 0 ? 'ml-auto w-2/3' : 'w-full'}`} />)}</div>
          ) : chat.messages.length === 0 ? (
            <section className="relative mx-auto flex min-h-full max-w-4xl flex-col justify-center px-5 py-12">
              <div className="absolute right-4 top-12 hidden h-44 w-44 rounded-full border border-lunar-400/10 sm:block" aria-hidden="true"><span className="absolute left-7 top-9 h-1.5 w-1.5 rounded-full bg-lunar-300" /></div>
              <div className="relative max-w-2xl"><span className="micro-label flex items-center gap-2"><Orbit className="h-3.5 w-3.5" /> CANAL LUNATICA 1.5</span><h2 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-6xl">O que vamos<br /><span className="text-lunar-300">desvendar hoje?</span></h2><p className="mt-5 max-w-lg text-sm leading-6 text-[var(--muted)]">Programação sênior, textos bem formados, análises ou uma ideia completamente fora da órbita.</p></div>
              <div className="relative mt-10 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">{suggestions.map(({ label, prompt, icon: Icon }, index) => <button key={label} type="button" onClick={() => void send(prompt)} className="suggestion-card"><span className="text-[10px] text-zinc-600">0{index + 1}</span><Icon className="h-4 w-4 text-lunar-300" /><span>{label}</span></button>)}</div>
            </section>
          ) : (
            <div className="space-y-8 py-8 sm:space-y-10 sm:py-10">
              {chat.messages.map((message) => <MessageBubble key={message.id} message={message} generating={chat.generating} canRegenerate={message.id === lastAssistantId} onRegenerate={chat.regenerateMessage} onEdit={chat.editUserMessage} />)}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-dock">
          <MessageComposer generating={chat.generating} disabled={!online || chat.usage?.remaining === 0} allowAttachments remainingCredits={chat.usage?.remaining} onSend={send} onStop={chat.stopGeneration} />
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onClearHistory={async () => { await chat.clearHistory(); navigate('/') }} />
    </div>
  )
}
