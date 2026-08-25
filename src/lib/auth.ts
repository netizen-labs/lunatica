import type { User } from '@supabase/supabase-js'

export function appAuthRedirectUrl(marker: 'verified' | 'recovery' = 'verified') {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}?auth=${marker}`
}

export function isEmailVerified(user: User | null | undefined) {
  return Boolean(user?.email_confirmed_at)
}
