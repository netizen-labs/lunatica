export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; username: string | null; avatar_url: string | null; avatar_path: string | null; custom_instructions: string; onboarding_completed: boolean; theme: 'light' | 'black' | 'dark'; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string; username?: string | null; avatar_url?: string | null; avatar_path?: string | null; custom_instructions?: string; onboarding_completed?: boolean; theme?: 'light' | 'black' | 'dark'; created_at?: string; updated_at?: string }
        Update: { display_name?: string; username?: string | null; avatar_url?: string | null; avatar_path?: string | null; custom_instructions?: string; onboarding_completed?: boolean; theme?: 'light' | 'black' | 'dark'; updated_at?: string }
        Relationships: []
      }
      conversations: {
        Row: { id: string; user_id: string; title: string; is_pinned: boolean; is_temporary: boolean; expires_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; title?: string; is_pinned?: boolean; is_temporary?: boolean; expires_at?: string | null; created_at?: string; updated_at?: string }
        Update: { title?: string; is_pinned?: boolean; is_temporary?: boolean; expires_at?: string | null; updated_at?: string }
        Relationships: []
      }
      messages: {
        Row: { id: string; conversation_id: string; user_id: string; role: MessageRole; content: string; created_at: string }
        Insert: { id?: string; conversation_id: string; user_id: string; role: MessageRole; content: string; created_at?: string }
        Update: { content?: string }
        Relationships: []
      }
      chat_generations: {
        Row: { id: string; conversation_id: string; user_id: string; user_message_id: string; status: 'generating' | 'completed' | 'failed' | 'cancelled'; cancel_requested: boolean; assistant_message_id: string | null; error_code: string | null; created_at: string; updated_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      rate_limits: {
        Row: { id: number; user_id: string; created_at: string }
        Insert: { id?: number; user_id: string; created_at?: string }
        Update: never
        Relationships: []
      }
      message_attachments: {
        Row: { id: string; message_id: string; conversation_id: string; user_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; created_at: string }
        Insert: { id?: string; message_id: string; conversation_id: string; user_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; created_at?: string }
        Update: never
        Relationships: []
      }
      usage_events: {
        Row: { id: number; user_id: string; cost: number; attachment_count: number; created_at: string }
        Insert: { id?: number; user_id: string; cost: number; attachment_count: number; created_at?: string }
        Update: never
        Relationships: []
      }
      memories: {
        Row: { id: string; user_id: string; source_message_id: string | null; summary: string; category: 'identity' | 'education' | 'work' | 'preference' | 'personal' | 'project' | 'goal' | 'custom'; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; source_message_id?: string | null; summary: string; category?: 'identity' | 'education' | 'work' | 'preference' | 'personal' | 'project' | 'goal' | 'custom'; created_at?: string; updated_at?: string }
        Update: never
        Relationships: []
      }
      user_plans: {
        Row: { user_id: string; plan: 'lunamax'; status: 'active' | 'expired'; source: 'manual_code'; activated_at: string; expires_at: string; updated_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: { message_role: MessageRole }
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type ChatGeneration = Database['public']['Tables']['chat_generations']['Row']
export type MessageAttachment = Database['public']['Tables']['message_attachments']['Row']
export type Memory = Database['public']['Tables']['memories']['Row']
export type UserPlan = Database['public']['Tables']['user_plans']['Row']
export type RenderedAttachment = MessageAttachment & { previewUrl?: string }
export type MemoryActivity = 'saved' | 'recalled'
export type ChatMessage = Message & { attachments?: RenderedAttachment[]; memoryActivity?: MemoryActivity }
