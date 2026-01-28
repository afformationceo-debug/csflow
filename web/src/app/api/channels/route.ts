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

    // Query channel_accounts directly from Supabase
    const supabase = await createServiceClient();

    // Resolve tenant ID (demo-tenant-id may not be a real UUID)
    let resolvedTenantId = tenantId;
    const { data: existingTenant } = await (supabase as any)
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (!existingTenant) {
      // Use the first available tenant
      const { data: anyTenant } = await (supabase as any)
        .from("tenants")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (anyTenant) resolvedTenantId = anyTenant.id;
    }

    const { data: dbChannels, error } = await (supabase as any)
      .from("channel_accounts")
      .select("*")
      .eq("tenant_id", resolvedTenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("DB channel fetch error:", error);
      // Fallback to meta OAuth service
      const channels = await metaOAuthService.getConnectedChannels(tenantId);
      return NextResponse.json({ channels });
    }

    const channels = (dbChannels || []).map((ch: Record<string, unknown>) => ({
      id: ch.id,
      channelType: ch.channel_type,
      accountName: ch.account_name,
      accountId: ch.account_id,
      isActive: ch.is_active,
      webhookUrl: ch.webhook_url,
      messageCount: 0,
      lastActiveAt: "-",
      createdAt: ch.created_at,
    }));

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
    const body = await request.json();
    const {
      tenantId,
      channelType,
      accountName,
      accountId,
      credentials,
      // Meta OAuth fields
      sessionId,
      pageAccessToken,
      systemUserAccessToken,
    } = body;

    if (!tenantId || !channelType) {
      return NextResponse.json(
        { error: "tenantId and channelType are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Ensure tenant exists (auto-create default tenant if needed)
    let resolvedTenantId = tenantId;
    const { data: existingTenant } = await (supabase as any)
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (!existingTenant) {
      // Try to find any existing tenant
      const { data: anyTenant } = await (supabase as any)
        .from("tenants")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (anyTenant) {
        resolvedTenantId = anyTenant.id;
      } else {
        // Create a default tenant
        const { data: newTenant, error: tenantError } = await (supabase as any)
          .from("tenants")
          .insert({
            name: "CS Command Center",
            name_en: "CS Command Center",
            specialty: "general",
            settings: {},
            ai_config: { enabled: true, model: "gpt-4", confidence_threshold: 0.75 },
          })
          .select("id")
          .single();

        if (tenantError) {
          console.error("Tenant creation error:", tenantError);
          return NextResponse.json(
            { error: "기본 거래처 생성 실패" },
            { status: 500 }
          );
        }
        resolvedTenantId = newTenant.id;
      }
    }

    // ── Direct credential-based channels (LINE, KakaoTalk, WeChat) ──
    const directChannelTypes = ["line", "kakao", "wechat"];
    if (directChannelTypes.includes(channelType)) {
      if (!accountName || !accountId) {
        return NextResponse.json(
          { error: "accountName and accountId are required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const { data: existing } = await (supabase as any)
        .from("channel_accounts")
        .select("id")
        .eq("tenant_id", resolvedTenantId)
        .eq("channel_type", channelType)
        .eq("account_id", accountId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "이미 등록된 채널입니다" },
          { status: 409 }
        );
      }

      const webhookBase = process.env.NEXT_PUBLIC_APP_URL || "https://csflow.vercel.app";
      const webhookPaths: Record<string, string> = {
        line: "/api/webhooks/line",
        kakao: "/api/webhooks/kakao",
        wechat: "/api/webhooks/wechat",
      };

      const { data: newChannel, error: insertError } = await (supabase as any)
        .from("channel_accounts")
        .insert({
          tenant_id: resolvedTenantId,
          channel_type: channelType,
          account_name: accountName,
          account_id: accountId,
          credentials: credentials || {},
          is_active: true,
          webhook_url: `${webhookBase}${webhookPaths[channelType]}`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Channel insert error:", insertError);
        return NextResponse.json(
          { error: "채널 등록 실패: " + insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        channel: {
          id: newChannel.id,
          channelType: newChannel.channel_type,
          accountName: newChannel.account_name,
          accountId: newChannel.account_id,
          isActive: newChannel.is_active,
          webhookUrl: newChannel.webhook_url,
          messageCount: 0,
          lastActiveAt: "방금 전",
          createdAt: newChannel.created_at,
        },
      });
    }

    // ── Meta OAuth-based channels (Facebook, Instagram, WhatsApp) ──
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

        await metaOAuthService.subscribeToWebhook(
          page.id,
          page.access_token,
          ["messages", "messaging_postbacks", "message_reads"]
        );
        break;
      }

      case "instagram": {
        const igAccounts =
          await metaOAuthService.getInstagramAccounts(accessToken);
        const igAccount = igAccounts.find((a) => a.id === accountId);

        if (!igAccount) {
          return NextResponse.json(
            { error: "Instagram account not found" },
            { status: 404 }
          );
        }

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
    const channelId = searchParams.get("channelId");
    const tenantId = searchParams.get("tenantId");
    const channelType = searchParams.get("channelType");
    const accountId = searchParams.get("accountId");

    const supabase = await createServiceClient();

    // Support deletion by channel UUID
    if (channelId) {
      const { error } = await (supabase as any)
        .from("channel_accounts")
        .delete()
        .eq("id", channelId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Legacy: deletion by tenantId + channelType + accountId
    if (!tenantId || !channelType || !accountId) {
      return NextResponse.json(
        { error: "channelId or (tenantId, channelType, accountId) required" },
        { status: 400 }
      );
    }

    // For Meta channels, use OAuth service
    const metaTypes = ["facebook", "instagram", "whatsapp"];
    if (metaTypes.includes(channelType)) {
      await metaOAuthService.disconnectChannel(
        tenantId,
        channelType as "facebook" | "instagram" | "whatsapp",
        accountId
      );
    } else {
      // Direct deletion for LINE, KakaoTalk, WeChat
      const { error } = await (supabase as any)
        .from("channel_accounts")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("channel_type", channelType)
        .eq("account_id", accountId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect channel:", error);
    return NextResponse.json(
      { error: "Failed to disconnect channel" },
      { status: 500 }
    );
  }
}
