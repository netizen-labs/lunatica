import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, Coins, Lightbulb, Orbit, PenLine, Search, Sparkles, WifiOff } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageBubble } from '../components/chat/MessageBubble'
import { MessageComposer } from '../components/chat/MessageComposer'
import { MemoryDialog } from '../components/memory/MemoryDialog'
import { ProfileDialog } from '../components/profile/ProfileDialog'
import { MobileMenuButton, Sidebar } from '../components/sidebar/Sidebar'
import { SettingsDialog } from '../components/settings/SettingsDialog'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import { useToast } from '../contexts/ToastContext'
import { useChat } from '../hooks/useChat'
import { useMemories } from '../hooks/useMemories'
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
  const [profileOpen, setProfileOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const bottomRef = useRef<HTMLDivElement>(null)

  if (!user || !session) throw new Error('ChatPage requer uma sessão autenticada')
  const memory = useMemories(session)
  const chat = useChat({ user, session, onNotify: showToast, onAnalyzeMemory: memory.analyzeMessage })
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
        onProfile={() => setProfileOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onLogout={signOut}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="mission-header">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <div className="min-w-0 flex-1"><span className="micro-label hidden sm:block">SESSÃO ATIVA</span><h1 className="truncate text-sm font-medium text-zinc-200">{activeConversation?.title || 'Nova conversa'}</h1></div>
          <button type="button" className="status-pill flex" onClick={() => { memory.clearNotice(); setMemoryOpen(true) }} aria-label={`Abrir memórias, ${memory.memories.length} salvas`}><Brain className="h-3.5 w-3.5" /><span className="hidden sm:inline">Memórias</span>{memory.memories.length > 0 && <strong className="text-lunar-300">{memory.memories.length}</strong>}</button>
          {chat.usage && <span className="status-pill hidden sm:flex"><Coins className="h-3.5 w-3.5" /> {chat.usage.remaining} créditos</span>}
          {!online && <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-300"><WifiOff className="h-3.5 w-3.5" /> Offline</span>}
        </header>

        {memory.notice && <button type="button" className="memory-saved-banner" onClick={() => { memory.clearNotice(); setMemoryOpen(true) }}><span className="memory-pulse"><Brain className="h-3.5 w-3.5" /></span><span><strong>{memory.notice}</strong><small>Toque para ver o que a Lunatica aprendeu</small></span></button>}

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {chat.loadingMessages ? (
            <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">{Array.from({ length: 3 }).map((_, index) => <div key={index} className={`h-20 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-white/[0.04] ${index % 2 === 0 ? 'ml-auto w-2/3' : 'w-full'}`} />)}</div>
          ) : chat.messages.length === 0 ? (
            <section className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-5 py-12 text-center">
              <div className="empty-orbit" aria-hidden="true"><span /></div>
              <div className="relative"><span className="micro-label inline-flex items-center gap-2"><Orbit className="h-3.5 w-3.5" /> LUNATICA 1.5</span><h2 className="mt-5 text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Como posso ajudar?</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">Escolha um ponto de partida ou envie sua própria ideia. A órbita começa por você.</p></div>
              <div className="relative mt-10 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">{suggestions.map(({ label, prompt, icon: Icon }, index) => <button key={label} type="button" onClick={() => void send(prompt)} className="suggestion-square"><span className="text-[9px] tracking-[.16em] text-zinc-600">0{index + 1}</span><Icon className="h-5 w-5 text-lunar-300" /><strong>{label}</strong></button>)}</div>
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

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SettingsDialog open={settingsOpen} remainingCredits={chat.usage?.remaining} onClose={() => setSettingsOpen(false)} onClearHistory={async () => { await chat.clearHistory(); navigate('/') }} />
      <MemoryDialog open={memoryOpen} memories={memory.memories} loading={memory.loading} onClose={() => { memory.clearNotice(); setMemoryOpen(false) }} onAdd={memory.addMemory} onDelete={memory.deleteMemory} />
    </div>
  )
}
