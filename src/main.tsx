import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProfileProvider } from './contexts/ProfileContext'
import './index.css'

// Links de autenticação inválidos chegam no fragmento, que também é usado pelo
// HashRouter. Normalize antes de montar o React para exibir uma mensagem útil.
if (window.location.hash.startsWith('#error=')) {
  const authError = new URLSearchParams(window.location.hash.slice(1)).get('error_code') || 'invalid_link'
  window.history.replaceState({}, '', `${window.location.pathname}?auth_error=${encodeURIComponent(authError)}#/login`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <HashRouter>
          <AuthProvider>
            <ProfileProvider>
              <App />
            </ProfileProvider>
          </AuthProvider>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
