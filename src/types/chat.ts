import type { MessageRole } from './database'
import type { Memory } from './database'

export interface ChatMessageInput {
  role: MessageRole
  content: string
}

export interface ChatRequest {
  conversationId: string
  generationId: string
}

export interface ChatResponse {
  content: string
}

export interface UsageStatus {
  limit: number | null
  used: number
  remaining: number | null
  unlimited: boolean
  resetsAt: string
  plan: 'free' | 'lunamax'
  conversation: {
    messageLimit: number | null
    attachmentLimit: number | null
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
