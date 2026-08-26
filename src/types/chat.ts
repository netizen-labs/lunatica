import type { MessageRole } from './database'
import type { Memory } from './database'

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
  plan: 'free' | 'lunamax'
  conversation: {
    messageLimit: number
    attachmentLimit: number
  }
}

export interface MemoryResponse {
  created: Memory[]
}

export interface ApiErrorBody {
  error?: string
  code?: string
}

export interface PlanRedemptionResponse {
  plan: 'lunamax'
  status: 'active'
  activated_at: string
  expires_at: string
}
