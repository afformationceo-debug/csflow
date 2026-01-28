import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Conversation,
  ConversationStatus,
  Message,
  Customer,
  ChannelType,
} from "@/lib/supabase/types";

export interface ConversationWithDetails extends Conversation {
  customer: Customer;
  channel_accounts: {
    channel_type: ChannelType;
    account_name: string;
  }[];
  messages_count: number;
}

export interface ConversationFilters {
  tenantId?: string;
  status?: ConversationStatus | ConversationStatus[];
  assignedTo?: string;
  channelType?: ChannelType;
  search?: string;
  limit?: number;
  offset?: number;
}

// Client-side service
export const conversationService = {
  async getConversations(
    filters: ConversationFilters = {}
  ): Promise<ConversationWithDetails[]> {
    const supabase = createClient();

    let query = (supabase
      .from("conversations") as any)
      .select(
        `
        *,
        customer:customers(*),
        channel_accounts:customer_channels(
          channel_account:channel_accounts(
            channel_type,
            account_name
          )
        )
      `
      )
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (filters.tenantId) {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    if (filters.assignedTo) {
      query = query.eq("assigned_to", filters.assignedTo);
    }

    if (filters.search) {
      query = query.or(
        `customer.name.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`
      );
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 20) - 1
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data as unknown as ConversationWithDetails[]) || [];
  },

  async getConversation(id: string): Promise<ConversationWithDetails | null> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("conversations") as any)
      .select(
        `
        *,
        customer:customers(*),
        channel_accounts:customer_channels(
          channel_account:channel_accounts(
            channel_type,
            account_name
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    return data as unknown as ConversationWithDetails;
  },

  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<Conversation> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("conversations") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async assignConversation(
    conversationId: string,
    userId: string | null
  ): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("conversations") as any)
      .update({ assigned_to: userId })
      .eq("id", conversationId);

    if (error) throw error;
  },

  async markAsRead(conversationId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("conversations") as any)
      .update({ unread_count: 0 })
      .eq("id", conversationId);

    if (error) throw error;
  },

  async resolveConversation(conversationId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("conversations") as any)
      .update({ status: "resolved" })
      .eq("id", conversationId);

    if (error) throw error;
  },

  // Real-time subscription
  subscribeToConversations(
    tenantId: string,
    callback: (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Conversation;
      old: Conversation;
    }) => void
  ) {
    const supabase = createClient();

    return (supabase as any)
      .channel(`conversations:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as Conversation,
            old: payload.old as Conversation,
          });
        }
      )
      .subscribe();
  },
};

// Server-side service (for API routes)
export const serverConversationService = {
  async createConversation(data: {
    customerId: string;
    tenantId: string;
    aiEnabled?: boolean;
  }): Promise<Conversation> {
    const supabase = await createServiceClient();

    const { data: conversation, error } = await (supabase
      .from("conversations") as any)
      .insert({
        customer_id: data.customerId,
        tenant_id: data.tenantId,
        ai_enabled: data.aiEnabled ?? true,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    return conversation;
  },

  async getOrCreateConversation(
    customerId: string,
    tenantId: string
  ): Promise<Conversation> {
    const supabase = await createServiceClient();

    // Check for existing non-resolved conversation (any status except "resolved")
    const { data: existing } = await (supabase
      .from("conversations") as any)
      .select()
      .eq("customer_id", customerId)
      .eq("tenant_id", tenantId)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return existing;
    }

    // Create new conversation
    return this.createConversation({ customerId, tenantId });
  },
};
