import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/channels/[id]
 * Update channel account information
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tenantId, accountName, isActive } = body;

    if (!tenantId || !accountName) {
      return NextResponse.json(
        { error: "tenantId and accountName are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Update channel account
    const { data, error } = await (supabase as any)
      .from("channel_accounts")
      .update({
        tenant_id: tenantId,
        account_name: accountName,
        is_active: isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Channel update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ channel: data });
  } catch (error) {
    console.error("PATCH /api/channels/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
