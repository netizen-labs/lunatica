import type { MessageRole } from './database'

export interface ChatMessageInput {
  role: MessageRole
  content: string
}

export interface ChatRequest {
  conversationId: string
}

export interface ChatResponse {
  content: string
}

export interface UsageStatus {
  limit: number
  used: number
  remaining: number
  resetsAt: string
}

export interface ApiErrorBody {
  error?: string
  code?: string
}
