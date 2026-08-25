import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { requestMemory } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Memory } from '../types/database'

export function useMemories(session: Session) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('memories').select('*').order('updated_at', { ascending: false }).limit(50)
    if (error) throw error
    setMemories(data)
  }, [])

  useEffect(() => {
    let active = true
    void supabase.from('memories').select('*').order('updated_at', { ascending: false }).limit(50).then(({ data, error }) => {
      if (!active) return
      if (error) { if (import.meta.env.DEV) console.error(error) }
      else setMemories(data)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const addCreated = useCallback((created: Memory[]) => {
    if (!created.length) return
    setMemories((current) => [...created, ...current.filter((item) => !created.some((next) => next.id === item.id))].slice(0, 50))
    setNotice(created.length === 1 ? 'Memória salva' : `${created.length} memórias salvas`)
  }, [])

  const analyzeMessage = useCallback(async (messageId: string) => {
    try {
      const response = await requestMemory(session, { action: 'analyze', messageId })
      addCreated(response.created)
    } catch (error) {
      if (import.meta.env.DEV) console.error('Falha ao analisar memória', error)
    }
  }, [addCreated, session])

  const addMemory = useCallback(async (content: string) => {
    const response = await requestMemory(session, { action: 'add', content })
    if (!response.created.length) throw new Error('Não encontrei uma informação pessoal estável para memorizar.')
    addCreated(response.created)
  }, [addCreated, session])

  const deleteMemory = useCallback(async (id: string) => {
    const { error } = await supabase.from('memories').delete().eq('id', id)
    if (error) throw error
    setMemories((current) => current.filter((memory) => memory.id !== id))
  }, [])

  return { memories, loading, notice, clearNotice: () => setNotice(null), refresh, analyzeMessage, addMemory, deleteMemory }
}
