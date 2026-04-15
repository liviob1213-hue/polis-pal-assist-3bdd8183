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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agenda: {
        Row: {
          assessor_id: string | null
          created_at: string
          data_hora: string
          descricao: string | null
          id: string
          tarefa_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          assessor_id?: string | null
          created_at?: string
          data_hora: string
          descricao?: string | null
          id?: string
          tarefa_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          assessor_id?: string | null
          created_at?: string
          data_hora?: string
          descricao?: string | null
          id?: string
          tarefa_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_history: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          role: string
          telefone: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          role?: string
          telefone: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          role?: string
          telefone?: string
        }
        Relationships: []
      }
      demandas: {
        Row: {
          assessor_id: string | null
          created_at: string
          descricao: string | null
          id: string
          localizacao: string | null
          prazo: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          assessor_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          localizacao?: string | null
          prazo?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          assessor_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          localizacao?: string | null
          prazo?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      eleitores: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          interesse: string | null
          latitude: number | null
          longitude: number | null
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          interesse?: string | null
          latitude?: number | null
          longitude?: number | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          interesse?: string | null
          latitude?: number | null
          longitude?: number | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_queue: {
        Row: {
          agendado_para: string
          assessor_id: string | null
          campanha_id: string | null
          created_at: string
          destinatario_nome: string | null
          destinatario_telefone: string
          enviado_em: string | null
          erro_detalhe: string | null
          id: string
          mensagem_original: string
          mensagem_variacao: string | null
          referencia_id: string | null
          respondido_em: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string
          assessor_id?: string | null
          campanha_id?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone: string
          enviado_em?: string | null
          erro_detalhe?: string | null
          id?: string
          mensagem_original: string
          mensagem_variacao?: string | null
          referencia_id?: string | null
          respondido_em?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string
          assessor_id?: string | null
          campanha_id?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone?: string
          enviado_em?: string | null
          erro_detalhe?: string | null
          id?: string
          mensagem_original?: string
          mensagem_variacao?: string | null
          referencia_id?: string | null
          respondido_em?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      politician_assessors: {
        Row: {
          assessor_id: string
          created_at: string
          id: string
          politician_id: string
        }
        Insert: {
          assessor_id: string
          created_at?: string
          id?: string
          politician_id: string
        }
        Update: {
          assessor_id?: string
          created_at?: string
          id?: string
          politician_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_authorized: boolean
          nome: string
          role: string
          telefone: string
          updated_at: string
          user_id: string
          whatsapp_verified: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_authorized?: boolean
          nome: string
          role?: string
          telefone: string
          updated_at?: string
          user_id: string
          whatsapp_verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_authorized?: boolean
          nome?: string
          role?: string
          telefone?: string
          updated_at?: string
          user_id?: string
          whatsapp_verified?: boolean
        }
        Relationships: []
      }
      projetos_lei: {
        Row: {
          created_at: string
          demanda_id: string | null
          id: string
          texto_completo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demanda_id?: string | null
          id?: string
          texto_completo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demanda_id?: string | null
          id?: string
          texto_completo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_lei_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          assessor_id: string | null
          created_at: string
          descricao: string | null
          id: string
          prazo: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          assessor_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          prazo?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          assessor_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          prazo?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          telefone: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          telefone: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          telefone?: string
          used?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_politician_id: {
        Args: { _assessor_user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "politico" | "assessor"
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
    Enums: {
      app_role: ["politico", "assessor"],
    },
  },
} as const
