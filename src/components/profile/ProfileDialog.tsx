import { useMemo, useState, type ChangeEvent } from 'react'
import { AtSign, Camera, Mail, UserRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { useToast } from '../../contexts/ToastContext'
import { friendlyError, normalizeUsername, validateUsername } from '../../lib/utils'
import { Modal } from '../ui/Modal'

interface ProfileDialogProps { open: boolean; onClose: () => void }

export function ProfileDialog(props: ProfileDialogProps) {
  return props.open ? <ProfileContent {...props} /> : null
}

function ProfileContent({ open, onClose }: ProfileDialogProps) {
  const { user } = useAuth()
  const { profile, avatarUrl, saveProfile, uploadAvatar } = useProfile()
  const { showToast } = useToast()
  const [name, setName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [instructions, setInstructions] = useState(profile?.custom_instructions || '')
  const [busy, setBusy] = useState(false)
  const usernameError = useMemo(() => validateUsername(username), [username])

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try { await uploadAvatar(file); showToast('Foto atualizada.', 'success') }
    catch (error) { showToast(friendlyError(error), 'error') }
    finally { setBusy(false); event.target.value = '' }
  }

  async function save() {
    if (!name.trim() || usernameError) return
    setBusy(true)
    try {
      await saveProfile({ display_name: name.trim().slice(0, 80), username, custom_instructions: instructions.trim().slice(0, 2000) })
      showToast('Perfil salvo.', 'success')
      onClose()
    } catch (error) {
      showToast(error instanceof Error && /duplicate|unique/i.test(error.message) ? 'Esse nome de usuário já está em uso.' : friendlyError(error), 'error')
    } finally { setBusy(false) }
  }

  const memberSince = user?.created_at ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(user.created_at)) : '—'

  return (
    <Modal open={open} onClose={onClose} title="Seu perfil" description="Sua identidade e a forma como a Lunatica colabora com você." size="wide">
      <div className="grid gap-7 md:grid-cols-[190px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
          <div className="avatar-frame mx-auto !h-24 !w-24 !rounded-3xl">{avatarUrl ? <img src={avatarUrl} alt="Foto do perfil" /> : <span>{(name || 'U').slice(0, 1).toUpperCase()}</span>}</div>
          <label className="btn-secondary mt-4 w-full cursor-pointer"><Camera className="h-4 w-4" /> Trocar foto<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseAvatar(event)} disabled={busy} /></label>
          <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-left text-xs text-zinc-500"><p className="flex gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{user?.email}</span></p><p className="flex gap-2"><UserRound className="h-4 w-4 shrink-0" /><span>Membro desde {memberSince}</span></p></div>
        </aside>
        <div className="min-w-0">
          <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Nome de exibição<input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" /></label><label className="text-sm font-medium">Nome de usuário<div className="relative mt-2"><AtSign className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" /><input className="field pl-10" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} maxLength={24} autoComplete="username" /></div>{username && usernameError && <span className="mt-1.5 block text-xs text-red-400">{usernameError}</span>}<span className="mt-1.5 block text-[11px] text-zinc-500">Apenas letras minúsculas, números, ponto e sublinhado.</span></label></div>
          <label className="mt-6 block text-sm font-medium">Instruções para a IA<textarea className="field mt-2 min-h-40 resize-y leading-6" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} placeholder="Ex.: prefiro respostas curtas, exemplos em TypeScript e explicações sem jargão." /><span className="mt-1.5 flex justify-between text-xs text-[var(--muted)]"><span>Complementam o prompt original; nunca o substituem.</span><span>{instructions.length}/2000</span></span></label>
        </div>
      </div>
      <div className="mt-7 flex justify-end gap-2 border-t border-white/10 pt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary" onClick={() => void save()} disabled={busy || !name.trim() || Boolean(usernameError)}>{busy ? 'Salvando…' : 'Salvar perfil'}</button></div>
    </Modal>
  )
}
