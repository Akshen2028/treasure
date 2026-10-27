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
  public: {
    Tables: {
      activities: {
        Row: {
          actual_cost_cents: number | null
          budget_cents: number
          created_at: string
          deleted_at: string | null
          description: string
          event_category_id: string
          id: string
          name: string
          notes: string
          sort_order: number
          status: Database["public"]["Enums"]["activity_status"]
          updated_at: string
          wedding_id: string
        }
        Insert: {
          actual_cost_cents?: number | null
          budget_cents?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          event_category_id: string
          id?: string
          name: string
          notes?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["activity_status"]
          updated_at?: string
          wedding_id: string
        }
        Update: {
          actual_cost_cents?: number | null
          budget_cents?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          event_category_id?: string
          id?: string
          name?: string
          notes?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["activity_status"]
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_event_category_id_wedding_id_fkey"
            columns: ["event_category_id", "wedding_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id", "wedding_id"]
          },
        ]
      }
      activity_images: {
        Row: {
          activity_id: string
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          mime_type: string
          size_bytes: number
          sort_order: number
          storage_path: string
          thumbnail_path: string | null
          updated_at: string
          wedding_id: string
          width: number | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          mime_type: string
          size_bytes: number
          sort_order?: number
          storage_path: string
          thumbnail_path?: string | null
          updated_at?: string
          wedding_id: string
          width?: number | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          size_bytes?: number
          sort_order?: number
          storage_path?: string
          thumbnail_path?: string | null
          updated_at?: string
          wedding_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_images_activity_id_wedding_id_fkey"
            columns: ["activity_id", "wedding_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "wedding_id"]
          },
        ]
      }
      activity_links: {
        Row: {
          activity_id: string
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
          url: string
          wedding_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          url: string
          wedding_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          url?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_links_activity_id_wedding_id_fkey"
            columns: ["activity_id", "wedding_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "wedding_id"]
          },
        ]
      }
      category_definitions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_definitions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          category_definition_id: string
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          manual_budget_cents: number
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          category_definition_id: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          manual_budget_cents?: number
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          category_definition_id?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          manual_budget_cents?: number
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_category_definition_id_wedding_id_fkey"
            columns: ["category_definition_id", "wedding_id"]
            isOneToOne: false
            referencedRelation: "category_definitions"
            referencedColumns: ["id", "wedding_id"]
          },
          {
            foreignKeyName: "event_categories_event_id_wedding_id_fkey"
            columns: ["event_id", "wedding_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "wedding_id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_path: string | null
          created_at: string
          deleted_at: string | null
          description: string
          event_date: string | null
          id: string
          location: string
          manual_budget_cents: number
          name: string
          sort_order: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          event_date?: string | null
          id?: string
          location?: string
          manual_budget_cents?: number
          name: string
          sort_order?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          event_date?: string | null
          id?: string
          location?: string
          manual_budget_cents?: number
          name?: string
          sort_order?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          activity_id: string
          amount_cents: number
          created_at: string
          deleted_at: string | null
          id: string
          note: string
          paid_on: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          activity_id: string
          amount_cents: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string
          paid_on: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          activity_id?: string
          amount_cents?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string
          paid_on?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_activity_id_wedding_id_fkey"
            columns: ["activity_id", "wedding_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "wedding_id"]
          },
        ]
      }
      planners: {
        Row: {
          created_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planners_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          budget_mode: Database["public"]["Enums"]["budget_mode"]
          created_at: string
          guest_amounts: Database["public"]["Enums"]["guest_amounts"]
          id: string
          manual_budget_cents: number
          name: string
          plan: string
          share_key: string
          slug: string
          updated_at: string
          visibility: Database["public"]["Enums"]["wedding_visibility"]
          wedding_date: string | null
        }
        Insert: {
          budget_mode?: Database["public"]["Enums"]["budget_mode"]
          created_at?: string
          guest_amounts?: Database["public"]["Enums"]["guest_amounts"]
          id?: string
          manual_budget_cents?: number
          name: string
          plan?: string
          share_key?: string
          slug: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["wedding_visibility"]
          wedding_date?: string | null
        }
        Update: {
          budget_mode?: Database["public"]["Enums"]["budget_mode"]
          created_at?: string
          guest_amounts?: Database["public"]["Enums"]["guest_amounts"]
          id?: string
          manual_budget_cents?: number
          name?: string
          plan?: string
          share_key?: string
          slug?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["wedding_visibility"]
          wedding_date?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      budget_share: { Args: { amount: number; total: number }; Returns: number }
      create_my_wedding: {
        Args: { p_name: string; p_wedding_date?: string }
        Returns: {
          budget_mode: Database["public"]["Enums"]["budget_mode"]
          created_at: string
          guest_amounts: Database["public"]["Enums"]["guest_amounts"]
          id: string
          manual_budget_cents: number
          name: string
          plan: string
          share_key: string
          slug: string
          updated_at: string
          visibility: Database["public"]["Enums"]["wedding_visibility"]
          wedding_date: string | null
        }
        SetofOptions: {
          from: "*"
          to: "weddings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      guest_view: {
        Args: { p_share_key?: string; p_slug: string }
        Returns: Json
      }
      is_planner: { Args: { target_wedding_id: string }; Returns: boolean }
      new_share_key: { Args: never; Returns: string }
      reset_share_key: { Args: { p_wedding_id: string }; Returns: string }
      search_weddings: {
        Args: { q: string }
        Returns: {
          name: string
          slug: string
          wedding_date: string
        }[]
      }
      slug_available: { Args: { p_slug: string }; Returns: boolean }
      slugify: { Args: { p_name: string }; Returns: string }
      storage_object_wedding_id: {
        Args: { object_name: string }
        Returns: string
      }
      viewable_wedding_id: {
        Args: { p_share_key: string; p_slug: string }
        Returns: string
      }
    }
    Enums: {
      activity_status: "idea" | "planned" | "booked" | "completed"
      budget_mode: "auto" | "manual"
      guest_amounts: "amounts" | "percentages"
      wedding_visibility: "public" | "private"
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
      activity_status: ["idea", "planned", "booked", "completed"],
      budget_mode: ["auto", "manual"],
      guest_amounts: ["amounts", "percentages"],
      wedding_visibility: ["public", "private"],
    },
  },
} as const
