import { useMemo, useState, type ChangeEvent } from 'react'
import { AtSign, Camera, Headphones, LogOut, Moon, SlidersHorizontal, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { useTheme, type Theme } from '../../contexts/ThemeContext'
import { useToast } from '../../contexts/ToastContext'
import { friendlyError, normalizeUsername, validateUsername } from '../../lib/utils'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  onClearHistory: () => Promise<void>
}

type Tab = 'profile' | 'preferences' | 'account'

const tabs = [
  { id: 'profile' as const, label: 'Perfil', icon: UserRound },
  { id: 'preferences' as const, label: 'Preferências', icon: SlidersHorizontal },
  { id: 'account' as const, label: 'Conta e suporte', icon: Headphones },
]

export function SettingsDialog(props: SettingsDialogProps) {
  return props.open ? <SettingsContent {...props} /> : null
}

function SettingsContent({ open, onClose, onClearHistory }: SettingsDialogProps) {
  const { user, signOut } = useAuth()
  const { profile, avatarUrl, saveProfile, uploadAvatar } = useProfile()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('profile')
  const [name, setName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [instructions, setInstructions] = useState(profile?.custom_instructions || '')
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const usernameError = useMemo(() => validateUsername(username), [username])

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      await uploadAvatar(file)
      showToast('Foto atualizada.', 'success')
    } catch (error) {
      showToast(friendlyError(error), 'error')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function save() {
    if (!name.trim() || usernameError) return
    setBusy(true)
    try {
      await saveProfile({ display_name: name.trim().slice(0, 80), username, custom_instructions: instructions.trim().slice(0, 2000), theme })
      showToast('Configurações salvas.', 'success')
      onClose()
    } catch (error) {
      const message = error instanceof Error && /duplicate|unique/i.test(error.message) ? 'Esse nome de usuário já está em uso.' : friendlyError(error)
      showToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    try {
      await onClearHistory()
      setConfirmClear(false)
      onClose()
    } catch (error) {
      showToast(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Central de controle" description="Seu perfil, a personalidade das respostas e sua conta." size="wide">
        <div className="grid gap-6 md:grid-cols-[190px_1fr]">
          <nav className="space-y-1" aria-label="Seções das configurações">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`settings-tab ${tab === id ? 'active' : ''}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
          <div className="min-w-0 md:border-l md:border-white/10 md:pl-6">
            {tab === 'profile' && <section className="animate-fade-in"><h3 className="text-lg font-semibold">Seu perfil</h3><p className="mt-1 text-sm text-[var(--muted)]">Personalize como você aparece na Lunatica.</p>
              <div className="mt-6 flex items-center gap-4"><div className="avatar-frame !h-16 !w-16">{avatarUrl ? <img src={avatarUrl} alt="Foto do perfil" /> : <span>{(name || 'L').slice(0, 1).toUpperCase()}</span>}</div><label className="btn-secondary cursor-pointer"><Camera className="h-4 w-4" /> Trocar foto<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseAvatar(event)} disabled={busy} /></label></div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Nome de exibição<input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><label className="text-sm font-medium">Nome de usuário<div className="relative mt-2"><AtSign className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" /><input className="field pl-10" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} maxLength={24} /></div>{username && usernameError && <span className="mt-1.5 block text-xs text-red-400">{usernameError}</span>}</label></div>
            </section>}

            {tab === 'preferences' && <section className="animate-fade-in"><h3 className="text-lg font-semibold">Preferências da Lunatica</h3><p className="mt-1 text-sm text-[var(--muted)]">O prompt original continua protegido; suas instruções são complementares.</p>
              <fieldset className="mt-6"><legend className="text-sm font-medium">Atmosfera visual</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ value: 'black', label: 'Preto lunar', note: 'Fundo preto e contraste alto.' }, { value: 'dark', label: 'Escuro grafite', note: 'Carvão suave e confortável.' }] as const).map((option) => <button key={option.value} type="button" onClick={() => setTheme(option.value as Theme)} className={`theme-card ${theme === option.value ? 'active' : ''}`}><span className={`theme-swatch ${option.value}`}><Moon className="h-4 w-4" /></span><span><strong>{option.label}</strong><small>{option.note}</small></span></button>)}</div></fieldset>
              <label className="mt-6 block text-sm font-medium">Instruções pessoais<textarea className="field mt-2 min-h-40 resize-y leading-6" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} placeholder="Ex.: respostas curtas, exemplos em TypeScript, explique termos técnicos…" /><span className="mt-1.5 flex justify-between text-xs text-[var(--muted)]"><span>Aplicadas no servidor a cada nova resposta.</span><span>{instructions.length}/2000</span></span></label>
            </section>}

            {tab === 'account' && <section className="animate-fade-in"><h3 className="text-lg font-semibold">Conta e suporte</h3><p className="mt-1 text-sm text-[var(--muted)]">{user?.email}</p>
              <a href="mailto:core.healops@gmail.com?subject=Suporte%20Lunatica" className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-lunar-400/40"><Headphones className="h-5 w-5 text-lunar-300" /><span><strong className="block text-sm">Falar com o suporte</strong><small className="text-[var(--muted)]">core.healops@gmail.com</small></span></a>
              <div className="mt-6 border-t border-white/10 pt-5"><button type="button" onClick={() => setConfirmClear(true)} className="danger-row"><Trash2 className="h-4 w-4" /><span><strong>Limpar histórico</strong><small>Exclui conversas, mensagens e anexos.</small></span></button><button type="button" onClick={() => void signOut()} className="settings-row"><LogOut className="h-4 w-4" /><span><strong>Sair da conta</strong><small>Encerra a sessão neste dispositivo.</small></span></button></div>
            </section>}
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-2 border-t border-white/10 pt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary" onClick={() => void save()} disabled={busy || !name.trim() || Boolean(usernameError)}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div>
      </Modal>
      <ConfirmDialog open={confirmClear} title="Limpar todo o histórico?" description="Todas as conversas, mensagens e referências de anexos serão excluídas permanentemente." confirmLabel="Limpar histórico" busy={busy} onCancel={() => setConfirmClear(false)} onConfirm={() => void clear()} />
    </>
  )
}
