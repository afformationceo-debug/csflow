import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Force dynamic - no caching for real-time data
export const dynamic = "force-dynamic";

// Channel display configuration
const channelDisplayMap: Record<string, { label: string; color: string }> = {
  line: { label: "LINE", color: "bg-[#06C755]" },
  kakao: { label: "카카오톡", color: "bg-[#FEE500]" },
  facebook: { label: "Facebook", color: "bg-[#1877F2]" },
  instagram: {
    label: "Instagram",
    color: "bg-gradient-to-r from-[#f09433] to-[#bc1888]",
  },
  whatsapp: { label: "WhatsApp", color: "bg-[#25D366]" },
  wechat: { label: "WeChat", color: "bg-[#07C160]" },
};

/**
 * GET /api/settings
 * 현재 설정 조회 (첫 번째 거래처 기준)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId");

    let query = (supabase as any).from("tenants").select("*");

    if (tenantId) {
      query = query.eq("id", tenantId).single();
    } else {
      query = query.limit(1).single();
    }

    const { data: tenant, error } = await query;

    if (error) {
      console.error("Settings fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 채널 수 조회
    const { data: channels } = await (supabase as any)
      .from("channel_accounts")
      .select("channel_type, is_active")
      .eq("tenant_id", tenant.id);

    const channelSummary: Record<string, { total: number; active: number }> =
      {};
    (channels || []).forEach((ch: any) => {
      if (!channelSummary[ch.channel_type]) {
        channelSummary[ch.channel_type] = { total: 0, active: 0 };
      }
      channelSummary[ch.channel_type].total++;
      if (ch.is_active) channelSummary[ch.channel_type].active++;
    });

    // Build channel array for the UI
    const channelArray = Object.entries(channelSummary).map(
      ([type, counts]) => {
        const display = channelDisplayMap[type] || {
          label: type,
          color: "bg-gray-500",
        };
        return {
          type: display.label,
          channelType: type,
          count: counts.total,
          active: counts.active > 0,
          color: display.color,
        };
      }
    );

    // Merge tenant.settings and tenant.ai_config into a flat settings object
    const tenantSettings = tenant.settings || {};
    const aiConfig = tenant.ai_config || {};

    return NextResponse.json({
      settings: {
        tenantId: tenant.id,
        platformName: tenantSettings.platformName ?? tenant.display_name ?? tenant.name ?? "CS Command Center",
        defaultLanguage: tenantSettings.defaultLanguage ?? "ko",
        timezone: tenantSettings.timezone ?? "Asia/Seoul",
        darkMode: tenantSettings.darkMode ?? true,
        emailNotification: tenantSettings.emailNotification ?? true,
        browserNotification: tenantSettings.browserNotification ?? true,
        soundNotification: tenantSettings.soundNotification ?? false,
        ai: {
          model: aiConfig.model ?? aiConfig.defaultModel ?? "gpt-4",
          confidenceThreshold: aiConfig.confidenceThreshold ?? 75,
          maxResponseLength: aiConfig.maxResponseLength ?? 500,
          autoResponseEnabled: aiConfig.autoResponseEnabled ?? true,
          systemPrompt:
            aiConfig.systemPrompt ??
            "당신은 해외환자유치 CS 전문 상담사입니다. 고객의 문의에 친절하고 정확하게 답변해 주세요. 의료 관련 질문은 전문 상담사에게 연결하고, 가격/예약 관련 문의는 지식베이스를 참고하여 답변합니다.",
          escalationKeywords: aiConfig.escalationKeywords ?? [
            "불만",
            "환불",
            "소송",
            "위험",
            "부작용",
            "사고",
          ],
          forbiddenTopics: aiConfig.forbiddenTopics ?? [
            "정치",
            "종교",
            "경쟁사 비방",
            "보험 사기",
          ],
        },
        translation: {
          deeplConnected: tenantSettings.deeplConnected ?? !!process.env.DEEPL_API_KEY,
          autoTranslation: tenantSettings.autoTranslation ?? true,
          defaultDirection: tenantSettings.defaultTranslationDirection ?? "ko-en",
          supportedLanguages: tenantSettings.supportedLanguages ?? [
            { code: "ko", name: "한국어", enabled: true },
            { code: "en", name: "English", enabled: true },
            { code: "ja", name: "日本語", enabled: true },
            { code: "zh", name: "中文", enabled: true },
            { code: "vi", name: "Tiếng Việt", enabled: true },
            { code: "th", name: "ภาษาไทย", enabled: false },
            { code: "ru", name: "Русский", enabled: false },
          ],
        },
        notifications: {
          slackConnected: tenantSettings.slackConnected ?? !!process.env.SLACK_BOT_TOKEN,
          slackToken: tenantSettings.slackToken
            ? `${tenantSettings.slackToken.substring(0, 4)}-****-****-****-${tenantSettings.slackToken.slice(-6)}`
            : process.env.SLACK_BOT_TOKEN
              ? "xoxb-****-****-****-configured"
              : "",
          slackDefaultChannel: tenantSettings.slackDefaultChannel ?? "#cs-alerts",
          escalationAlert: tenantSettings.escalationAlert ?? true,
          bookingConfirmAlert: tenantSettings.bookingConfirmAlert ?? true,
          noResponseAlert: tenantSettings.noResponseAlert ?? true,
          noResponseThreshold: tenantSettings.noResponseThreshold ?? 24,
        },
      },
      channels: channelArray,
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * 거래처 설정 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    // Accept tenantId from body or resolve the first tenant
    let tenantId = body.tenantId;

    if (!tenantId) {
      // Try to get the first tenant
      const { data: firstTenant } = await (supabase as any)
        .from("tenants")
        .select("id")
        .limit(1)
        .single();

      if (firstTenant) {
        tenantId = firstTenant.id;
      } else {
        return NextResponse.json(
          { error: "No tenant found" },
          { status: 404 }
        );
      }
    }

    // First, get current settings and ai_config so we merge rather than overwrite
    const { data: currentTenant, error: fetchError } = await (supabase as any)
      .from("tenants")
      .select("settings, ai_config")
      .eq("id", tenantId)
      .single();

    if (fetchError) {
      console.error("Settings fetch for merge error:", fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    const currentSettings = currentTenant?.settings || {};
    const currentAiConfig = currentTenant?.ai_config || {};

    // Build merged settings
    const mergedSettings = {
      ...currentSettings,
      ...(body.platformName !== undefined && {
        platformName: body.platformName,
      }),
      ...(body.defaultLanguage !== undefined && {
        defaultLanguage: body.defaultLanguage,
      }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.darkMode !== undefined && { darkMode: body.darkMode }),
      ...(body.emailNotification !== undefined && {
        emailNotification: body.emailNotification,
      }),
      ...(body.browserNotification !== undefined && {
        browserNotification: body.browserNotification,
      }),
      ...(body.soundNotification !== undefined && {
        soundNotification: body.soundNotification,
      }),
      // Translation settings
      ...(body.translation && {
        autoTranslation: body.translation.autoTranslation ?? currentSettings.autoTranslation,
        defaultTranslationDirection: body.translation.defaultDirection ?? currentSettings.defaultTranslationDirection,
        supportedLanguages: body.translation.supportedLanguages ?? currentSettings.supportedLanguages,
      }),
      // Notification settings
      ...(body.notifications && {
        slackDefaultChannel: body.notifications.slackDefaultChannel ?? currentSettings.slackDefaultChannel,
        escalationAlert: body.notifications.escalationAlert ?? currentSettings.escalationAlert,
        bookingConfirmAlert: body.notifications.bookingConfirmAlert ?? currentSettings.bookingConfirmAlert,
        noResponseAlert: body.notifications.noResponseAlert ?? currentSettings.noResponseAlert,
        noResponseThreshold: body.notifications.noResponseThreshold ?? currentSettings.noResponseThreshold,
      }),
    };

    // Build merged AI config
    const mergedAiConfig = {
      ...currentAiConfig,
      ...(body.ai && {
        model: body.ai.model ?? currentAiConfig.model,
        confidenceThreshold: body.ai.confidenceThreshold ?? currentAiConfig.confidenceThreshold,
        maxResponseLength: body.ai.maxResponseLength ?? currentAiConfig.maxResponseLength,
        autoResponseEnabled: body.ai.autoResponseEnabled ?? currentAiConfig.autoResponseEnabled,
        systemPrompt: body.ai.systemPrompt ?? currentAiConfig.systemPrompt,
        escalationKeywords: body.ai.escalationKeywords ?? currentAiConfig.escalationKeywords,
        forbiddenTopics: body.ai.forbiddenTopics ?? currentAiConfig.forbiddenTopics,
      }),
    };

    const updateData: Record<string, unknown> = {
      settings: mergedSettings,
      ai_config: mergedAiConfig,
    };

    const { data, error } = await (supabase as any)
      .from("tenants")
      .update(updateData)
      .eq("id", tenantId)
      .select()
      .single();

    if (error) {
      console.error("Settings update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tenant: data });
  } catch (error) {
    console.error("PATCH /api/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
