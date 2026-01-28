import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * 대시보드 실시간 통계 데이터 반환
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // 오늘 날짜 범위
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. 대화 통계
    const { count: totalConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true });

    const { count: todayConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart);

    const { count: activeConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .in("status", ["active", "waiting"]);

    const { count: escalatedConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "escalated");

    const { count: resolvedConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved");

    // 2. 메시지 통계
    const { count: totalMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true });

    const { count: todayMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart);

    const { count: aiMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("sender_type", "ai");

    const { count: agentMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("sender_type", "agent");

    // 3. AI 신뢰도 통계
    const { data: aiConfidenceData } = await (supabase as any)
      .from("messages")
      .select("ai_confidence")
      .eq("sender_type", "ai")
      .not("ai_confidence", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const aiConfidences = (aiConfidenceData || [])
      .map((m: { ai_confidence: number }) => m.ai_confidence)
      .filter((c: number) => c > 0);
    const avgAiConfidence = aiConfidences.length > 0
      ? aiConfidences.reduce((a: number, b: number) => a + b, 0) / aiConfidences.length
      : 0;

    // AI 자동응대율 = AI 메시지 / 전체 아웃바운드 메시지
    const { count: totalOutbound } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound");

    const aiRate = totalOutbound && totalOutbound > 0
      ? ((aiMessages || 0) / totalOutbound * 100)
      : 0;

    // 4. 에스컬레이션 통계
    const { count: totalEscalations } = await (supabase as any)
      .from("escalations")
      .select("*", { count: "exact", head: true });

    const { count: pendingEscalations } = await (supabase as any)
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: todayEscalations } = await (supabase as any)
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart);

    // 5. 고객 통계
    const { count: totalCustomers } = await (supabase as any)
      .from("customers")
      .select("*", { count: "exact", head: true });

    const { count: todayCustomers } = await (supabase as any)
      .from("customers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart);

    // 6. 채널별 통계
    const { data: channelAccounts } = await (supabase as any)
      .from("channel_accounts")
      .select("id, channel_type, account_name, is_active, tenant_id");

    // 7. 최근 대화 목록
    const { data: recentConversations } = await (supabase as any)
      .from("conversations")
      .select(`
        id, status, priority, last_message_at, created_at, ai_enabled,
        customer:customers(id, name, country, language, profile_image_url, tags)
      `)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(10);

    // 8. 거래처별 통계
    const { data: tenants } = await (supabase as any)
      .from("tenants")
      .select("id, name, name_en, specialty");

    return NextResponse.json({
      stats: {
        conversations: {
          total: totalConversations || 0,
          today: todayConversations || 0,
          active: activeConversations || 0,
          escalated: escalatedConversations || 0,
          resolved: resolvedConversations || 0,
        },
        messages: {
          total: totalMessages || 0,
          today: todayMessages || 0,
          ai: aiMessages || 0,
          agent: agentMessages || 0,
        },
        ai: {
          avgConfidence: Math.round(avgAiConfidence * 100),
          autoResponseRate: Math.round(aiRate),
        },
        escalations: {
          total: totalEscalations || 0,
          pending: pendingEscalations || 0,
          today: todayEscalations || 0,
        },
        customers: {
          total: totalCustomers || 0,
          today: todayCustomers || 0,
        },
      },
      channelAccounts: channelAccounts || [],
      recentConversations: recentConversations || [],
      tenants: tenants || [],
    });
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
