export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; avatar_url: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string; avatar_url?: string | null; created_at?: string; updated_at?: string }
        Update: { display_name?: string; avatar_url?: string | null; updated_at?: string }
        Relationships: []
      }
      conversations: {
        Row: { id: string; user_id: string; title: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; title?: string; created_at?: string; updated_at?: string }
        Update: { title?: string; updated_at?: string }
        Relationships: []
      }
      messages: {
        Row: { id: string; conversation_id: string; user_id: string; role: MessageRole; content: string; created_at: string }
        Insert: { id?: string; conversation_id: string; user_id: string; role: MessageRole; content: string; created_at?: string }
        Update: { content?: string }
        Relationships: []
      }
      rate_limits: {
        Row: { id: number; user_id: string; created_at: string }
        Insert: { id?: number; user_id: string; created_at?: string }
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
