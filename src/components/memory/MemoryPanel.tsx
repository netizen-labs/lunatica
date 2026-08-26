import { useState } from 'react'
import { Brain, GraduationCap, Heart, Lightbulb, Plus, Rocket, Sparkles, Trash2, UserRound, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { friendlyError } from '../../lib/utils'
import type { Memory } from '../../types/database'

interface MemoryPanelProps {
  memories: Memory[]
  loading: boolean
  onAdd: (content: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const categoryMeta: Record<Memory['category'], { label: string; icon: LucideIcon }> = {
  identity: { label: 'Identidade', icon: UserRound },
  education: { label: 'Estudos', icon: GraduationCap },
  work: { label: 'Trabalho', icon: Workflow },
  preference: { label: 'Preferência', icon: Sparkles },
  personal: { label: 'Sobre você', icon: Heart },
  project: { label: 'Projeto', icon: Rocket },
  goal: { label: 'Objetivo', icon: Lightbulb },
  custom: { label: 'Adicionada por você', icon: Brain },
}

export function MemoryPanel({ memories, loading, onAdd, onDelete }: MemoryPanelProps) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function add() {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await onAdd(draft.trim())
      setDraft('')
      showToast('Memória resumida e salva.', 'success')
    } catch (error) { showToast(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try { await onDelete(id); showToast('Memória removida.', 'success') }
    catch (error) { showToast(friendlyError(error), 'error') }
    finally { setDeletingId(null) }
  }

  return (
    <div>
      <div className="rounded-2xl border border-lunar-400/15 bg-lunar-500/[0.055] p-4">
        <div className="flex items-start gap-3"><span className="memory-icon"><Brain className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Banco de memória</h3><p className="mt-1 text-xs leading-5 text-zinc-500">A Lunatica pode reconhecer nome, estudos, trabalho, preferências, objetivos e projetos. Você sempre controla o que permanece salvo.</p></div></div>
        <label htmlFor="new-memory" className="mt-5 flex items-center gap-2 text-sm font-medium"><Plus className="h-4 w-4 text-lunar-300" /> Adicionar por conta própria</label>
        <textarea id="new-memory" className="field mt-3 min-h-24 resize-y" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={800} placeholder="Ex.: Meu nome é Lucas e estou criando a Lunatica." />
        <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"><span className="text-[11px] leading-5 text-zinc-500">O Gemini resume antes de salvar. Nunca informe senhas, chaves ou dados financeiros.</span><button type="button" className="btn-primary shrink-0" onClick={() => void add()} disabled={busy || !draft.trim()}>{busy ? 'Resumindo…' : 'Resumir e salvar'}</button></div>
      </div>

      <div className="mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold">Memórias confirmadas</h3><span className="text-xs text-zinc-500">{memories.length}/50</span></div>
      {loading ? <div className="mt-3 space-y-2">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div> : memories.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center"><Brain className="mx-auto h-7 w-7 text-lunar-300" /><p className="mt-3 text-sm font-medium">Nenhuma memória ainda</p><p className="mt-1 text-xs leading-5 text-zinc-500">Quando uma informação útil for salva, o chat mostrará um aviso discreto e clicável.</p></div> : <div className="mt-3 grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{memories.map((memory) => { const meta = categoryMeta[memory.category]; const Icon = meta.icon; return <article key={memory.id} className="memory-card"><div className="flex items-start gap-3"><span className="memory-icon"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><span className="text-[9px] font-semibold uppercase tracking-[.16em] text-lunar-300">{meta.label}</span><p className="mt-1 text-sm leading-6 text-zinc-300">{memory.summary}</p><time className="mt-2 block text-[10px] text-zinc-600">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(memory.created_at))}</time></div><button type="button" className="icon-btn !h-8 !w-8 shrink-0" onClick={() => void remove(memory.id)} disabled={deletingId === memory.id} aria-label="Excluir memória"><Trash2 className="h-3.5 w-3.5" /></button></div></article> })}</div>}
      <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-5 text-zinc-500">A memória é separada do histórico de chats. Limpar conversas não apaga este painel; cada item pode ser removido individualmente.</p>
    </div>
  )
}
