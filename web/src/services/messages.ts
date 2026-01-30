import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Message,
  MessageDirection,
  MessageContentType,
  MessageStatus,
  Insertable,
} from "@/lib/supabase/types";

export interface MessageWithChannel extends Message {
  customer_channel?: {
    channel_account: {
      channel_type: string;
      account_name: string;
    };
  };
}

export interface MessageFilters {
  conversationId: string;
  limit?: number;
  before?: string; // cursor for pagination
}

// Client-side service
export const messageService = {
  async getMessages(filters: MessageFilters): Promise<MessageWithChannel[]> {
    const supabase = createClient();

    let query = (supabase
      .from("messages") as any)
      .select(
        `
        *,
        customer_channel:customer_channels(
          channel_account:channel_accounts(
            channel_type,
            account_name
          )
        )
      `
      )
      .eq("conversation_id", filters.conversationId)
      .order("created_at", { ascending: true });

    if (filters.before) {
      query = query.lt("created_at", filters.before);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data as unknown as MessageWithChannel[]) || [];
  },

  async sendMessage(data: {
    conversationId: string;
    content: string;
    contentType?: MessageContentType;
    mediaUrl?: string;
  }): Promise<Message> {
    const supabase = createClient();

    const { data: message, error } = await (supabase
      .from("messages") as any)
      .insert({
        conversation_id: data.conversationId,
        direction: "outbound",
        content_type: data.contentType || "text",
        content: data.content,
        media_url: data.mediaUrl,
        sender_type: "agent",
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return message;
  },

  // Real-time subscription for messages
  subscribeToMessages(
    conversationId: string,
    callback: (message: Message) => void
  ) {
    const supabase = createClient();

    return (supabase as any)
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();
  },

  // Subscribe to message status updates
  subscribeToMessageStatus(
    messageId: string,
    callback: (status: MessageStatus) => void
  ) {
    const supabase = createClient();

    return (supabase as any)
      .channel(`message_status:${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `id=eq.${messageId}`,
        },
        (payload) => {
          const message = payload.new as Message;
          callback(message.status);
        }
      )
      .subscribe();
  },
};

// Server-side service (for API routes and webhooks)
export const serverMessageService = {
  async createInboundMessage(data: {
    conversationId: string;
    customerChannelId: string;
    content: string;
    contentType?: MessageContentType;
    mediaUrl?: string;
    originalLanguage?: string;
    externalId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Message> {
    const supabase = await createServiceClient();

    const { data: message, error } = await (supabase
      .from("messages") as any)
      .insert({
        conversation_id: data.conversationId,
        customer_channel_id: data.customerChannelId,
        direction: "inbound",
        content_type: data.contentType || "text",
        content: data.content,
        media_url: data.mediaUrl,
        original_language: data.originalLanguage,
        sender_type: "customer",
        status: "delivered",
        external_id: data.externalId,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return message;
  },

  async createAIMessage(data: {
    conversationId: string;
    content: string;
    originalLanguage?: string;
    translatedContent?: string;
    translatedLanguage?: string;
    aiConfidence: number;
    aiModel: string;
    metadata?: Record<string, unknown>;
  }): Promise<Message> {
    const supabase = await createServiceClient();

    const { data: message, error } = await (supabase
      .from("messages") as any)
      .insert({
        conversation_id: data.conversationId,
        direction: "outbound",
        content_type: "text",
        content: data.content,
        original_language: data.originalLanguage,
        translated_content: data.translatedContent,
        translated_language: data.translatedLanguage,
        sender_type: "ai",
        ai_confidence: data.aiConfidence,
        ai_model: data.aiModel,
        status: "pending",
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return message;
  },

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    externalId?: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    const updates: Partial<Message> = { status };
    if (externalId) {
      updates.external_id = externalId;
    }

    const { error } = await (supabase
      .from("messages") as any)
      .update(updates)
      .eq("id", messageId);

    if (error) throw error;
  },

  async updateTranslation(
    messageId: string,
    translatedContent: string,
    translatedLanguage: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    const { error } = await (supabase
      .from("messages") as any)
      .update({
        translated_content: translatedContent,
        translated_language: translatedLanguage,
      })
      .eq("id", messageId);

    if (error) throw error;
  },

  async createOutboundMessage(data: {
    conversationId: string;
    content: string;
    contentType?: MessageContentType;
    originalContent?: string;
    originalLanguage?: string;
    translatedContent?: string;
    senderType?: "agent" | "ai";
    metadata?: Record<string, unknown>;
  }): Promise<Message> {
    const supabase = await createServiceClient();

    const { data: message, error } = await (supabase
      .from("messages") as any)
      .insert({
        conversation_id: data.conversationId,
        direction: "outbound",
        content_type: data.contentType || "text",
        content: data.content,
        original_content: data.originalContent,
        original_language: data.originalLanguage,
        translated_content: data.translatedContent,
        sender_type: data.senderType || "agent",
        status: "pending",
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return message;
  },
};
