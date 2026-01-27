import { NextRequest, NextResponse } from "next/server";
import { metaOAuthService } from "@/services/meta-oauth";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Get connected channels for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    const channels = await metaOAuthService.getConnectedChannels(tenantId);

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Failed to get channels:", error);
    return NextResponse.json(
      { error: "Failed to get channels" },
      { status: 500 }
    );
  }
}

/**
 * Connect a new channel
 */
export async function POST(request: NextRequest) {
  try {
    const {
      tenantId,
      channelType,
      sessionId,
      accountId,
      pageAccessToken,
      systemUserAccessToken,
    } = await request.json();

    if (!tenantId || !channelType) {
      return NextResponse.json(
        { error: "tenantId and channelType are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get OAuth session if sessionId provided
    let accessToken = pageAccessToken || systemUserAccessToken;

    if (sessionId) {
      const { data: sessionData } = await supabase
        .from("oauth_sessions")
        .select("access_token")
        .eq("id", sessionId)
        .single();

      if (sessionData) {
        const session = sessionData as { access_token: string };
        accessToken = session.access_token;
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 400 }
      );
    }

    let connectedChannel;

    switch (channelType) {
      case "facebook": {
        // Get page details
        const pages = await metaOAuthService.getFacebookPages(accessToken);
        const page = pages.find((p) => p.id === accountId);

        if (!page) {
          return NextResponse.json(
            { error: "Facebook page not found" },
            { status: 404 }
          );
        }

        connectedChannel = await metaOAuthService.connectFacebookPage(
          tenantId,
          page
        );

        // Subscribe to webhook
        await metaOAuthService.subscribeToWebhook(
          page.id,
          page.access_token,
          ["messages", "messaging_postbacks", "message_reads"]
        );
        break;
      }

      case "instagram": {
        // Get Instagram account details
        const igAccounts =
          await metaOAuthService.getInstagramAccounts(accessToken);
        const igAccount = igAccounts.find((a) => a.id === accountId);

        if (!igAccount) {
          return NextResponse.json(
            { error: "Instagram account not found" },
            { status: 404 }
          );
        }

        // Need page access token for Instagram
        const pages = await metaOAuthService.getFacebookPages(accessToken);
        const linkedPage = pages.find(
          (p) => p.instagram_business_account?.id === accountId
        );

        if (!linkedPage) {
          return NextResponse.json(
            { error: "Linked Facebook page not found" },
            { status: 404 }
          );
        }

        connectedChannel = await metaOAuthService.connectInstagramAccount(
          tenantId,
          igAccount,
          linkedPage.access_token
        );

        // Subscribe to webhook
        await metaOAuthService.subscribeToWebhook(
          linkedPage.id,
          linkedPage.access_token,
          ["messages", "messaging_postbacks"]
        );
        break;
      }

      case "whatsapp": {
        if (!systemUserAccessToken) {
          return NextResponse.json(
            { error: "System user access token required for WhatsApp" },
            { status: 400 }
          );
        }

        // Get WhatsApp accounts
        const wabaAccounts =
          await metaOAuthService.getWhatsAppBusinessAccounts(accessToken);
        const waba = wabaAccounts.find((a) =>
          a.phone_numbers?.data?.some((p) => p.id === accountId)
        );

        if (!waba) {
          return NextResponse.json(
            { error: "WhatsApp Business account not found" },
            { status: 404 }
          );
        }

        connectedChannel = await metaOAuthService.connectWhatsAppAccount(
          tenantId,
          waba,
          accountId,
          systemUserAccessToken
        );
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported channel type" },
          { status: 400 }
        );
    }

    // Clean up OAuth session
    if (sessionId) {
      await supabase.from("oauth_sessions").delete().eq("id", sessionId);
    }

    return NextResponse.json({ channel: connectedChannel });
  } catch (error) {
    console.error("Failed to connect channel:", error);
    return NextResponse.json(
      { error: "Failed to connect channel" },
      { status: 500 }
    );
  }
}

/**
 * Update channel settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const { channelId, settings } = await request.json();

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const updateData: Database["public"]["Tables"]["channel_accounts"]["Update"] = {
      ...settings,
      updated_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("channel_accounts")
      .update(updateData)
      .eq("id", channelId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ channel: data });
  } catch (error) {
    console.error("Failed to update channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

/**
 * Disconnect a channel
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId");
    const channelType = searchParams.get("channelType") as
      | "facebook"
      | "instagram"
      | "whatsapp";
    const accountId = searchParams.get("accountId");

    if (!tenantId || !channelType || !accountId) {
      return NextResponse.json(
        { error: "tenantId, channelType, and accountId are required" },
        { status: 400 }
      );
    }

    await metaOAuthService.disconnectChannel(tenantId, channelType, accountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect channel:", error);
    return NextResponse.json(
      { error: "Failed to disconnect channel" },
      { status: 500 }
    );
  }
}
