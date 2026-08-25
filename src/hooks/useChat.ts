import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getUsageStatus, streamChatResponse } from '../lib/api'
import { createConversationTitle, friendlyError } from '../lib/utils'
import type { ChatMessage, Conversation, Message, MessageAttachment } from '../types/database'
import type { UsageStatus } from '../types/chat'

interface UseChatOptions {
  user: User
  session: Session
  onNotify: (message: string, kind?: 'success' | 'error' | 'info') => void
  onAnalyzeMemory?: (messageId: string) => Promise<void>
}

const MAX_ATTACHMENTS = 4
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
const MAX_TOTAL_SIZE = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json'])
const MEMORY_SIGNAL = /\b(meu nome|me chamo|pode me chamar|eu estudo|estudo (?:na|no|em)|sou (?:um |uma )?(?:desenvolvedor|desenvolvedora|programador|programadora|designer|estudante)|eu trabalho|trabalho (?:na|no|com|como)|eu prefiro|gosto de|moro em|minha profissão)\b/i

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'anexo'
}

export function useChat({ user, session, onNotify, onAnalyzeMemory }: UseChatOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [usage, setUsage] = useState<UsageStatus | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [generating, setGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const refreshConversations = useCallback(async () => {
    const { data, error } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    setConversations(data)
  }, [])

  const refreshUsage = useCallback(async (signal?: AbortSignal) => {
    const status = await getUsageStatus(session, signal)
    setUsage(status)
  }, [session])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void Promise.all([
      supabase.from('conversations').select('*').order('updated_at', { ascending: false }).limit(100),
      getUsageStatus(session, controller.signal),
    ]).then(([conversationResult, nextUsage]) => {
      if (!active) return
      if (conversationResult.error) throw conversationResult.error
      setConversations(conversationResult.data)
      setUsage(nextUsage)
    }).catch((error: unknown) => {
      if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
      onNotify(friendlyError(error), 'error')
      if (import.meta.env.DEV) console.error(error)
    }).finally(() => {
      if (active) setLoadingConversations(false)
    })
    return () => { active = false; controller.abort() }
  }, [onNotify, session])

  const openConversation = useCallback(async (conversationId: string | null) => {
    abortRef.current?.abort()
    setActiveId(conversationId)
    if (!conversationId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
      if (error) throw error
      let attachments: MessageAttachment[] = []
      if (data.length) {
        const { data: attachmentData, error: attachmentError } = await supabase.from('message_attachments').select('*').in('message_id', data.map((message) => message.id)).order('created_at', { ascending: true })
        if (attachmentError) throw attachmentError
        attachments = attachmentData
      }
      setMessages(data.map((message) => ({ ...message, attachments: attachments.filter((file) => file.message_id === message.id) })))
    } catch (error) {
      onNotify(friendlyError(error), 'error')
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [onNotify])

  const generate = useCallback(async (conversationId: string) => {
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    const temporaryId = `stream-${crypto.randomUUID()}`
    const temporaryMessage: ChatMessage = {
      id: temporaryId,
      conversation_id: conversationId,
      user_id: user.id,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, temporaryMessage])
    let content = ''

    try {
      await streamChatResponse({
        conversationId,
        session,
        signal: controller.signal,
        onText: (text) => {
          content += text
          setMessages((current) => current.map((message) => message.id === temporaryId ? { ...message, content } : message))
        },
      })
      if (!content.trim()) throw new Error('Resposta vazia da IA')
      const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content }).select().single()
      if (error) throw error
      setMessages((current) => current.map((message) => message.id === temporaryId ? data : message))
      await refreshConversations()
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== temporaryId))
      if (error instanceof DOMException && error.name === 'AbortError') onNotify('Geração interrompida.', 'info')
      else {
        onNotify(friendlyError(error), 'error')
        if (import.meta.env.DEV) console.error(error)
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setGenerating(false)
      void refreshUsage().catch((error: unknown) => { if (import.meta.env.DEV) console.error(error) })
    }
  }, [onNotify, refreshConversations, refreshUsage, session, user.id])

  const uploadFiles = useCallback(async (conversationId: string, messageId: string, files: File[]) => {
    if (files.length > MAX_ATTACHMENTS) throw new Error('Use no máximo 4 anexos')
    if (files.some((file) => !ALLOWED_TYPES.has(file.type) || file.size > MAX_ATTACHMENT_SIZE)) throw new Error('Anexo inválido ou maior que 5 MB')
    if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_SIZE) throw new Error('Os anexos devem somar no máximo 12 MB')
    const uploaded: string[] = []
    try {
      const rows: MessageAttachment[] = []
      for (const file of files) {
        const path = `${user.id}/${conversationId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        uploaded.push(path)
        const { data, error } = await supabase.from('message_attachments').insert({ message_id: messageId, conversation_id: conversationId, user_id: user.id, storage_path: path, file_name: file.name.slice(0, 160), mime_type: file.type, size_bytes: file.size }).select().single()
        if (error) throw error
        rows.push(data)
      }
      return rows
    } catch (error) {
      if (uploaded.length) await supabase.storage.from('attachments').remove(uploaded)
      await supabase.from('message_attachments').delete().eq('message_id', messageId)
      throw error
    }
  }, [user.id])

  const sendMessage = useCallback(async (rawContent: string, files: File[] = []) => {
    const content = rawContent.trim() || (files.length ? 'Analise os anexos enviados.' : '')
    if (!content || generating) return activeId
    const cost = 1 + files.length
    if (usage && usage.remaining < cost) {
      onNotify(`Você precisa de ${cost} créditos, mas restam ${usage.remaining} hoje.`, 'error')
      return activeId
    }
    let conversationId = activeId
    let createdConversation = false
    try {
      if (!conversationId) {
        const titleSource = rawContent.trim() || files[0]?.name || 'Conversa com anexos'
        const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: createConversationTitle(titleSource) }).select().single()
        if (error) throw error
        conversationId = data.id
        createdConversation = true
        setActiveId(data.id)
        setConversations((current) => [data, ...current])
      }

      const { data: userMessage, error } = await supabase.from('messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content }).select().single()
      if (error) throw error
      const attachments = files.length ? await uploadFiles(conversationId, userMessage.id, files) : []
      setMessages((current) => [...current, { ...userMessage, attachments }])
      if (MEMORY_SIGNAL.test(content)) void onAnalyzeMemory?.(userMessage.id)
      await generate(conversationId)
      return conversationId
    } catch (error) {
      if (createdConversation && conversationId) await supabase.from('conversations').delete().eq('id', conversationId)
      onNotify(friendlyError(error), 'error')
      if (import.meta.env.DEV) console.error(error)
      return conversationId
    }
  }, [activeId, generate, generating, onAnalyzeMemory, onNotify, uploadFiles, usage, user.id])

  const removeStoredAttachments = useCallback(async (query: 'conversation' | 'messages' | 'all', value?: string | string[]) => {
    let request = supabase.from('message_attachments').select('storage_path')
    if (query === 'conversation' && typeof value === 'string') request = request.eq('conversation_id', value)
    if (query === 'messages' && Array.isArray(value) && value.length) request = request.in('message_id', value)
    if (query === 'all') request = request.eq('user_id', user.id)
    const { data, error } = await request
    if (error) throw error
    const paths = data.map((row) => row.storage_path)
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('attachments').remove(paths)
      if (storageError) throw storageError
    }
  }, [user.id])

  const stopGeneration = useCallback(() => abortRef.current?.abort(), [])

  const renameConversation = useCallback(async (id: string, title: string) => {
    const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!cleanTitle) return
    const { error } = await supabase.from('conversations').update({ title: cleanTitle }).eq('id', id)
    if (error) throw error
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, title: cleanTitle } : conversation))
    onNotify('Título alterado.', 'success')
  }, [onNotify])

  const deleteConversation = useCallback(async (id: string) => {
    await removeStoredAttachments('conversation', id)
    const { error } = await supabase.from('conversations').delete().eq('id', id)
    if (error) throw error
    setConversations((current) => current.filter((conversation) => conversation.id !== id))
    if (activeId === id) { setActiveId(null); setMessages([]) }
    onNotify('Conversa excluída.', 'success')
  }, [activeId, onNotify, removeStoredAttachments])

  const clearHistory = useCallback(async () => {
    await removeStoredAttachments('all')
    const { error } = await supabase.from('conversations').delete().eq('user_id', user.id)
    if (error) throw error
    setConversations([])
    setMessages([])
    setActiveId(null)
    onNotify('Histórico limpo.', 'success')
  }, [onNotify, removeStoredAttachments, user.id])

  const regenerateMessage = useCallback(async (message: Message) => {
    if (generating || message.role !== 'assistant') return
    const { error } = await supabase.from('messages').delete().eq('id', message.id)
    if (error) throw error
    setMessages((current) => current.filter((item) => item.id !== message.id))
    await generate(message.conversation_id)
  }, [generate, generating])

  const editUserMessage = useCallback(async (message: Message, nextContent: string) => {
    const content = nextContent.trim()
    if (!content || generating || message.role !== 'user') return
    const { data: laterMessages, error: laterError } = await supabase.from('messages').select('id').eq('conversation_id', message.conversation_id).gt('created_at', message.created_at)
    if (laterError) throw laterError
    if (laterMessages.length) await removeStoredAttachments('messages', laterMessages.map((item) => item.id))
    const { error: updateError } = await supabase.from('messages').update({ content }).eq('id', message.id)
    if (updateError) throw updateError
    const { error: deleteError } = await supabase.from('messages').delete().eq('conversation_id', message.conversation_id).gt('created_at', message.created_at)
    if (deleteError) throw deleteError
    setMessages((current) => current.filter((item) => item.created_at <= message.created_at).map((item) => item.id === message.id ? { ...item, content } : item))
    if (MEMORY_SIGNAL.test(content)) void onAnalyzeMemory?.(message.id)
    await generate(message.conversation_id)
  }, [generate, generating, onAnalyzeMemory, removeStoredAttachments])

  return { conversations, messages, usage, activeId, loadingConversations, loadingMessages, generating, openConversation, sendMessage, stopGeneration, renameConversation, deleteConversation, clearHistory, regenerateMessage, editUserMessage }
}
