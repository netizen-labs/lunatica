import { useState } from 'react'
import { Coins, Headphones, LogOut, Moon, Paperclip, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { useTheme, type Theme } from '../../contexts/ThemeContext'
import { useToast } from '../../contexts/ToastContext'
import { friendlyError } from '../../lib/utils'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'

interface SettingsDialogProps {
  open: boolean
  remainingCredits?: number
  onClose: () => void
  onClearHistory: () => Promise<void>
}

export function SettingsDialog({ open, remainingCredits, onClose, onClearHistory }: SettingsDialogProps) {
  const { signOut } = useAuth()
  const { profile, saveProfile } = useProfile()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme)
    try {
      if (profile) await saveProfile({ theme: nextTheme })
      showToast('Tema atualizado.', 'success')
    } catch (error) { showToast(friendlyError(error), 'error') }
  }

  async function clear() {
    setBusy(true)
    try { await onClearHistory(); setConfirmClear(false); onClose() }
    catch (error) { showToast(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Configurações" description="Aparência, uso, suporte e controles da sua conta." size="wide">
        <div className="grid gap-7 md:grid-cols-2">
          <section><h3 className="text-sm font-semibold">Aparência</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Escolha a atmosfera visual da interface.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{([{ value: 'black', label: 'Preto lunar', note: 'Contraste mais intenso.' }, { value: 'dark', label: 'Escuro grafite', note: 'Visual mais suave.' }] as const).map((option) => <button key={option.value} type="button" onClick={() => void selectTheme(option.value as Theme)} className={`theme-card ${theme === option.value ? 'active' : ''}`}><span className={`theme-swatch ${option.value}`}><Moon className="h-4 w-4" /></span><span><strong>{option.label}</strong><small>{option.note}</small></span></button>)}</div></section>
          <section><h3 className="text-sm font-semibold">Uso diário</h3><p className="mt-1 text-xs leading-5 text-zinc-500">O limite gratuito prepara a Lunatica para planos futuros.</p><div className="mt-4 rounded-2xl border border-lunar-400/15 bg-lunar-500/[0.055] p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Coins className="h-4 w-4 text-lunar-300" /> Créditos restantes</span><strong className="text-lunar-300">{remainingCredits ?? '—'} / 30</strong></div><div className="mt-4 flex items-start gap-2 border-t border-white/10 pt-3 text-xs leading-5 text-zinc-500"><Paperclip className="mt-0.5 h-4 w-4 shrink-0" />Cada mensagem custa 1 crédito; cada anexo adiciona mais 1.</div></div></section>
        </div>
        <section className="mt-7 border-t border-white/10 pt-6"><h3 className="text-sm font-semibold">Conta e suporte</h3><div className="mt-3 grid gap-2 md:grid-cols-2"><a href="mailto:core.healops@gmail.com?subject=Suporte%20Lunatica" className="settings-row !mt-0 border border-white/10"><Headphones className="h-4 w-4" /><span><strong>Falar com o suporte</strong><small>core.healops@gmail.com</small></span></a><button type="button" onClick={() => void signOut()} className="settings-row !mt-0 border border-white/10"><LogOut className="h-4 w-4" /><span><strong>Sair da conta</strong><small>Encerra a sessão neste dispositivo.</small></span></button></div><button type="button" onClick={() => setConfirmClear(true)} className="danger-row mt-3 border border-red-500/15"><Trash2 className="h-4 w-4" /><span><strong>Limpar todo o histórico</strong><small>Exclui conversas, mensagens e anexos. Suas memórias ficam preservadas.</small></span></button></section>
        <div className="mt-7 flex justify-end border-t border-white/10 pt-5"><button type="button" className="btn-primary" onClick={onClose}>Concluído</button></div>
      </Modal>
      <ConfirmDialog open={confirmClear} title="Limpar todo o histórico?" description="Todas as conversas, mensagens e anexos serão excluídos permanentemente. Suas memórias não serão removidas." confirmLabel="Limpar histórico" busy={busy} onCancel={() => setConfirmClear(false)} onConfirm={() => void clear()} />
    </>
  )
}
