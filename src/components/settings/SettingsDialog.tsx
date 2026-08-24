import { useEffect, useState } from 'react'
import { LogOut, Moon, Monitor, Sun, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme, type Theme } from '../../contexts/ThemeContext'
import { useToast } from '../../contexts/ToastContext'
import { friendlyError } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  onClearHistory: () => Promise<void>
}

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Moon }> = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

export function SettingsDialog({ open, onClose, onClearHistory }: SettingsDialogProps) {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!open || !user) return
    void supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data }) => setName(data?.display_name || user.email?.split('@')[0] || ''))
  }, [open, user])

  async function save() {
    if (!user || !name.trim()) return
    setBusy(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: name.trim().slice(0, 80) }).eq('id', user.id)
      if (error) throw error
      showToast('Configurações salvas.', 'success')
      onClose()
    } catch (error) {
      showToast(friendlyError(error), 'error')
    } finally { setBusy(false) }
  }

  async function clear() {
    setBusy(true)
    try { await onClearHistory(); setConfirmClear(false); onClose() } catch (error) { showToast(friendlyError(error), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Configurações" description="Personalize sua experiência na Lunatica.">
        <div className="space-y-6">
          <label className="block text-sm font-medium">Nome de exibição<input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label>
          <fieldset><legend className="mb-2 text-sm font-medium">Tema</legend><div className="grid grid-cols-3 gap-2">{themeOptions.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setTheme(value)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition ${theme === value ? 'border-lunar-400 bg-lunar-500/10 text-violet-600 dark:text-lunar-300' : 'hover:bg-zinc-100 dark:hover:bg-white/[0.05]'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></fieldset>
          <div className="border-t pt-5"><button type="button" onClick={() => setConfirmClear(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Limpar todo o histórico</button><button type="button" onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/[0.05]"><LogOut className="h-4 w-4" /> Sair da conta</button></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary" onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmClear} title="Limpar todo o histórico?" description="Todas as conversas e mensagens serão excluídas permanentemente." confirmLabel="Limpar histórico" busy={busy} onCancel={() => setConfirmClear(false)} onConfirm={() => void clear()} />
    </>
  )
}
