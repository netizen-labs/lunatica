import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { friendlyError } from '../lib/utils'

type AuthMode = 'login' | 'signup' | 'reset' | 'update'

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<AuthMode>(() => searchParams.get('mode') === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const { signIn, signUp, resetPassword, updatePassword, configured, recovering } = useAuth()
  const currentMode: AuthMode = recovering ? 'update' : mode
  const { showToast } = useToast()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!configured) return showToast('Configure as variáveis do Supabase no arquivo .env.', 'error')
    setBusy(true)
    try {
      if (currentMode === 'login') await signIn(email, password)
      if (currentMode === 'signup') {
        await signUp(email, password, displayName)
        showToast('Conta criada. Verifique seu email para confirmar o cadastro.', 'success')
        setMode('login')
      }
      if (currentMode === 'reset') {
        await resetPassword(email)
        showToast('Enviamos o link de recuperação para seu email.', 'success')
        setMode('login')
      }
      if (currentMode === 'update') {
        await updatePassword(password)
        showToast('Senha atualizada com sucesso.', 'success')
      }
    } catch (error) {
      showToast(friendlyError(error), 'error')
      if (import.meta.env.DEV) console.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#08070b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="relative z-10 max-w-xl">
          <p className="micro-label mb-6 !text-lunar-300">ACESSO À ESTAÇÃO</p>
          <h1 className="text-6xl font-medium leading-[.98] tracking-[-.06em]">Volte para<br />a sua <span className="text-lunar-300">órbita.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-zinc-400">Suas conversas, seu perfil e suas instruções pessoais continuam sincronizados no seu espaço.</p>
        </div>
        <p className="text-xs text-zinc-600">Modelo Lunatica 1.5 · Suas conversas permanecem privadas</p>
        <div className="lunar-orbit lunar-orbit-a" />
        <div className="lunar-orbit lunar-orbit-b" />
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-10 flex items-center justify-between lg:justify-start">
            <Logo className="lg:hidden" />
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-[-.03em]">
              {currentMode === 'login' ? 'Entre na sua conta' : currentMode === 'signup' ? 'Crie sua conta' : currentMode === 'update' ? 'Defina sua nova senha' : 'Recupere sua senha'}
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {currentMode === 'reset' ? 'Você receberá um link seguro por email.' : currentMode === 'update' ? 'Escolha uma senha com pelo menos 8 caracteres.' : 'Continue sua próxima boa conversa.'}
            </p>
          </div>

          {!configured && <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Supabase ainda não configurado. Copie <code>.env.example</code> para <code>.env</code> e preencha os valores públicos.</div>}

          <form className="space-y-4" onSubmit={submit}>
            {currentMode === 'signup' && (
              <label className="block text-sm font-medium">Nome
                <input className="field mt-2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required maxLength={80} placeholder="Como devemos chamar você?" disabled={busy} />
              </label>
            )}
            {currentMode !== 'update' && <label className="block text-sm font-medium">Email
              <div className="relative mt-2"><Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" /><input className="field pl-10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="voce@exemplo.com" disabled={busy} /></div>
            </label>}
            {currentMode !== 'reset' && (
              <label className="block text-sm font-medium">Senha
                <div className="relative mt-2"><KeyRound className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" /><input className="field px-10" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={currentMode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="Mínimo de 8 caracteres" disabled={busy} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="icon-btn absolute right-1.5 top-1.5" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              </label>
            )}
            {currentMode === 'login' && <button type="button" className="text-sm text-zinc-500 hover:text-lunar-500" onClick={() => setMode('reset')}>Esqueci minha senha</button>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? currentMode === 'login' ? 'Conectando…' : 'Processando…' : currentMode === 'login' ? 'Entrar' : currentMode === 'signup' ? 'Criar conta' : currentMode === 'update' ? 'Atualizar senha' : 'Enviar link'} {!busy && <ArrowRight className="h-4 w-4" />}</button>
          </form>

          {currentMode !== 'update' && <div className="mt-6 text-center text-sm text-zinc-500">
            {currentMode === 'login' ? <>Não possui conta? <button className="font-medium text-zinc-900 hover:text-lunar-500 dark:text-white" onClick={() => setMode('signup')}>Criar conta</button></> : <>Já possui conta? <button className="font-medium text-zinc-900 hover:text-lunar-500 dark:text-white" onClick={() => setMode('login')}>Entrar</button></>}
          </div>}
          <p className="mt-10 text-center text-[11px] text-zinc-600">Precisa de ajuda? <a className="text-zinc-400 hover:text-lunar-300" href="mailto:core.healops@gmail.com">core.healops@gmail.com</a></p>
        </div>
      </section>
    </main>
  )
}
