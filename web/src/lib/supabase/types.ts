export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ChannelType = "line" | "whatsapp" | "facebook" | "instagram" | "kakao" | "wechat" | "channel_talk";
export type MessageDirection = "inbound" | "outbound";
export type MessageContentType = "text" | "image" | "file" | "audio" | "video" | "location" | "sticker";
export type MessageStatus = "pending" | "processing" | "sent" | "delivered" | "read" | "failed";
export type ConversationStatus = "active" | "waiting" | "resolved" | "escalated";
export type EscalationPriority = "low" | "medium" | "high" | "urgent";
export type EscalationStatus = "pending" | "assigned" | "in_progress" | "resolved";
export type UserRole = "admin" | "manager" | "agent";

// 상담 태그 타입 (Channel.io 참고)
export type ConsultationTag =
  | "prospect"      // 가망
  | "potential"     // 잠재
  | "first_booking" // 1차예약
  | "confirmed"     // 확정예약
  | "completed"     // 시술완료
  | "cancelled";    // 취소

export const CONSULTATION_TAG_CONFIG: Record<ConsultationTag, { label: string; color: string; bg: string }> = {
  prospect: { label: "가망", color: "text-blue-600", bg: "bg-blue-100" },
  potential: { label: "잠재", color: "text-cyan-600", bg: "bg-cyan-100" },
  first_booking: { label: "1차예약", color: "text-amber-600", bg: "bg-amber-100" },
  confirmed: { label: "확정예약", color: "text-green-600", bg: "bg-green-100" },
  completed: { label: "시술완료", color: "text-purple-600", bg: "bg-purple-100" },
  cancelled: { label: "취소", color: "text-gray-600", bg: "bg-gray-100" },
};

export interface Database {
  public: {
    Tables: {
      // 거래처 (병원/클리닉)
      tenants: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          specialty: string | null;
          logo_url: string | null;
          settings: Json;
          ai_config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          specialty?: string | null;
          logo_url?: string | null;
          settings?: Json;
          ai_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          specialty?: string | null;
          logo_url?: string | null;
          settings?: Json;
          ai_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 채널 계정 (각 거래처의 메신저 계정)
      channel_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          channel_type: ChannelType;
          account_name: string;
          account_id: string;
          credentials: Json;
          is_active: boolean;
          webhook_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          channel_type: ChannelType;
          account_name: string;
          account_id: string;
          credentials?: Json;
          is_active?: boolean;
          webhook_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          channel_type?: ChannelType;
          account_name?: string;
          account_id?: string;
          credentials?: Json;
          is_active?: boolean;
          webhook_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 고객 프로필
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          external_id: string | null;
          name: string | null;
          phone: string | null;
          email: string | null;
          country: string | null;
          language: string | null;
          profile_image_url: string | null;
          tags: string[];
          metadata: Json;
          crm_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          external_id?: string | null;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          country?: string | null;
          language?: string | null;
          profile_image_url?: string | null;
          tags?: string[];
          metadata?: Json;
          crm_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          external_id?: string | null;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          country?: string | null;
          language?: string | null;
          profile_image_url?: string | null;
          tags?: string[];
          metadata?: Json;
          crm_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 고객-채널 연결 (한 고객이 여러 채널에서 연락할 수 있음)
      customer_channels: {
        Row: {
          id: string;
          customer_id: string;
          channel_account_id: string;
          channel_user_id: string;
          channel_username: string | null;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          channel_account_id: string;
          channel_user_id: string;
          channel_username?: string | null;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          channel_account_id?: string;
          channel_user_id?: string;
          channel_username?: string | null;
          is_primary?: boolean;
          created_at?: string;
        };
      };

      // 대화 (고객별 통합 대화)
      conversations: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          status: ConversationStatus;
          assigned_to: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          unread_count: number;
          ai_enabled: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          status?: ConversationStatus;
          assigned_to?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          unread_count?: number;
          ai_enabled?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          status?: ConversationStatus;
          assigned_to?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          unread_count?: number;
          ai_enabled?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 메시지
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          customer_channel_id: string | null;
          direction: MessageDirection;
          content_type: MessageContentType;
          content: string;
          media_url: string | null;
          original_language: string | null;
          translated_content: string | null;
          translated_language: string | null;
          status: MessageStatus;
          sender_type: "customer" | "agent" | "ai" | "system";
          sender_id: string | null;
          ai_confidence: number | null;
          ai_model: string | null;
          metadata: Json;
          external_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          customer_channel_id?: string | null;
          direction: MessageDirection;
          content_type?: MessageContentType;
          content: string;
          media_url?: string | null;
          original_language?: string | null;
          translated_content?: string | null;
          translated_language?: string | null;
          status?: MessageStatus;
          sender_type: "customer" | "agent" | "ai" | "system";
          sender_id?: string | null;
          ai_confidence?: number | null;
          ai_model?: string | null;
          metadata?: Json;
          external_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          customer_channel_id?: string | null;
          direction?: MessageDirection;
          content_type?: MessageContentType;
          content?: string;
          media_url?: string | null;
          original_language?: string | null;
          translated_content?: string | null;
          translated_language?: string | null;
          status?: MessageStatus;
          sender_type?: "customer" | "agent" | "ai" | "system";
          sender_id?: string | null;
          ai_confidence?: number | null;
          ai_model?: string | null;
          metadata?: Json;
          external_id?: string | null;
          created_at?: string;
        };
      };

      // 에스컬레이션
      escalations: {
        Row: {
          id: string;
          conversation_id: string;
          message_id: string | null;
          priority: EscalationPriority;
          status: EscalationStatus;
          reason: string;
          ai_confidence: number | null;
          assigned_to: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          message_id?: string | null;
          priority?: EscalationPriority;
          status?: EscalationStatus;
          reason: string;
          ai_confidence?: number | null;
          assigned_to?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          message_id?: string | null;
          priority?: EscalationPriority;
          status?: EscalationStatus;
          reason?: string;
          ai_confidence?: number | null;
          assigned_to?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 지식베이스 문서
      knowledge_documents: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          content: string;
          category: string | null;
          tags: string[];
          source_type: "manual" | "escalation" | "import";
          source_id: string | null;
          is_active: boolean;
          version: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          content: string;
          category?: string | null;
          tags?: string[];
          source_type?: "manual" | "escalation" | "import";
          source_id?: string | null;
          is_active?: boolean;
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          title?: string;
          content?: string;
          category?: string | null;
          tags?: string[];
          source_type?: "manual" | "escalation" | "import";
          source_id?: string | null;
          is_active?: boolean;
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 지식베이스 벡터 임베딩
      knowledge_embeddings: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[];
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[];
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          chunk_index?: number;
          chunk_text?: string;
          embedding?: number[];
          created_at?: string;
        };
      };

      // 사용자 (관리자/담당자)
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          role: UserRole;
          tenant_ids: string[];
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          role?: UserRole;
          tenant_ids?: string[];
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          tenant_ids?: string[];
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 자동화 규칙
      automation_rules: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          trigger_type: string;
          trigger_conditions: Json;
          actions: Json;
          is_active: boolean;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          trigger_type: string;
          trigger_conditions?: Json;
          actions?: Json;
          is_active?: boolean;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          trigger_type?: string;
          trigger_conditions?: Json;
          actions?: Json;
          is_active?: boolean;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 예약 (CRM 연동)
      bookings: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          crm_booking_id: string | null;
          booking_date: string;
          booking_time: string | null;
          service_type: string | null;
          status: string;
          notes: string | null;
          reminder_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          crm_booking_id?: string | null;
          booking_date: string;
          booking_time?: string | null;
          service_type?: string | null;
          status?: string;
          notes?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          crm_booking_id?: string | null;
          booking_date?: string;
          booking_time?: string | null;
          service_type?: string | null;
          status?: string;
          notes?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 내부 노트 (Channel.io 참고)
      internal_notes: {
        Row: {
          id: string;
          conversation_id: string;
          author_id: string;
          content: string;
          mentioned_users: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          author_id: string;
          content: string;
          mentioned_users?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          author_id?: string;
          content?: string;
          mentioned_users?: string[];
          created_at?: string;
        };
      };

      // AI 응답 로그 (학습용)
      ai_response_logs: {
        Row: {
          id: string;
          message_id: string;
          conversation_id: string;
          tenant_id: string;
          query: string;
          response: string;
          model: string;
          confidence: number;
          retrieved_docs: Json;
          feedback: "positive" | "negative" | null;
          escalated: boolean;
          processing_time_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          conversation_id: string;
          tenant_id: string;
          query: string;
          response: string;
          model: string;
          confidence: number;
          retrieved_docs?: Json;
          feedback?: "positive" | "negative" | null;
          escalated?: boolean;
          processing_time_ms: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          conversation_id?: string;
          tenant_id?: string;
          query?: string;
          response?: string;
          model?: string;
          confidence?: number;
          retrieved_docs?: Json;
          feedback?: "positive" | "negative" | null;
          escalated?: boolean;
          processing_time_ms?: number;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          tenant_id: string;
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          id: string;
          document_id: string;
          chunk_text: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenience types
export type Tenant = Tables<"tenants">;
export type ChannelAccount = Tables<"channel_accounts">;
export type Customer = Tables<"customers">;
export type CustomerChannel = Tables<"customer_channels">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type Escalation = Tables<"escalations">;
export type KnowledgeDocument = Tables<"knowledge_documents">;
export type KnowledgeEmbedding = Tables<"knowledge_embeddings">;
export type User = Tables<"users">;
export type AutomationRule = Tables<"automation_rules">;
export type Booking = Tables<"bookings">;
export type AIResponseLog = Tables<"ai_response_logs">;
