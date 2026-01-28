import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations
 * Fetch conversations with customer info, channel info, and tenant info.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // Fetch conversations with related data
    // Note: customer_channels doesn't have a direct FK to conversations,
    // so we fetch conversations + customer first, then enrich with channel data
    const { data: conversations, error } = await (supabase as any)
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
              tenant:tenants(id, name, display_name, specialty)
            )
          )
        )
      `)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) {
      console.error("Conversations fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
