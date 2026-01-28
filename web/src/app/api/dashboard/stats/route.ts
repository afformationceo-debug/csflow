import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Force dynamic - no caching for real-time data
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * 대시보드 실시간 통계 데이터 반환
 * 병렬 쿼리로 최적화 (3초 → 1초 이하)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // 오늘 날짜 범위
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ✅ 병렬 쿼리로 최적화 - 모든 쿼리를 동시 실행
    const [
      // 1. 대화 통계 (5개 쿼리)
      { count: totalConversations },
      { count: todayConversations },
      { count: activeConversations },
      { count: escalatedConversations },
      { count: resolvedConversations },

      // 2. 메시지 통계 (5개 쿼리)
      { count: totalMessages },
      { count: todayMessages },
      { count: aiMessages },
      { count: agentMessages },
      { count: totalOutbound },

      // 3. AI 신뢰도 데이터
      { data: aiConfidenceData },

      // 4. 에스컬레이션 통계 (3개 쿼리)
      { count: totalEscalations },
      { count: pendingEscalations },
      { count: todayEscalations },

      // 5. 고객 통계 (2개 쿼리)
      { count: totalCustomers },
      { count: todayCustomers },

      // 6. 채널별 통계
      { data: channelAccounts },

      // 7. 최근 대화 목록
      { data: recentConversations },

      // 8. 거래처별 통계
      { data: tenants },

      // 9. 팀원 수
      { count: teamCount },
    ] = await Promise.all([
      // 1. 대화 통계
      (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true }),
      (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),
      (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .in("status", ["active", "waiting"]),
      (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("status", "escalated"),
      (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved"),

      // 2. 메시지 통계
      (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true }),
      (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),
      (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_type", "ai"),
      (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_type", "agent"),
      (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "outbound"),

      // 3. AI 신뢰도
      (supabase as any)
        .from("messages")
        .select("ai_confidence")
        .eq("sender_type", "ai")
        .not("ai_confidence", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),

      // 4. 에스컬레이션 통계
      (supabase as any)
        .from("escalations")
        .select("*", { count: "exact", head: true }),
      (supabase as any)
        .from("escalations")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      (supabase as any)
        .from("escalations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),

      // 5. 고객 통계
      (supabase as any)
        .from("customers")
        .select("*", { count: "exact", head: true }),
      (supabase as any)
        .from("customers")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),

      // 6. 채널 계정
      (supabase as any)
        .from("channel_accounts")
        .select("id, channel_type, account_name, is_active, tenant_id"),

      // 7. 최근 대화
      (supabase as any)
        .from("conversations")
        .select(`
          id, status, priority, last_message_at, created_at, ai_enabled,
          customer:customers(id, name, country, language, profile_image_url, tags)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(10),

      // 8. 거래처
      (supabase as any)
        .from("tenants")
        .select("id, name, name_en, specialty"),

      // 9. 팀원
      (supabase as any)
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    // AI 신뢰도 계산
    const aiConfidences = (aiConfidenceData || [])
      .map((m: { ai_confidence: number }) => m.ai_confidence)
      .filter((c: number) => c > 0);
    const avgAiConfidence = aiConfidences.length > 0
      ? aiConfidences.reduce((a: number, b: number) => a + b, 0) / aiConfidences.length
      : 0;

    // AI 자동응대율 계산
    const aiRate = totalOutbound && totalOutbound > 0
      ? ((aiMessages || 0) / totalOutbound * 100)
      : 0;

    const response = NextResponse.json({
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
      teamCount: teamCount || 0,
    });

    // ✅ 캐시 헤더 추가 - 30초 캐싱 (브라우저 + CDN)
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60"
    );

    return response;
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
