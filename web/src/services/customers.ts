import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { Customer, CustomerChannel, ChannelType, ConsultationTag, Conversation, Message, Booking } from "@/lib/supabase/types";

export interface CustomerWithChannels extends Customer {
  customer_channels: (CustomerChannel & {
    channel_account: {
      channel_type: ChannelType;
      account_name: string;
    };
  })[];
}

export interface CustomerProfile extends CustomerWithChannels {
  conversations: Conversation[];
  bookings: Booking[];
  stats: CustomerStats;
  timeline: CustomerTimelineEvent[];
}

export interface CustomerStats {
  totalMessages: number;
  totalConversations: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  avgResponseTime: number; // minutes
  lastContactAt: string | null;
  firstContactAt: string | null;
  preferredChannel: ChannelType | null;
  preferredLanguage: string | null;
}

export interface CustomerTimelineEvent {
  id: string;
  type: "message" | "conversation" | "booking" | "tag_change" | "note" | "escalation";
  title: string;
  description?: string;
  channelType?: ChannelType;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CustomerFilters {
  tenantId?: string;
  search?: string;
  tags?: string[];
  country?: string;
  limit?: number;
  offset?: number;
}

// Client-side service
export const customerService = {
  async getCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
    const supabase = createClient();

    let query = (supabase
      .from("customers") as any)
      .select("*")
      .order("updated_at", { ascending: false });

    if (filters.tenantId) {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags);
    }

    if (filters.country) {
      query = query.eq("country", filters.country);
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

    return data || [];
  },

  async getCustomer(id: string): Promise<CustomerWithChannels | null> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("customers") as any)
      .select(
        `
        *,
        customer_channels(
          *,
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

    return data as unknown as CustomerWithChannels;
  },

  async updateCustomer(
    id: string,
    updates: Partial<Customer>
  ): Promise<Customer> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("customers") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async addTag(customerId: string, tag: string): Promise<void> {
    const supabase = createClient();

    // Get current tags
    const { data: customer } = await (supabase
      .from("customers") as any)
      .select("tags")
      .eq("id", customerId)
      .single();

    const currentTags = customer?.tags || [];
    if (!currentTags.includes(tag)) {
      const { error } = await (supabase
        .from("customers") as any)
        .update({ tags: [...currentTags, tag] })
        .eq("id", customerId);

      if (error) throw error;
    }
  },

  async removeTag(customerId: string, tag: string): Promise<void> {
    const supabase = createClient();

    const { data: customer } = await (supabase
      .from("customers") as any)
      .select("tags")
      .eq("id", customerId)
      .single();

    const currentTags = customer?.tags || [];
    const newTags = currentTags.filter((t: string) => t !== tag);

    const { error } = await (supabase
      .from("customers") as any)
      .update({ tags: newTags })
      .eq("id", customerId);

    if (error) throw error;
  },

  // 상담 태그 업데이트 (Channel.io 스타일)
  async updateConsultationTag(
    customerId: string,
    consultationTag: ConsultationTag
  ): Promise<Customer> {
    const supabase = createClient();

    // 기존 상담 태그 제거 후 새 태그 추가
    const { data: customer } = await (supabase
      .from("customers") as any)
      .select("tags")
      .eq("id", customerId)
      .single();

    const currentTags = (customer?.tags || []) as string[];

    // 기존 상담 단계 태그 제거
    const consultationTags: string[] = [
      "prospect", "potential", "first_booking",
      "confirmed", "completed", "cancelled"
    ];
    const filteredTags = currentTags.filter(
      (t: string) => !consultationTags.includes(t)
    );

    // 새 상담 태그 추가
    const newTags = [...filteredTags, consultationTag];

    const { data, error } = await (supabase
      .from("customers") as any)
      .update({ tags: newTags })
      .eq("id", customerId)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  // 현재 상담 태그 조회
  getConsultationTag(tags: string[]): ConsultationTag | null {
    const consultationTags: ConsultationTag[] = [
      "prospect", "potential", "first_booking",
      "confirmed", "completed", "cancelled"
    ];

    for (const tag of tags) {
      if (consultationTags.includes(tag as ConsultationTag)) {
        return tag as ConsultationTag;
      }
    }
    return null;
  },
};

// Server-side service
export const serverCustomerService = {
  async createCustomer(data: {
    tenantId: string;
    name?: string;
    phone?: string;
    email?: string;
    country?: string;
    language?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Customer> {
    const supabase = await createServiceClient();

    const { data: customer, error } = await (supabase
      .from("customers") as any)
      .insert({
        tenant_id: data.tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        country: data.country,
        language: data.language || "ko",
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return customer;
  },

  async findOrCreateCustomer(data: {
    tenantId: string;
    channelAccountId: string;
    channelUserId: string;
    channelUsername?: string;
    name?: string;
    country?: string;
    language?: string;
    profileImageUrl?: string;
  }): Promise<{ customer: Customer; customerChannel: CustomerChannel; isNew: boolean }> {
    const supabase = await createServiceClient();

    // Check if customer channel already exists
    const { data: existingChannel } = await (supabase
      .from("customer_channels") as any)
      .select(
        `
        *,
        customer:customers(*)
      `
      )
      .eq("channel_account_id", data.channelAccountId)
      .eq("channel_user_id", data.channelUserId)
      .single();

    if (existingChannel) {
      return {
        customer: (existingChannel as unknown as { customer: Customer }).customer,
        customerChannel: existingChannel as CustomerChannel,
        isNew: false,
      };
    }

    // Create new customer
    const { data: newCustomer, error: customerError } = await (supabase
      .from("customers") as any)
      .insert({
        tenant_id: data.tenantId,
        name: data.name || data.channelUsername,
        country: data.country,
        language: data.language || "ko",
        profile_image_url: data.profileImageUrl,
      })
      .select()
      .single();

    if (customerError) throw customerError;

    // Create customer channel
    const { data: newChannel, error: channelError } = await (supabase
      .from("customer_channels") as any)
      .insert({
        customer_id: newCustomer.id,
        channel_account_id: data.channelAccountId,
        channel_user_id: data.channelUserId,
        channel_username: data.channelUsername,
        is_primary: true,
      })
      .select()
      .single();

    if (channelError) throw channelError;

    return {
      customer: newCustomer,
      customerChannel: newChannel,
      isNew: true,
    };
  },

  async linkCustomerChannel(data: {
    customerId: string;
    channelAccountId: string;
    channelUserId: string;
    channelUsername?: string;
  }): Promise<CustomerChannel> {
    const supabase = await createServiceClient();

    const { data: channel, error } = await (supabase
      .from("customer_channels") as any)
      .insert({
        customer_id: data.customerId,
        channel_account_id: data.channelAccountId,
        channel_user_id: data.channelUserId,
        channel_username: data.channelUsername,
        is_primary: false,
      })
      .select()
      .single();

    if (error) throw error;

    return channel;
  },

  async mergeCustomers(
    primaryCustomerId: string,
    secondaryCustomerId: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    // Move all channels from secondary to primary
    await (supabase
      .from("customer_channels") as any)
      .update({ customer_id: primaryCustomerId, is_primary: false })
      .eq("customer_id", secondaryCustomerId);

    // Move all conversations from secondary to primary
    await (supabase
      .from("conversations") as any)
      .update({ customer_id: primaryCustomerId })
      .eq("customer_id", secondaryCustomerId);

    // Move all bookings from secondary to primary
    await (supabase
      .from("bookings") as any)
      .update({ customer_id: primaryCustomerId })
      .eq("customer_id", secondaryCustomerId);

    // Delete secondary customer
    await (supabase.from("customers") as any).delete().eq("id", secondaryCustomerId);
  },

  /**
   * Get comprehensive customer profile with all related data
   */
  async getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    const supabase = await createServiceClient();

    // Get customer with channels
    const { data: customer, error: customerError } = await (supabase
      .from("customers") as any)
      .select(`
        *,
        customer_channels(
          *,
          channel_account:channel_accounts(
            channel_type,
            account_name
          )
        )
      `)
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return null;
    }

    // Get conversations
    const { data: conversations } = await (supabase
      .from("conversations") as any)
      .select("*")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false });

    // Get bookings
    const { data: bookings } = await (supabase
      .from("bookings") as any)
      .select("*")
      .eq("customer_id", customerId)
      .order("booking_date", { ascending: false });

    // Get message stats
    const conversationIds = (conversations || []).map((c: Conversation) => c.id);
    let messageStats = { count: 0, firstAt: null as string | null, lastAt: null as string | null };

    if (conversationIds.length > 0) {
      const { data: messages } = await (supabase
        .from("messages") as any)
        .select("id, created_at, direction")
        .in("conversation_id", conversationIds)
        .eq("direction", "inbound")
        .order("created_at", { ascending: true });

      if (messages && messages.length > 0) {
        messageStats = {
          count: messages.length,
          firstAt: messages[0].created_at,
          lastAt: messages[messages.length - 1].created_at,
        };
      }
    }

    // Calculate preferred channel
    const channelCounts: Record<string, number> = {};
    for (const cc of customer.customer_channels || []) {
      const channelType = cc.channel_account?.channel_type;
      if (channelType) {
        channelCounts[channelType] = (channelCounts[channelType] || 0) + 1;
      }
    }
    const preferredChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ChannelType | undefined;

    // Build stats
    const stats: CustomerStats = {
      totalMessages: messageStats.count,
      totalConversations: (conversations || []).length,
      totalBookings: (bookings || []).length,
      completedBookings: (bookings || []).filter((b: Booking) => b.status === "completed").length,
      cancelledBookings: (bookings || []).filter((b: Booking) => b.status === "cancelled").length,
      avgResponseTime: 0, // TODO: Calculate from message timestamps
      lastContactAt: messageStats.lastAt,
      firstContactAt: messageStats.firstAt,
      preferredChannel: preferredChannel || null,
      preferredLanguage: customer.language,
    };

    // Build timeline
    const timeline = await this.getCustomerTimeline(customerId);

    return {
      ...customer,
      conversations: conversations || [],
      bookings: bookings || [],
      stats,
      timeline,
    } as CustomerProfile;
  },

  /**
   * Get customer timeline events
   */
  async getCustomerTimeline(customerId: string, limit: number = 50): Promise<CustomerTimelineEvent[]> {
    const supabase = await createServiceClient();
    const events: CustomerTimelineEvent[] = [];

    // Get conversations
    const { data: conversations } = await (supabase
      .from("conversations") as any)
      .select("id, status, created_at, updated_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const conv of conversations || []) {
      events.push({
        id: `conv-${conv.id}`,
        type: "conversation",
        title: "대화 시작",
        description: `상태: ${conv.status}`,
        createdAt: conv.created_at,
      });
    }

    // Get recent messages
    const conversationIds = (conversations || []).map((c: Conversation) => c.id);
    if (conversationIds.length > 0) {
      const { data: messages } = await (supabase
        .from("messages") as any)
        .select(`
          id,
          content,
          direction,
          sender_type,
          created_at,
          customer_channel:customer_channels(
            channel_account:channel_accounts(channel_type)
          )
        `)
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const msg of messages || []) {
        const channelType = (msg.customer_channel as any)?.channel_account?.channel_type;
        events.push({
          id: `msg-${msg.id}`,
          type: "message",
          title: msg.direction === "inbound" ? "고객 메시지" : `${msg.sender_type === "ai" ? "AI" : "상담원"} 응답`,
          description: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? "..." : ""),
          channelType,
          createdAt: msg.created_at,
        });
      }
    }

    // Get bookings
    const { data: bookings } = await (supabase
      .from("bookings") as any)
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const booking of bookings || []) {
      events.push({
        id: `booking-${booking.id}`,
        type: "booking",
        title: "예약 " + (booking.status === "confirmed" ? "확정" : booking.status === "cancelled" ? "취소" : "생성"),
        description: `${booking.booking_date} ${booking.service_type || ""}`,
        metadata: { status: booking.status },
        createdAt: booking.created_at,
      });
    }

    // Get escalations
    if (conversationIds.length > 0) {
      const { data: escalations } = await (supabase
        .from("escalations") as any)
        .select("id, reason, priority, status, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const esc of escalations || []) {
        events.push({
          id: `esc-${esc.id}`,
          type: "escalation",
          title: `에스컬레이션 (${esc.priority})`,
          description: esc.reason,
          metadata: { status: esc.status },
          createdAt: esc.created_at,
        });
      }
    }

    // Sort by date descending
    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return events.slice(0, limit);
  },

  /**
   * Update customer profile from channel data
   */
  async updateCustomerFromChannel(
    customerId: string,
    channelData: {
      name?: string;
      phone?: string;
      email?: string;
      country?: string;
      language?: string;
      profileImageUrl?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Customer> {
    const supabase = await createServiceClient();

    // Get current customer
    const { data: currentCustomer } = await (supabase
      .from("customers") as any)
      .select("*")
      .eq("id", customerId)
      .single();

    if (!currentCustomer) {
      throw new Error("Customer not found");
    }

    // Merge metadata
    const mergedMetadata = {
      ...((currentCustomer.metadata as Record<string, unknown>) || {}),
      ...(channelData.metadata || {}),
    };

    // Only update fields that are not already set
    const updates: Partial<Customer> = {
      metadata: mergedMetadata as any,
    };

    if (!currentCustomer.name && channelData.name) {
      updates.name = channelData.name;
    }
    if (!currentCustomer.phone && channelData.phone) {
      updates.phone = channelData.phone;
    }
    if (!currentCustomer.email && channelData.email) {
      updates.email = channelData.email;
    }
    if (!currentCustomer.country && channelData.country) {
      updates.country = channelData.country;
    }
    if (!currentCustomer.language && channelData.language) {
      updates.language = channelData.language;
    }
    if (!currentCustomer.profile_image_url && channelData.profileImageUrl) {
      updates.profile_image_url = channelData.profileImageUrl;
    }

    const { data: updatedCustomer, error } = await (supabase
      .from("customers") as any)
      .update(updates)
      .eq("id", customerId)
      .select()
      .single();

    if (error) throw error;

    return updatedCustomer;
  },

  /**
   * Sync customer with CRM
   */
  async syncWithCRM(customerId: string): Promise<Customer> {
    const supabase = await createServiceClient();

    // Get customer
    const { data: customer, error } = await (supabase
      .from("customers") as any)
      .select("*, tenant:tenants(*)")
      .eq("id", customerId)
      .single();

    if (error || !customer) {
      throw new Error("Customer not found");
    }

    // Check if CRM is configured
    const crmConfig = process.env.CRM_API_BASE_URL;
    if (!crmConfig) {
      console.log("CRM not configured, skipping sync");
      return customer;
    }

    // If customer has CRM ID, fetch from CRM
    if (customer.crm_customer_id) {
      try {
        const response = await fetch(
          `${crmConfig}/customers/${customer.crm_customer_id}`,
          {
            headers: {
              "Authorization": `Bearer ${process.env.CRM_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const crmData = await response.json();

          // Update local customer with CRM data
          const { data: updated } = await (supabase
            .from("customers") as any)
            .update({
              phone: crmData.phone || customer.phone,
              email: crmData.email || customer.email,
              metadata: {
                ...((customer.metadata as Record<string, unknown>) || {}),
                crm: crmData,
                crmSyncedAt: new Date().toISOString(),
              },
            })
            .eq("id", customerId)
            .select()
            .single();

          return updated;
        }
      } catch (e) {
        console.error("Failed to sync with CRM:", e);
      }
    } else {
      // Create customer in CRM
      try {
        const response = await fetch(`${crmConfig}/customers`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.CRM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            country: customer.country,
            language: customer.language,
            source: "cs_automation",
          }),
        });

        if (response.ok) {
          const crmCustomer = await response.json();

          // Update local customer with CRM ID
          const { data: updated } = await (supabase
            .from("customers") as any)
            .update({
              crm_customer_id: crmCustomer.id,
              metadata: {
                ...((customer.metadata as Record<string, unknown>) || {}),
                crm: crmCustomer,
                crmSyncedAt: new Date().toISOString(),
              },
            })
            .eq("id", customerId)
            .select()
            .single();

          return updated;
        }
      } catch (e) {
        console.error("Failed to create customer in CRM:", e);
      }
    }

    return customer;
  },

  /**
   * Find potential duplicate customers
   */
  async findDuplicates(customerId: string): Promise<Customer[]> {
    const supabase = await createServiceClient();

    // Get customer
    const { data: customer } = await (supabase
      .from("customers") as any)
      .select("*")
      .eq("id", customerId)
      .single();

    if (!customer) {
      return [];
    }

    // Find potential duplicates by phone or email
    let query = (supabase.from("customers") as any)
      .select("*")
      .eq("tenant_id", customer.tenant_id)
      .neq("id", customerId);

    const conditions: string[] = [];
    if (customer.phone) {
      conditions.push(`phone.eq.${customer.phone}`);
    }
    if (customer.email) {
      conditions.push(`email.eq.${customer.email}`);
    }
    if (customer.name) {
      conditions.push(`name.ilike.${customer.name}`);
    }

    if (conditions.length === 0) {
      return [];
    }

    query = query.or(conditions.join(","));

    const { data: duplicates } = await query;

    return duplicates || [];
  },
};
