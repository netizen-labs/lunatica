import { useMemo, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, AtSign, Camera, Check, Code2, Heart, Moon, Orbit, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import { useTheme, type Theme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { friendlyError, normalizeUsername, validateUsername } from '../lib/utils'

const steps = ['Identidade', 'Preferências', 'Bem-vindo']

export function OnboardingPage() {
  const { user } = useAuth()
  const { profile, avatarUrl, saveProfile, uploadAvatar } = useProfile()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.display_name || user?.user_metadata.display_name as string || '')
  const [username, setUsername] = useState(profile?.username || normalizeUsername(user?.email?.split('@')[0] || ''))
  const [instructions, setInstructions] = useState(profile?.custom_instructions || '')
  const [busy, setBusy] = useState(false)
  const usernameError = useMemo(() => validateUsername(username), [username])

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      await uploadAvatar(file)
      showToast('Foto de perfil atualizada.', 'success')
    } catch (error) {
      showToast(friendlyError(error), 'error')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function next() {
    if (step === 0 && (!name.trim() || usernameError)) return
    if (step < 2) {
      setStep((current) => current + 1)
      return
    }
    setBusy(true)
    try {
      await saveProfile({
        display_name: name.trim().slice(0, 80),
        username,
        custom_instructions: instructions.trim().slice(0, 2000),
        theme,
        onboarding_completed: true,
      })
      showToast('Tudo pronto. Bem-vindo à Lunatica.', 'success')
      navigate('/', { replace: true })
    } catch (error) {
      const message = error instanceof Error && /duplicate|unique/i.test(error.message) ? 'Esse nome de usuário já está em uso.' : friendlyError(error)
      showToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell relative min-h-screen overflow-hidden px-5 py-7 sm:px-8">
      <div className="lunar-orbit lunar-orbit-a" aria-hidden="true" />
      <div className="lunar-orbit lunar-orbit-b" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between"><Logo /><span className="micro-label">PREPARAÇÃO · {step + 1}/3</span></header>
      <section className="relative z-10 mx-auto mt-10 grid max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] shadow-2xl lg:grid-cols-[.82fr_1.18fr]">
        <aside className="border-b border-white/10 bg-[#0a0910] p-7 lg:border-b-0 lg:border-r lg:p-10">
          <Orbit className="h-9 w-9 text-lunar-300" />
          <h1 className="mt-8 max-w-xs text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Prepare seu espaço lunar.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-400">Três passos rápidos para a Lunatica reconhecer você e responder do seu jeito.</p>
          <ol className="mt-10 space-y-4">{steps.map((label, index) => <li key={label} className={`flex items-center gap-3 text-sm ${index <= step ? 'text-white' : 'text-zinc-600'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${index < step ? 'border-lunar-400 bg-lunar-500 text-white' : index === step ? 'border-lunar-300 text-lunar-300' : 'border-white/10'}`}>{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>{label}</li>)}</ol>
        </aside>

        <div className="min-h-[540px] p-6 sm:p-10 lg:p-12">
          {step === 0 && <div className="animate-fade-in"><span className="micro-label">01 · SUA IDENTIDADE</span><h2 className="mt-3 text-2xl font-semibold tracking-tight">Como devemos chamar você?</h2><p className="mt-2 text-sm text-[var(--muted)]">Seu nome de usuário fica ligado ao seu perfil da Lunatica.</p>
            <div className="mt-8 flex items-center gap-5"><div className="avatar-frame">{avatarUrl ? <img src={avatarUrl} alt="Sua foto" /> : <span>{(name || 'L').slice(0, 1).toUpperCase()}</span>}</div><label className="btn-secondary cursor-pointer"><Camera className="h-4 w-4" /> Escolher foto<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseAvatar(event)} disabled={busy} /></label></div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Nome de exibição<input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Seu nome" /></label><label className="text-sm font-medium">Nome de usuário<div className="relative mt-2"><AtSign className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" /><input className="field pl-10" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} maxLength={24} placeholder="seu_usuario" /></div>{username && usernameError && <span className="mt-1.5 block text-xs text-red-400">{usernameError}</span>}</label></div>
          </div>}

          {step === 1 && <div className="animate-fade-in"><span className="micro-label">02 · PREFERÊNCIAS</span><h2 className="mt-3 text-2xl font-semibold tracking-tight">Ajuste a atmosfera.</h2><p className="mt-2 text-sm text-[var(--muted)]">Escolha o contraste e diga como prefere receber respostas.</p>
            <fieldset className="mt-8"><legend className="text-sm font-medium">Tema</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ value: 'black', label: 'Preto lunar', note: 'Contraste máximo e fundo puro.' }, { value: 'dark', label: 'Escuro grafite', note: 'Tons de carvão mais suaves.' }] as const).map((option) => <button key={option.value} type="button" onClick={() => setTheme(option.value as Theme)} className={`theme-card ${theme === option.value ? 'active' : ''}`}><span className={`theme-swatch ${option.value}`}><Moon className="h-4 w-4" /></span><span><strong>{option.label}</strong><small>{option.note}</small></span></button>)}</div></fieldset>
            <label className="mt-7 block text-sm font-medium">Instruções pessoais para a Lunatica<textarea className="field mt-2 min-h-36 resize-y leading-6" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} placeholder="Ex.: responda em português, seja direto, use exemplos quando explicar código…" /><span className="mt-1.5 flex justify-between text-xs text-[var(--muted)]"><span>Complementa o prompt original; não o substitui.</span><span>{instructions.length}/2000</span></span></label>
          </div>}

          {step === 2 && <div className="animate-fade-in"><span className="micro-label">03 · PRONTA PARA DECOLAR</span><h2 className="mt-3 text-3xl font-semibold tracking-[-.035em]">Lunatica 1.5 está pronta.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Um modelo criado para colaborar, programar em nível sênior, escrever com cuidado e também se divertir com boas ideias.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="feature-tile"><Code2 /><strong>Feita por Lucas Gabriel</strong><span>A Lunatica foi feita pelo usuário e único desenvolvedor Lucas Gabriel R. Aguiar.</span></div><div className="feature-tile"><Heart /><strong>Apoie os próximos updates</strong><span>Seu feedback e apoio ajudam o projeto independente a continuar evoluindo.</span></div></div>
            <a href="mailto:core.healops@gmail.com?subject=Suporte%20Lunatica" className="mt-5 inline-flex items-center gap-2 text-sm text-lunar-300 hover:text-white"><Sparkles className="h-4 w-4" /> core.healops@gmail.com</a>
          </div>}

          <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-6"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} className="btn-secondary invisible data-[visible=true]:visible" data-visible={step > 0}><ArrowLeft className="h-4 w-4" /> Voltar</button><button type="button" onClick={() => void next()} disabled={busy || (step === 0 && (!name.trim() || Boolean(usernameError)))} className="btn-primary">{busy ? 'Salvando…' : step === 2 ? 'Entrar na Lunatica' : 'Continuar'} <ArrowRight className="h-4 w-4" /></button></div>
        </div>
      </section>
    </main>
  )
}
