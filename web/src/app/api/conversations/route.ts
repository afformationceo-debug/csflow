import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// 30초 캐시 허용 (클라이언트 + CDN)
export const revalidate = 30;

/**
 * GET /api/conversations
 * Fetch conversations with customer info, channel info, and tenant info.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    // Base query with related data
    let query = (supabase as any)
      .from("conversations")
      .select(`
        *,
        customer:customers(
          id, name, country, language, profile_image_url, tags, metadata,
          customer_channels(
            id,
            channel_user_id,
            channel_username,
            channel_account:channel_accounts(
              id, channel_type, account_name, tenant_id,
              tenant:tenants(*)
            )
          )
        )
      `)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);

    const { data: conversations, error } = await query;

    if (error) {
      console.error("Conversations fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If search param provided, filter in-memory (supports customer name, tenant name)
    let results = conversations || [];
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter((conv: any) => {
        const customer = conv.customer;
        const customerName = customer?.name?.toLowerCase() || "";
        const customerCountry = customer?.country?.toLowerCase() || "";
        const preview = conv.last_message_preview?.toLowerCase() || "";
        const tenant = customer?.customer_channels?.[0]?.channel_account?.tenant;
        const tenantName = tenant?.name?.toLowerCase() || "";
        const tenantDisplayName = tenant?.display_name?.toLowerCase() || "";
        return (
          customerName.includes(q) ||
          customerCountry.includes(q) ||
          preview.includes(q) ||
          tenantName.includes(q) ||
          tenantDisplayName.includes(q)
        );
      });
    }

    return NextResponse.json({ conversations: results });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations
 * Update conversation fields (ai_enabled, status, assigned_to, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, ...updateFields } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Only allow safe fields to be updated
    const allowedFields = ["ai_enabled", "status", "assigned_to", "metadata"];
    const safeUpdate: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updateFields) {
        safeUpdate[key] = updateFields[key];
      }
    }

    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    safeUpdate.updated_at = new Date().toISOString();

    const { data, error } = await (supabase as any)
      .from("conversations")
      .update(safeUpdate)
      .eq("id", conversationId)
      .select()
      .single();

    if (error) {
      console.error("Conversation update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error("PATCH /api/conversations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
