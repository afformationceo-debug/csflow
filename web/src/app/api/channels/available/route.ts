import { NextRequest, NextResponse } from "next/server";
import { metaOAuthService } from "@/services/meta-oauth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Get available channels for connection from OAuth session
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get OAuth session
    const { data: sessionData, error: sessionError } = await supabase
      .from("oauth_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404 }
      );
    }

    // Type the session data
    const session = sessionData as {
      id: string;
      tenant_id: string;
      access_token: string;
      expires_at: string;
    };

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("oauth_sessions").delete().eq("id", sessionId);
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Get available channels
    const availableChannels = await metaOAuthService.getAvailableChannels(
      session.access_token
    );

    // Get already connected channels for this tenant
    const connectedChannels = await metaOAuthService.getConnectedChannels(
      session.tenant_id
    );
    const connectedIds = new Set(
      connectedChannels.map((c) => `${c.channelType}:${c.accountId}`)
    );

    // Mark which channels are already connected
    const channelsWithStatus = {
      facebook: availableChannels.facebook.map((page) => ({
        ...page,
        isConnected: connectedIds.has(`facebook:${page.id}`),
      })),
      instagram: availableChannels.instagram.map((account) => ({
        ...account,
        isConnected: connectedIds.has(`instagram:${account.id}`),
      })),
      whatsapp: availableChannels.whatsapp.flatMap((waba) =>
        (waba.phone_numbers?.data || []).map((phone) => ({
          id: phone.id,
          wabaId: waba.id,
          wabaName: waba.name,
          phoneNumber: phone.display_phone_number,
          verifiedName: phone.verified_name,
          qualityRating: phone.quality_rating,
          isConnected: connectedIds.has(`whatsapp:${phone.id}`),
        }))
      ),
    };

    return NextResponse.json({
      channels: channelsWithStatus,
      tenantId: session.tenant_id,
    });
  } catch (error) {
    console.error("Failed to get available channels:", error);
    return NextResponse.json(
      { error: "Failed to get available channels" },
      { status: 500 }
    );
  }
}
