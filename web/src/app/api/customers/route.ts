import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Force dynamic - no caching for real-time data
export const dynamic = "force-dynamic";

/**
 * GET /api/customers
 * Fetch all customers with stats, channels, and conversation info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");

    // Base query with related data
    let query = (supabase as any)
      .from("customers")
      .select(`
        id,
        name,
        country,
        language,
        profile_image_url,
        tags,
        metadata,
        created_at,
        updated_at,
        customer_channels(
          id,
          channel_user_id,
          channel_username,
          channel_account:channel_accounts(
            id,
            channel_type,
            account_name
          )
        )
      `)
      .order("created_at", { ascending: false });

    const { data: customers, error } = await query;

    if (error) {
      console.error("Customers fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch conversation counts and latest conversation for each customer
    const customerIds = customers?.map((c: any) => c.id) || [];
    const { data: conversationData } = await (supabase as any)
      .from("conversations")
      .select("id, customer_id, created_at, last_message_at")
      .in("customer_id", customerIds);

    // Fetch message counts for each customer
    const conversationIds = conversationData?.map((c: any) => c.id) || [];
    const { data: messageData } = await (supabase as any)
      .from("messages")
      .select("conversation_id, direction")
      .in("conversation_id", conversationIds);

    // Build stats map
    const statsMap = new Map<string, {
      totalConversations: number;
      totalMessages: number;
      inboundMessages: number;
      outboundMessages: number;
      firstContact: string;
      lastContact: string;
    }>();

    customerIds.forEach((customerId: string) => {
      const customerConvs = conversationData?.filter((c: any) => c.customer_id === customerId) || [];
      const customerConvIds = customerConvs.map((c: any) => c.id);
      const customerMessages = messageData?.filter((m: any) => customerConvIds.includes(m.conversation_id)) || [];

      const sortedConvs = customerConvs.sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const sortedByLastMsg = customerConvs.sort((a: any, b: any) =>
        new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime()
      );

      statsMap.set(customerId, {
        totalConversations: customerConvs.length,
        totalMessages: customerMessages.length,
        inboundMessages: customerMessages.filter((m: any) => m.direction === "inbound").length,
        outboundMessages: customerMessages.filter((m: any) => m.direction === "outbound").length,
        firstContact: sortedConvs[0]?.created_at || new Date().toISOString(),
        lastContact: sortedByLastMsg[0]?.last_message_at || sortedByLastMsg[0]?.created_at || new Date().toISOString(),
      });
    });

    // Enrich customers with stats
    const enrichedCustomers = customers?.map((customer: any) => {
      const stats = statsMap.get(customer.id) || {
        totalConversations: 0,
        totalMessages: 0,
        inboundMessages: 0,
        outboundMessages: 0,
        firstContact: customer.created_at,
        lastContact: customer.created_at,
      };

      // Extract tags by category
      const consultationTag = customer.tags?.find((t: string) => t.startsWith("consultation:"))?.replace("consultation:", "") || null;
      const customerTags = customer.tags?.filter((t: string) => t.startsWith("customer:")).map((t: string) => t.replace("customer:", "")) || [];
      const typeTags = customer.tags?.filter((t: string) => t.startsWith("type:")).map((t: string) => t.replace("type:", "")) || [];

      // Extract metadata
      const interestedProcedures = customer.metadata?.interested_procedures || [];
      const concerns = customer.metadata?.concerns || [];
      const memo = customer.metadata?.memo || "";
      const bookingStatus = customer.metadata?.booking_status || "none";

      return {
        ...customer,
        stats,
        consultationTag,
        customerTags,
        typeTags,
        interestedProcedures,
        concerns,
        memo,
        bookingStatus,
      };
    }) || [];

    // Apply filters
    let results = enrichedCustomers;

    // Search filter
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.language?.toLowerCase().includes(q) ||
        c.memo?.toLowerCase().includes(q) ||
        c.interestedProcedures?.some((p: string) => p.toLowerCase().includes(q)) ||
        c.concerns?.some((concern: string) => concern.toLowerCase().includes(q))
      );
    }

    // Tag filter
    if (tag && tag.trim()) {
      results = results.filter((c: any) =>
        c.tags?.includes(tag) ||
        c.consultationTag === tag ||
        c.customerTags?.includes(tag) ||
        c.typeTags?.includes(tag)
      );
    }

    return NextResponse.json({ customers: results });
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
