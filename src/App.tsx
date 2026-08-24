import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from './components/ui/Logo'
import { useAuth } from './contexts/AuthContext'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then((module) => ({ default: module.ChatPage })))

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse"><Logo /></div></div>
}

function ProtectedChat() {
  const { session } = useAuth()
  return session ? <ChatPage /> : <Navigate to="/login" replace />
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
        <Route path="/" element={recovering ? <Navigate to="/login" replace /> : <ProtectedChat />} />
        <Route path="/chat/:conversationId" element={recovering ? <Navigate to="/login" replace /> : <ProtectedChat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
