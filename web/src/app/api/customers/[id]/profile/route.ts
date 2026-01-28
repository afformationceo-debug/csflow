import { NextRequest, NextResponse } from "next/server";
import { serverCustomerService } from "@/services/customers";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Get comprehensive customer profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // Get customer data directly
    const { data: customer, error: custError } = await (supabase as any)
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (custError || !customer) {
      // Fallback to service
      const profile = await serverCustomerService.getCustomerProfile(id);
      if (!profile) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      return NextResponse.json(profile);
    }

    // Count total conversations for this customer
    const { count, error: countError } = await (supabase as any)
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id);

    if (countError) {
      console.error("[Profile API] Count error:", countError);
    }

    console.log("[Profile API] Customer:", id, "Total conversations:", count);

    return NextResponse.json({
      ...customer,
      totalConversations: count || 0,
    });
  } catch (error) {
    console.error("Failed to get customer profile:", error);
    return NextResponse.json(
      { error: "Failed to get customer profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customers/[id]/profile
 * Update customer tags and metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tags, metadata } = body;

    const supabase = await createServiceClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (tags !== undefined) {
      updateData.tags = tags;
    }

    if (metadata !== undefined) {
      // Merge metadata instead of replacing
      const { data: existing } = await (supabase as any)
        .from("customers")
        .select("metadata")
        .eq("id", id)
        .single();

      updateData.metadata = {
        ...(existing?.metadata || {}),
        ...metadata,
      };
    }

    const { data, error } = await (supabase as any)
      .from("customers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Customer update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (error) {
    console.error("PATCH /api/customers/[id]/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
