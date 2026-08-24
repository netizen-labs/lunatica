import { useCallback, useEffect, useRef, useState } from 'react'
import { Lightbulb, PenLine, Search, Sparkles, WifiOff } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageBubble } from '../components/chat/MessageBubble'
import { MessageComposer } from '../components/chat/MessageComposer'
import { MobileMenuButton, Sidebar } from '../components/sidebar/Sidebar'
import { SettingsDialog } from '../components/settings/SettingsDialog'
import { useAuth } from '../contexts/AuthContext'
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

  async function send(content: string) {
    const id = await chat.sendMessage(content)
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
  const userLabel = user.user_metadata.display_name as string | undefined || user.email?.split('@')[0] || 'Conta'

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-50 dark:bg-ink-950">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeId}
        loading={chat.loadingConversations}
        mobileOpen={mobileOpen}
        userLabel={userLabel}
        onMobileClose={() => setMobileOpen(false)}
        onNewChat={newChat}
        onSelect={selectConversation}
        onRename={chat.renameConversation}
        onDelete={removeConversation}
        onSettings={() => setSettingsOpen(true)}
        onLogout={signOut}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-zinc-50/90 px-4 backdrop-blur-md dark:bg-ink-950/90 sm:px-6">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-600 dark:text-zinc-300">{activeConversation?.title || 'Nova conversa'}</h1>
          {!online && <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-300"><WifiOff className="h-3.5 w-3.5" /> Offline</span>}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {chat.loadingMessages ? (
            <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">{Array.from({ length: 3 }).map((_, index) => <div key={index} className={`h-20 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-white/[0.04] ${index % 2 === 0 ? 'ml-auto w-2/3' : 'w-full'}`} />)}</div>
          ) : chat.messages.length === 0 ? (
            <section className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border bg-white shadow-sm dark:bg-white/[0.04]"><span className="text-xl font-semibold text-violet-600 dark:text-lunar-300">L</span></div>
              <h2 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Como posso ajudar?</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">Converse, explore ideias e transforme perguntas em próximos passos.</p>
              <div className="mt-9 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">{suggestions.map(({ label, prompt, icon: Icon }) => <button key={label} type="button" onClick={() => void send(prompt)} className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:border-lunar-400/60 hover:shadow-sm dark:bg-white/[0.025]"><Icon className="h-4 w-4 text-lunar-400" />{label}</button>)}</div>
            </section>
          ) : (
            <div className="space-y-8 py-8 sm:space-y-10 sm:py-10">
              {chat.messages.map((message) => <MessageBubble key={message.id} message={message} generating={chat.generating} canRegenerate={message.id === lastAssistantId} onRegenerate={chat.regenerateMessage} onEdit={chat.editUserMessage} />)}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent pt-2 dark:from-ink-950 dark:via-ink-950">
          <MessageComposer generating={chat.generating} disabled={!online} onSend={send} onStop={chat.stopGeneration} />
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onClearHistory={async () => { await chat.clearHistory(); navigate('/') }} />
    </div>
  )
}
