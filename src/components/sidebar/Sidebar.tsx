import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LogOut, Menu, MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Plus, Settings, Trash2, UserRound, X } from 'lucide-react'
import type { Conversation } from '../../types/database'
import { cn, formatRelativeDate } from '../../lib/utils'
import { Logo } from '../ui/Logo'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  loading: boolean
  mobileOpen: boolean
  userLabel: string
  username?: string | null
  avatarUrl?: string | null
  onMobileClose: () => void
  onNewChat: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => Promise<void>
  onTogglePin: (id: string, pinned: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onProfile: () => void
  onSettings: () => void
  onLogout: () => Promise<void>
}

export function Sidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!menuId) return
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as Element
      if (target.closest(`[data-conversation-menu="${menuId}"]`)) return
      setMenuId(null)
    }
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuId(null)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeWithKeyboard)
    }
  }, [menuId])

  function startRename(conversation: Conversation) {
    setMenuId(null)
    setRenamingId(conversation.id)
    setRenameValue(conversation.title)
  }

  async function saveRename() {
    if (!renamingId || !renameValue.trim()) return
    setBusy(true)
    try { await props.onRename(renamingId, renameValue); setRenamingId(null) } finally { setBusy(false) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try { await props.onDelete(deleteTarget.id); setDeleteTarget(null) } finally { setBusy(false) }
  }

  const visibleConversations = props.conversations.filter((conversation) => !conversation.is_temporary)
  const pinnedConversations = visibleConversations.filter((conversation) => conversation.is_pinned)
  const recentConversations = visibleConversations.filter((conversation) => !conversation.is_pinned)

  function renderConversation(conversation: Conversation) {
    return (
      <div key={conversation.id} className="relative mb-1" data-conversation-menu={conversation.id}>
        {renamingId === conversation.id && !collapsed ? (
          <form onSubmit={(event) => { event.preventDefault(); void saveRename() }} className="flex gap-1 p-1"><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus maxLength={80} className="min-w-0 flex-1 rounded-lg border bg-white px-2 py-2 text-sm outline-none focus:border-lunar-400 dark:bg-ink-800" /><button type="submit" className="icon-btn" disabled={busy} aria-label="Salvar título"><Pencil className="h-3.5 w-3.5" /></button></form>
        ) : (
          <button type="button" onClick={() => { props.onSelect(conversation.id); props.onMobileClose() }} className={cn('group flex w-full items-center rounded-xl text-left transition', collapsed ? 'h-11 justify-center' : 'gap-3 px-3 py-2.5 pr-10', props.activeId === conversation.id ? 'bg-zinc-200/80 text-zinc-950 dark:bg-white/[0.08] dark:text-white' : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-white/[0.05]')} title={conversation.title}>
            {conversation.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-lunar-500" /> : <MessageSquare className="h-4 w-4 shrink-0" />}
            {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{conversation.title}</span><span className="mt-0.5 block text-[10px] text-zinc-400">{formatRelativeDate(conversation.updated_at)}</span></span>}
          </button>
        )}
        {!collapsed && renamingId !== conversation.id && <button type="button" onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)} className="icon-btn absolute right-1 top-1.5 !h-8 !w-8 opacity-70 hover:opacity-100" aria-label={`Opções de ${conversation.title}`}><MoreHorizontal className="h-4 w-4" /></button>}
        {menuId === conversation.id && <div className="absolute right-2 top-10 z-20 w-40 rounded-xl border bg-white p-1.5 text-sm shadow-xl dark:bg-ink-800"><button type="button" onClick={() => { void props.onTogglePin(conversation.id, !conversation.is_pinned); setMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-zinc-100 dark:hover:bg-white/[0.07]">{conversation.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {conversation.is_pinned ? 'Desafixar' : 'Fixar'}</button><button type="button" onClick={() => startRename(conversation)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-zinc-100 dark:hover:bg-white/[0.07]"><Pencil className="h-3.5 w-3.5" /> Renomear</button><button type="button" onClick={() => { setDeleteTarget(conversation); setMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /> Excluir</button></div>}
      </div>
    )
  }

  const content = (
    <aside className={cn('main-sidebar transition-[width] duration-200', collapsed ? '!w-20' : 'w-[296px]')} onClick={(event) => { if (window.innerWidth < 1024 && !(event.target as Element).closest('button, a, input, textarea, form')) props.onMobileClose() }}>
      <div className={cn('flex h-20 items-center', collapsed ? 'justify-center px-3' : 'justify-between px-4')}>
        <Logo compact={collapsed} />
        {!collapsed && <button type="button" onClick={props.onMobileClose} className="icon-btn lg:hidden" aria-label="Fechar menu"><X className="h-5 w-5" /></button>}
      </div>

      <div className="px-3">
        <button type="button" onClick={() => { props.onNewChat(); props.onMobileClose() }} className={cn('new-chat-button', collapsed ? 'h-11 justify-center !px-0' : '')} aria-label="Novo chat">
          <Plus className="h-4 w-4" />{!collapsed && <span>Novo chat</span>}
        </button>
      </div>

      <nav className="mt-5 flex-1 overflow-y-auto px-2" aria-label="Conversas" onClick={(event) => { if (event.target === event.currentTarget) props.onMobileClose() }}>
        {props.loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className={cn('mb-1 animate-pulse rounded-lg bg-zinc-200 dark:bg-white/[0.05]', collapsed ? 'mx-auto h-10 w-10' : 'h-12')} />) : visibleConversations.length === 0 ? !collapsed && <p className="px-3 py-6 text-center text-xs leading-5 text-zinc-400">Suas conversas aparecerão aqui.</p> : <>
          {pinnedConversations.length > 0 && !collapsed && <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-lunar-500">Fixadas</p>}
          {pinnedConversations.map(renderConversation)}
          {recentConversations.length > 0 && !collapsed && <p className={`${pinnedConversations.length ? 'mt-5' : ''} mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-400`}>Recentes</p>}
          {recentConversations.map(renderConversation)}
        </>}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button type="button" onClick={() => { props.onProfile(); props.onMobileClose() }} className={cn('flex w-full items-center rounded-xl text-left transition hover:bg-zinc-200/70 dark:hover:bg-white/[0.06]', collapsed ? 'h-11 justify-center' : 'gap-3 px-2 py-2')} aria-label="Abrir perfil">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lunar-500/15 text-xs font-semibold text-lunar-300">{props.avatarUrl ? <img src={props.avatarUrl} alt="" className="h-full w-full object-cover" /> : props.userLabel.slice(0, 1).toUpperCase()}</div>
          {!collapsed && <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{props.userLabel}</strong>{props.username && <small className="block truncate text-[10px] text-zinc-500">@{props.username}</small>}</span>}
          {!collapsed && <UserRound className="h-4 w-4 text-zinc-400" />}
        </button>
        <button type="button" onClick={() => { props.onSettings(); props.onMobileClose() }} className={cn('mt-1 flex w-full items-center rounded-xl text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white', collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2 text-xs')} aria-label="Configurações"><Settings className="h-4 w-4" />{!collapsed && 'Configurações'}</button>
        <button type="button" onClick={() => void props.onLogout()} className={cn('mt-1 flex w-full items-center rounded-xl text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white', collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2 text-xs')} aria-label="Sair"><LogOut className="h-4 w-4" />{!collapsed && 'Sair'}</button>
      </div>

      <button type="button" onClick={() => setCollapsed((value) => !value)} className="icon-btn absolute bottom-24 -right-4 z-10 hidden rounded-full border bg-white shadow-sm dark:bg-ink-800 lg:inline-flex" aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
    </aside>
  )

  return (
    <>
      <div className="relative hidden h-full lg:block">{content}</div>
      {props.mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={props.onMobileClose} aria-label="Fechar menu" /><div className="relative h-full w-[min(88vw,320px)] animate-slide-in [&_.main-sidebar]:!w-full">{content}</div></div>}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Excluir conversa?" description="Essa ação não poderá ser desfeita." busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="icon-btn lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
}
