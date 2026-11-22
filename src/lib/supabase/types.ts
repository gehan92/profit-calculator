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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_user_id?: string | null
        }
        Relationships: []
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_type: string | null
          created_at: string
          currency: string
          id: string
          locale: string
          name: string
          owner_id: string
          plan: string
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          name?: string
          owner_id: string
          plan?: string
        }
        Update: {
          business_type?: string | null
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          name?: string
          owner_id?: string
          plan?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          business_id: string | null
          business_types: string[] | null
          color: string
          counts_as: string
          created_at: string
          icon: string
          id: string
          key: string | null
          name: string | null
          sort: number
          type: string
        }
        Insert: {
          archived?: boolean
          business_id?: string | null
          business_types?: string[] | null
          color?: string
          counts_as?: string
          created_at?: string
          icon?: string
          id?: string
          key?: string | null
          name?: string | null
          sort?: number
          type: string
        }
        Update: {
          archived?: boolean
          business_id?: string | null
          business_types?: string[] | null
          color?: string
          counts_as?: string
          created_at?: string
          icon?: string
          id?: string
          key?: string | null
          name?: string | null
          sort?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          active: boolean
          body: Json
          id: string
          key: string
          kind: string
          locale: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: Json
          id?: string
          key: string
          kind: string
          locale: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: Json
          id?: string
          key?: string
          kind?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          amount_off_cents: number | null
          code: string
          currency: string | null
          max_uses: number | null
          percent_off: number | null
          used: number
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          amount_off_cents?: number | null
          code: string
          currency?: string | null
          max_uses?: number | null
          percent_off?: number | null
          used?: number
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          amount_off_cents?: number | null
          code?: string
          currency?: string | null
          max_uses?: number | null
          percent_off?: number | null
          used?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      entries: {
        Row: {
          amount_cents: number
          business_id: string
          category: string | null
          category_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          note: string | null
          product_id: string | null
          quantity: number | null
          type: Database["public"]["Enums"]["entry_type"]
        }
        Insert: {
          amount_cents: number
          business_id: string
          category?: string | null
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date: string
          id?: string
          note?: string | null
          product_id?: string | null
          quantity?: number | null
          type: Database["public"]["Enums"]["entry_type"]
        }
        Update: {
          amount_cents?: number
          business_id?: string
          category?: string | null
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          product_id?: string | null
          quantity?: number | null
          type?: Database["public"]["Enums"]["entry_type"]
        }
        Relationships: [
          {
            foreignKeyName: "entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_product_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_history: {
        Row: {
          action: string
          business_id: string
          changed_at: string
          changed_by: string | null
          entry_id: string
          id: number
          old_row: Json
        }
        Insert: {
          action: string
          business_id: string
          changed_at?: string
          changed_by?: string | null
          entry_id: string
          id?: never
          old_row: Json
        }
        Update: {
          action?: string
          business_id?: string
          changed_at?: string
          changed_by?: string | null
          entry_id?: string
          id?: never
          old_row?: Json
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          always_on: boolean
          category: string
          countries: string[] | null
          description: string | null
          key: string
          locales: string[] | null
          locked_free: boolean
          min_plan: string
          name: string
          roles: string[] | null
          rollout_percent: number
          status: string
          updated_at: string
          updated_by: string | null
          whats_new: string | null
        }
        Insert: {
          always_on?: boolean
          category?: string
          countries?: string[] | null
          description?: string | null
          key: string
          locales?: string[] | null
          locked_free?: boolean
          min_plan?: string
          name: string
          roles?: string[] | null
          rollout_percent?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          whats_new?: string | null
        }
        Update: {
          always_on?: boolean
          category?: string
          countries?: string[] | null
          description?: string | null
          key?: string
          locales?: string[] | null
          locked_free?: boolean
          min_plan?: string
          name?: string
          roles?: string[] | null
          rollout_percent?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          whats_new?: string | null
        }
        Relationships: []
      }
      feature_overrides: {
        Row: {
          enabled: boolean
          feature_key: string
          user_id: string
        }
        Insert: {
          enabled: boolean
          feature_key: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_overrides_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
        ]
      }
      feedback: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          message: string
          page: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          message: string
          page?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_by: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_by?: string | null
          expires_at?: string
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          gateway: string
          gateway_payment_id: string
          id: string
          invoice_url: string | null
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          gateway: string
          gateway_payment_id: string
          id?: string
          invoice_url?: string | null
          status: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          gateway?: string
          gateway_payment_id?: string
          id?: string
          invoice_url?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          available_until: string | null
          billing_interval: string | null
          code: string
          features: Json
          is_founding: boolean
          max_subscribers: number | null
          name: string
          payment_mode: string
          period_months: number
          prices: Json
          public: boolean
          sort: number
          tier: string
          trial_days: number
        }
        Insert: {
          active?: boolean
          available_until?: string | null
          billing_interval?: string | null
          code: string
          features?: Json
          is_founding?: boolean
          max_subscribers?: number | null
          name: string
          payment_mode?: string
          period_months?: number
          prices?: Json
          public?: boolean
          sort?: number
          tier?: string
          trial_days?: number
        }
        Update: {
          active?: boolean
          available_until?: string | null
          billing_interval?: string | null
          code?: string
          features?: Json
          is_founding?: boolean
          max_subscribers?: number | null
          name?: string
          payment_mode?: string
          period_months?: number
          prices?: Json
          public?: boolean
          sort?: number
          tier?: string
          trial_days?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          archived: boolean
          barcode: string | null
          business_id: string
          category_id: string | null
          company_name: string | null
          cost_cents: number
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
          price_cents: number
          unit: string
        }
        Insert: {
          archived?: boolean
          barcode?: string | null
          business_id: string
          category_id?: string | null
          company_name?: string | null
          cost_cents: number
          created_at?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          price_cents: number
          unit?: string
        }
        Update: {
          archived?: boolean
          barcode?: string | null
          business_id?: string
          category_id?: string | null
          company_name?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          price_cents?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          last_active_at: string | null
          locale: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          status: string
          support_access_until: string | null
          text_size: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_active_at?: string | null
          locale?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          status?: string
          support_access_until?: string | null
          text_size?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          locale?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          status?: string
          support_access_until?: string | null
          text_size?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_cents: number
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          gateway: string
          gateway_subscription_id: string | null
          id: string
          is_founding: boolean
          plan_code: string
          price_locked_until: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          cancel_at_period_end?: boolean
          created_at?: string
          currency: string
          current_period_end?: string | null
          gateway: string
          gateway_subscription_id?: string | null
          id?: string
          is_founding?: boolean
          plan_code: string
          price_locked_until?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          gateway?: string
          gateway_subscription_id?: string | null
          id?: string
          is_founding?: boolean
          plan_code?: string
          price_locked_until?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string | null
          gateway: string
          id: number
          payload: Json
          processed_at: string | null
          received_at: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type?: string | null
          gateway: string
          id?: never
          payload: Json
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string | null
          gateway?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      admin_daily_stats: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          day: string
          signups: number
        }[]
      }
      admin_find_users: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          created_at: string
          email_masked: string
          entries_count: number
          last_active_at: string
          phone_masked: string
          platform_role: Database["public"]["Enums"]["platform_role"]
          shops_count: number
          status: string
          tier: string
          total_count: number
          user_id: string
        }[]
      }
      admin_stats: { Args: never; Returns: Json }
      admin_user_summary: { Args: { p_user_id: string }; Returns: Json }
      admin_view_user: { Args: { target: string }; Returns: Json }
      feature_enabled: {
        Args: { p_key: string; uid?: string }
        Returns: boolean
      }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_pro: { Args: { uid?: string }; Returns: boolean }
      is_team: { Args: never; Returns: boolean }
      mask_phone: { Args: { p_phone: string }; Returns: string }
      my_access_log: {
        Args: never
        Returns: {
          viewed_at: string
        }[]
      }
      my_company_names: { Args: { b: string }; Returns: string[] }
      my_features: { Args: never; Returns: string[] }
      my_role: {
        Args: { b: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      plan_available: { Args: { p_code: string }; Returns: boolean }
      plan_spots_left: { Args: { p_code: string }; Returns: number }
      purge_old_entry_history: { Args: never; Returns: number }
      restore_entry_from_history: {
        Args: { p_history_id: number }
        Returns: string
      }
      seed_business_categories: { Args: { b: string }; Returns: undefined }
      touch_last_active: { Args: never; Returns: undefined }
      user_tier: { Args: { uid?: string }; Returns: string }
    }
    Enums: {
      entry_type: "income" | "expense"
      member_role: "owner" | "staff" | "viewer"
      platform_role: "user" | "support" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      entry_type: ["income", "expense"],
      member_role: ["owner", "staff", "viewer"],
      platform_role: ["user", "support", "admin"],
    },
  },
} as const
