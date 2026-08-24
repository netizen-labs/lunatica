import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { streamChatResponse } from '../lib/api'
import { createConversationTitle, friendlyError } from '../lib/utils'
import type { Conversation, Message } from '../types/database'

interface UseChatOptions {
  user: User
  session: Session
  onNotify: (message: string, kind?: 'success' | 'error' | 'info') => void
}

export function useChat({ user, session, onNotify }: UseChatOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
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

  useEffect(() => {
    let active = true
    void supabase.from('conversations').select('*').order('updated_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (!active) return
      if (error) {
        onNotify(friendlyError(error), 'error')
        if (import.meta.env.DEV) console.error(error)
      } else {
        setConversations(data)
      }
      setLoadingConversations(false)
    })
    return () => { active = false }
  }, [onNotify])

  const openConversation = useCallback(async (conversationId: string | null) => {
    abortRef.current?.abort()
    setActiveId(conversationId)
    if (!conversationId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (error) {
      onNotify(friendlyError(error), 'error')
      setMessages([])
    } else {
      setMessages(data)
    }
    setLoadingMessages(false)
  }, [onNotify])

  const generate = useCallback(async (conversationId: string) => {
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    const temporaryId = `stream-${crypto.randomUUID()}`
    const temporaryMessage: Message = {
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
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
      await refreshConversations()
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== temporaryId))
      if (error instanceof DOMException && error.name === 'AbortError') {
        onNotify('Geração interrompida.', 'info')
      } else {
        onNotify(friendlyError(error), 'error')
        if (import.meta.env.DEV) console.error(error)
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setGenerating(false)
    }
  }, [onNotify, refreshConversations, session, user.id])

  const sendMessage = useCallback(async (rawContent: string) => {
    const content = rawContent.trim()
    if (!content || generating) return activeId
    let conversationId = activeId
    try {
      if (!conversationId) {
        const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: createConversationTitle(content) }).select().single()
        if (error) throw error
        conversationId = data.id
        setActiveId(data.id)
        setConversations((current) => [data, ...current])
      }

      const { data: userMessage, error } = await supabase.from('messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content }).select().single()
      if (error) throw error
      setMessages((current) => [...current, userMessage])
      await generate(conversationId)
      return conversationId
    } catch (error) {
      onNotify(friendlyError(error), 'error')
      if (import.meta.env.DEV) console.error(error)
      return conversationId
    }
  }, [activeId, generate, generating, onNotify, user.id])

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
    const { error } = await supabase.from('conversations').delete().eq('id', id)
    if (error) throw error
    setConversations((current) => current.filter((conversation) => conversation.id !== id))
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
    }
    onNotify('Conversa excluída.', 'success')
  }, [activeId, onNotify])

  const clearHistory = useCallback(async () => {
    const { error } = await supabase.from('conversations').delete().eq('user_id', user.id)
    if (error) throw error
    setConversations([])
    setMessages([])
    setActiveId(null)
    onNotify('Histórico limpo.', 'success')
  }, [onNotify, user.id])

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
    const { error: updateError } = await supabase.from('messages').update({ content }).eq('id', message.id)
    if (updateError) throw updateError
    const { error: deleteError } = await supabase.from('messages').delete().eq('conversation_id', message.conversation_id).gt('created_at', message.created_at)
    if (deleteError) throw deleteError
    setMessages((current) => current.filter((item) => item.created_at <= message.created_at).map((item) => item.id === message.id ? { ...item, content } : item))
    await generate(message.conversation_id)
  }, [generate, generating])

  return {
    conversations,
    messages,
    activeId,
    loadingConversations,
    loadingMessages,
    generating,
    openConversation,
    sendMessage,
    stopGeneration,
    renameConversation,
    deleteConversation,
    clearHistory,
    regenerateMessage,
    editUserMessage,
  }
}
