import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation and its messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // Delete messages first (FK constraint)
    await (supabase as any)
      .from("messages")
      .delete()
      .eq("conversation_id", id);

    // Delete the conversation
    const { error } = await (supabase as any)
      .from("conversations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Conversation delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/conversations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
