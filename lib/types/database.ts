export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      voip_users: {
        Row: {
          id: string
          organization_id: string | null
          role: 'super_admin' | 'tenant_admin' | 'agent'
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          role?: 'super_admin' | 'tenant_admin' | 'agent'
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: 'super_admin' | 'tenant_admin' | 'agent'
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          twilio_number: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_api_key: string | null
          twilio_api_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          twilio_number?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_api_key?: string | null
          twilio_api_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          twilio_number?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_api_key?: string | null
          twilio_api_secret?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          organization_id: string
          twilio_call_sid: string
          from_number: string
          to_number: string
          answered_by_user_id: string | null
          assigned_to: string | null
          direction: 'inbound' | 'outbound' | null
          status: 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed'
          duration: number | null
          recording_url: string | null
          started_at: string
          answered_at: string | null
          ended_at: string | null
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          organization_id?: string | null
          twilio_call_sid: string
          from_number: string
          to_number: string
          answered_by_user_id?: string | null
          assigned_to?: string | null
          direction?: 'inbound' | 'outbound' | null
          status?: 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed'
          duration?: number | null
          recording_url?: string | null
          started_at?: string
          answered_at?: string | null
          ended_at?: string | null
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          organization_id?: string
          twilio_call_sid?: string
          from_number?: string
          to_number?: string
          answered_by_user_id?: string | null
          assigned_to?: string | null
          direction?: 'inbound' | 'outbound' | null
          status?: 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed'
          duration?: number | null
          recording_url?: string | null
          started_at?: string
          answered_at?: string | null
          ended_at?: string | null
          created_at?: string
          metadata?: Json
        }
      }
      contacts: {
        Row: {
          id: string
          organization_id: string | null
          business_name: string | null
          first_name: string
          last_name: string
          address: string | null
          city: string | null
          state: string | null
          zip: string | null
          phone: string
          email: string | null
          created_at: string
          updated_at: string
          created_by_user_id: string | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          business_name?: string | null
          first_name: string
          last_name: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          phone: string
          email?: string | null
          created_at?: string
          updated_at?: string
          created_by_user_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          business_name?: string | null
          first_name?: string
          last_name?: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          phone?: string
          email?: string | null
          created_at?: string
          updated_at?: string
          created_by_user_id?: string | null
        }
      }
    }
  }
}
