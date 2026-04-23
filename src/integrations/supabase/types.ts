export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      edit_history: {
        Row: {
          changed_at: string
          edit_source: string
          field_changed: string
          id: string
          incident_id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          edit_source?: string
          field_changed: string
          id?: string
          incident_id: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          edit_source?: string
          field_changed?: string
          id?: string
          incident_id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_files: {
        Row: {
          capture_date: string | null
          description: string | null
          evidence_ref_number: number | null
          file_hash: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          incident_id: string | null
          mime_type: string | null
          upload_date: string
          user_id: string
        }
        Insert: {
          capture_date?: string | null
          description?: string | null
          evidence_ref_number?: number | null
          file_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          incident_id?: string | null
          mime_type?: string | null
          upload_date?: string
          user_id: string
        }
        Update: {
          capture_date?: string | null
          description?: string | null
          evidence_ref_number?: number | null
          file_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          incident_id?: string | null
          mime_type?: string | null
          upload_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_notes: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          note_text: string
          note_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          note_text: string
          note_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          note_text?: string
          note_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_notes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          ai_summary: string | null
          category: string | null
          category_source: string | null
          context_domain: string | null
          created_at: string
          exact_words: string | null
          excluded_from_rep: boolean
          id: string
          impact_note: string | null
          incident_date: string
          incident_time: string | null
          interactions: Json | null
          last_modified_at: string | null
          location: string | null
          locked: boolean
          original_created_at: string | null
          people_involved: string[]
          raw_narrative: string
          record_date: string | null
          record_method: string | null
          record_type: string
          severity: string | null
          status: string
          subtype: string | null
          tags: string[]
          title: string | null
          transcription_created_at: string | null
          transcription_model: string | null
          transcription_provider: string | null
          transcription_source_attachment_id: string | null
          updated_at: string
          user_id: string
          version: number
          void_reason: string | null
          voided_at: string | null
          witnesses: string[]
        }
        Insert: {
          ai_summary?: string | null
          category?: string | null
          category_source?: string | null
          context_domain?: string | null
          created_at?: string
          exact_words?: string | null
          excluded_from_rep?: boolean
          id?: string
          impact_note?: string | null
          incident_date: string
          incident_time?: string | null
          interactions?: Json | null
          last_modified_at?: string | null
          location?: string | null
          locked?: boolean
          original_created_at?: string | null
          people_involved?: string[]
          raw_narrative: string
          record_date?: string | null
          record_method?: string | null
          record_type?: string
          severity?: string | null
          status?: string
          subtype?: string | null
          tags?: string[]
          title?: string | null
          transcription_created_at?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          transcription_source_attachment_id?: string | null
          updated_at?: string
          user_id: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          witnesses?: string[]
        }
        Update: {
          ai_summary?: string | null
          category?: string | null
          category_source?: string | null
          context_domain?: string | null
          created_at?: string
          exact_words?: string | null
          excluded_from_rep?: boolean
          id?: string
          impact_note?: string | null
          incident_date?: string
          incident_time?: string | null
          interactions?: Json | null
          last_modified_at?: string | null
          location?: string | null
          locked?: boolean
          original_created_at?: string | null
          people_involved?: string[]
          raw_narrative?: string
          record_date?: string | null
          record_method?: string | null
          record_type?: string
          severity?: string | null
          status?: string
          subtype?: string | null
          tags?: string[]
          title?: string | null
          transcription_created_at?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          transcription_source_attachment_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          witnesses?: string[]
        }
        Relationships: []
      }
      rights_guidance: {
        Row: {
          active: boolean
          description: string | null
          display_order: number
          id: string
          incident_category: string
          source: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          display_order?: number
          id?: string
          incident_category: string
          source: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          description?: string | null
          display_order?: number
          id?: string
          incident_category?: string
          source?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_edit_source: { Args: never; Returns: string }
      sync_upsert_incident: {
        Args: { _expected_version: number; _row: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
