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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda: {
        Row: {
          assessor_id: string | null
          created_at: string
          criado_por: string | null
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
          criado_por?: string | null
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
          criado_por?: string | null
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
      assistente_historico: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          role: string
          sessao_id: string
          tipo_documento: string | null
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          role: string
          sessao_id: string
          tipo_documento?: string | null
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          role?: string
          sessao_id?: string
          tipo_documento?: string | null
          user_id?: string
        }
        Relationships: []
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
      demanda_eleitores: {
        Row: {
          created_at: string
          demanda_id: string
          eleitor_id: string
          id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          eleitor_id: string
          id?: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          eleitor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_eleitores_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_eleitores_eleitor_id_fkey"
            columns: ["eleitor_id"]
            isOneToOne: false
            referencedRelation: "eleitores"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          assessor_id: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          eleitor_id: string | null
          id: string
          localizacao: string | null
          origem: string | null
          prazo: string | null
          setor: string | null
          status: string
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          assessor_id?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          eleitor_id?: string | null
          id?: string
          localizacao?: string | null
          origem?: string | null
          prazo?: string | null
          setor?: string | null
          status?: string
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          assessor_id?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          eleitor_id?: string | null
          id?: string
          localizacao?: string | null
          origem?: string | null
          prazo?: string | null
          setor?: string | null
          status?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_eleitor_id_fkey"
            columns: ["eleitor_id"]
            isOneToOne: false
            referencedRelation: "eleitores"
            referencedColumns: ["id"]
          },
        ]
      }
      eleitores: {
        Row: {
          agente_ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          criado_por: string | null
          data_nascimento: string | null
          endereco: string | null
          estado: string | null
          id: string
          interesse: string | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          nome: string
          numero: string | null
          observacoes: string | null
          politico_id: string | null
          status_eleitor: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          agente_ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          criado_por?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          interesse?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          politico_id?: string | null
          status_eleitor?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          agente_ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          criado_por?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          interesse?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          politico_id?: string | null
          status_eleitor?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kiwify_webhook_logs: {
        Row: {
          created_at: string
          customer_email: string | null
          error: string | null
          event_type: string | null
          id: string
          matched_user_id: string | null
          order_id: string | null
          payload: Json
          plan_name: string | null
          processed: boolean
          product_name: string | null
          subscription_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          matched_user_id?: string | null
          order_id?: string | null
          payload: Json
          plan_name?: string | null
          processed?: boolean
          product_name?: string | null
          subscription_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          matched_user_id?: string | null
          order_id?: string | null
          payload?: Json
          plan_name?: string | null
          processed?: boolean
          product_name?: string | null
          subscription_id?: string | null
        }
        Relationships: []
      }
      legislacao_conhecimento: {
        Row: {
          conteudo: string
          created_at: string
          embedding: string | null
          id: string
          metadados: Json | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadados?: Json | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadados?: Json | null
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
          permissions: Json
          politician_id: string
        }
        Insert: {
          assessor_id: string
          created_at?: string
          id?: string
          permissions?: Json
          politician_id: string
        }
        Update: {
          assessor_id?: string
          created_at?: string
          id?: string
          permissions?: Json
          politician_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assinatura_expira_em: string | null
          assinatura_status: string
          created_at: string
          email: string
          id: string
          is_authorized: boolean
          kiwify_customer_email: string | null
          kiwify_subscription_id: string | null
          nome: string
          plano: string
          politico_id_solicitado: string | null
          role: string
          status: string
          telefone: string
          updated_at: string
          user_id: string
          whatsapp_verified: boolean
        }
        Insert: {
          assinatura_expira_em?: string | null
          assinatura_status?: string
          created_at?: string
          email: string
          id?: string
          is_authorized?: boolean
          kiwify_customer_email?: string | null
          kiwify_subscription_id?: string | null
          nome: string
          plano?: string
          politico_id_solicitado?: string | null
          role?: string
          status?: string
          telefone: string
          updated_at?: string
          user_id: string
          whatsapp_verified?: boolean
        }
        Update: {
          assinatura_expira_em?: string | null
          assinatura_status?: string
          created_at?: string
          email?: string
          id?: string
          is_authorized?: boolean
          kiwify_customer_email?: string | null
          kiwify_subscription_id?: string | null
          nome?: string
          plano?: string
          politico_id_solicitado?: string | null
          role?: string
          status?: string
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
          criado_por: string | null
          demanda_id: string | null
          descricao: string | null
          id: string
          politician_id: string | null
          prazo: string | null
          setor: string | null
          status: string
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          assessor_id?: string | null
          created_at?: string
          criado_por?: string | null
          demanda_id?: string | null
          descricao?: string | null
          id?: string
          politician_id?: string | null
          prazo?: string | null
          setor?: string | null
          status?: string
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          assessor_id?: string | null
          created_at?: string
          criado_por?: string | null
          demanda_id?: string | null
          descricao?: string | null
          id?: string
          politician_id?: string | null
          prazo?: string | null
          setor?: string | null
          status?: string
          tipo?: string | null
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
      approve_assessor: {
        Args: { _assessor_user_id: string }
        Returns: undefined
      }
      buscar_legislacao: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          conteudo: string
          id: string
          metadados: Json
          similaridade: number
        }[]
      }
      delete_demanda_politico: {
        Args: { _demanda_id: string }
        Returns: undefined
      }
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
      list_politicos: {
        Args: never
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      reject_assessor: {
        Args: { _assessor_user_id: string }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
