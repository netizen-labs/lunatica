import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { redeemLunaMax } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { UserPlan } from '../types/database'

export function usePlan(session: Session) {
  const [plan, setPlan] = useState<UserPlan | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('user_plans').select('*').maybeSingle()
    if (error) throw error
    const active = data?.status === 'active' && new Date(data.expires_at).getTime() > Date.now() ? data : null
    setPlan(active)
    return active
  }, [])

  useEffect(() => {
    let active = true
    void supabase.from('user_plans').select('*').maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) {
        if (import.meta.env.DEV) console.error('Falha ao carregar plano', error)
      } else {
        setPlan(data?.status === 'active' && new Date(data.expires_at).getTime() > Date.now() ? data : null)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const redeem = useCallback(async (code: string, acceptedDisclaimer: boolean) => {
    await redeemLunaMax(session, code, acceptedDisclaimer)
    return refresh()
  }, [refresh, session])

  return { plan, loading, isLunaMax: Boolean(plan), refresh, redeem }
}
