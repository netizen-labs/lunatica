import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from './components/ui/Logo'
import { useAuth } from './contexts/AuthContext'
import { useProfile } from './contexts/ProfileContext'
import { useTheme } from './contexts/ThemeContext'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then((module) => ({ default: module.ChatPage })))
const GuestPage = lazy(() => import('./pages/GuestPage').then((module) => ({ default: module.GuestPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })))

function LoadingScreen() {
  return <div className="app-shell flex min-h-screen items-center justify-center"><div className="animate-pulse"><Logo /></div></div>
}

function PrivateArea({ conversation = false }: { conversation?: boolean }) {
  const { session } = useAuth()
  const { profile, loading } = useProfile()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (profile?.theme) setTheme(profile.theme)
  }, [profile?.theme, setTheme])

  if (!session) return conversation ? <Navigate to="/" replace /> : <GuestPage />
  if (loading || !profile) return <LoadingScreen />
  if (!profile.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <ChatPage />
}

function OnboardingRoute() {
  const { session } = useAuth()
  const { profile, loading } = useProfile()
  if (!session) return <Navigate to="/login?mode=signup" replace />
  if (loading || !profile) return <LoadingScreen />
  if (profile.onboarding_completed) return <Navigate to="/" replace />
  return <OnboardingPage />
}

function PublicAuth() {
  const { session, recovering } = useAuth()
  return session && !recovering ? <Navigate to="/" replace /> : <AuthPage />
}

export default function App() {
  const { loading, recovering } = useAuth()
  if (loading) return <LoadingScreen />

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<PublicAuth />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/" element={recovering ? <Navigate to="/login" replace /> : <PrivateArea />} />
        <Route path="/chat/:conversationId" element={recovering ? <Navigate to="/login" replace /> : <PrivateArea conversation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
