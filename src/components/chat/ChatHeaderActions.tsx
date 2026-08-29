import { useEffect, useRef, useState } from 'react'
import { Check, Clock3, MoreHorizontal, Pencil, Pin, PinOff, SquarePen, Trash2, X } from 'lucide-react'
import type { Conversation } from '../../types/database'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface ChatHeaderActionsProps {
  conversation?: Conversation
  temporaryMode: boolean
  onNewChat: () => void
  onToggleTemporary: () => void
  onTogglePin: (id: string, pinned: boolean) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ChatHeaderActions({ conversation, temporaryMode, onNewChat, onToggleTemporary, onTogglePin, onRename, onDelete }: ChatHeaderActionsProps) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  async function saveRename() {
    if (!conversation || !renameValue.trim()) return
    setBusy(true)
    try {
      await onRename(conversation.id, renameValue)
      setRenaming(false)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function togglePin() {
    if (!conversation) return
    setBusy(true)
    try {
      await onTogglePin(conversation.id, !conversation.is_pinned)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!conversation) return
    setBusy(true)
    try {
      await onDelete(conversation.id)
      setConfirmDelete(false)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div ref={rootRef} className="chat-actions-tab">
        <button type="button" onClick={onNewChat} className="chat-actions-button" aria-label="Novo chat" title="Novo chat"><SquarePen className="h-[18px] w-[18px]" /></button>
        <span className="chat-actions-divider" />
        <button type="button" onClick={() => { setOpen((value) => !value); setRenaming(false) }} className="chat-actions-button" aria-label="Mais opções do chat" aria-expanded={open} title="Mais opções"><MoreHorizontal className="h-5 w-5" /></button>

        {open && <div className="chat-actions-menu" role="menu">
          {!conversation && <button type="button" className={`chat-action-row ${temporaryMode ? 'active' : ''}`} onClick={() => { onToggleTemporary(); setOpen(false) }} role="menuitem"><Clock3 className="h-4 w-4" /><span><strong>{temporaryMode ? 'Desativar temporário' : 'Chat temporário'}</strong><small>{temporaryMode ? 'O próximo chat será salvo normalmente.' : 'Sem histórico e memória; expira em 24 horas.'}</small></span>{temporaryMode && <Check className="ml-auto h-4 w-4" />}</button>}

          {conversation?.is_temporary && <><div className="temporary-menu-note"><Clock3 className="h-4 w-4" /><span><strong>Chat temporário</strong><small>Oculto do histórico e apagado em até 24 horas.</small></span></div><button type="button" className="chat-action-row danger" onClick={() => setConfirmDelete(true)} role="menuitem"><Trash2 className="h-4 w-4" /><span><strong>Encerrar e apagar</strong><small>Remove esta conversa agora.</small></span></button></>}

          {conversation && !conversation.is_temporary && (renaming ? <form onSubmit={(event) => { event.preventDefault(); void saveRename() }} className="header-rename-form"><label htmlFor="header-chat-title" className="sr-only">Novo título</label><input id="header-chat-title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={80} autoFocus /><button type="submit" disabled={busy || !renameValue.trim()} aria-label="Salvar título"><Check className="h-4 w-4" /></button><button type="button" onClick={() => setRenaming(false)} aria-label="Cancelar"><X className="h-4 w-4" /></button></form> : <>
            <button type="button" className="chat-action-row" onClick={() => void togglePin()} disabled={busy} role="menuitem">{conversation.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}<span><strong>{conversation.is_pinned ? 'Desafixar conversa' : 'Fixar conversa'}</strong><small>{conversation.is_pinned ? 'Volta para a ordem por data.' : 'Mantém no topo do menu.'}</small></span></button>
            <button type="button" className="chat-action-row" onClick={() => { setRenameValue(conversation.title); setRenaming(true) }} role="menuitem"><Pencil className="h-4 w-4" /><span><strong>Renomear</strong><small>O nome continua visível no menu.</small></span></button>
            <button type="button" className="chat-action-row danger" onClick={() => setConfirmDelete(true)} role="menuitem"><Trash2 className="h-4 w-4" /><span><strong>Excluir conversa</strong><small>Esta ação não pode ser desfeita.</small></span></button>
          </>)}
        </div>}
      </div>

      <ConfirmDialog open={confirmDelete} title={conversation?.is_temporary ? 'Encerrar chat temporário?' : 'Excluir conversa?'} description={conversation?.is_temporary ? 'As mensagens e anexos temporários serão apagados agora.' : 'Essa ação não poderá ser desfeita.'} busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
    </>
  )
}
