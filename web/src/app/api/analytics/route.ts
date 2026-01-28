import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Force dynamic - no caching for real-time data
export const dynamic = "force-dynamic";

// ─── Channel Config ──────────────────────────────────────────────────────────

const channelColorMap: Record<string, { name: string; color: string }> = {
  line: { name: "LINE", color: "#06C755" },
  whatsapp: { name: "WhatsApp", color: "#25D366" },
  kakao: { name: "카카오톡", color: "#FEE500" },
  instagram: { name: "Instagram", color: "#E1306C" },
  facebook: { name: "Facebook", color: "#1877F2" },
  wechat: { name: "WeChat", color: "#07C160" },
  unknown: { name: "기타", color: "#6b7280" },
};

// ─── Language Config ─────────────────────────────────────────────────────────

const languageMap: Record<string, { language: string; code: string; color: string }> = {
  ja: { language: "일본어", code: "JA", color: "#ef4444" },
  zh: { language: "중국어", code: "ZH", color: "#f59e0b" },
  vi: { language: "베트남어", code: "VI", color: "#22c55e" },
  en: { language: "영어", code: "EN", color: "#3b82f6" },
  ko: { language: "한국어", code: "KO", color: "#8b5cf6" },
  th: { language: "태국어", code: "TH", color: "#ec4899" },
};

// ─── Escalation severity keywords ───────────────────────────────────────────

function classifyEscalationSeverity(reason: string): "critical" | "high" | "medium" {
  const criticalKeywords = ["긴급", "수술", "불만", "컴플레인", "환불", "소송"];
  const highKeywords = ["신뢰도", "미달", "의료", "복잡"];
  const reasonLower = reason.toLowerCase();
  if (criticalKeywords.some((k) => reasonLower.includes(k))) return "critical";
  if (highKeywords.some((k) => reasonLower.includes(k))) return "high";
  return "medium";
}

// ─── Response time bucket helpers ───────────────────────────────────────────

const responseTimeBuckets = [
  { range: "< 30초", maxSeconds: 30 },
  { range: "30초-1분", maxSeconds: 60 },
  { range: "1-3분", maxSeconds: 180 },
  { range: "3-5분", maxSeconds: 300 },
  { range: "5-10분", maxSeconds: 600 },
  { range: "> 10분", maxSeconds: Infinity },
];

function getResponseTimeBucketIndex(seconds: number): number {
  for (let i = 0; i < responseTimeBuckets.length; i++) {
    if (seconds < responseTimeBuckets[i].maxSeconds) return i;
  }
  return responseTimeBuckets.length - 1;
}

// ─── Day of week labels (Korean) ────────────────────────────────────────────

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * GET /api/analytics
 * 분석 대시보드 데이터 반환 - 페이지에서 바로 사용할 수 있는 형태
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "7d";

    // 기간 계산
    const now = new Date();
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[period] || 7;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    // 이전 기간 (비교용)
    const prevStartDate = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000).toISOString();
    const prevEndDate = startDate;

    // ═════════════════════════════════════════════════════════════════════════
    // 1. 현재 기간 대화 통계
    // ═════════════════════════════════════════════════════════════════════════

    const { count: periodConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate);

    const { count: periodResolved } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .eq("status", "resolved");

    const { count: periodEscalated } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .eq("status", "escalated");

    // 이전 기간 대화 통계 (비교용)
    const { count: prevConversations } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevStartDate)
      .lt("created_at", prevEndDate);

    const { count: prevEscalated } = await (supabase as any)
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevStartDate)
      .lt("created_at", prevEndDate)
      .eq("status", "escalated");

    // ═════════════════════════════════════════════════════════════════════════
    // 2. 메시지 통계
    // ═════════════════════════════════════════════════════════════════════════

    const { count: periodAiMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .eq("sender_type", "ai");

    const { count: periodAgentMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .eq("sender_type", "agent");

    // 이전 기간 AI 메시지 (비교용)
    const { count: prevAiMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevStartDate)
      .lt("created_at", prevEndDate)
      .eq("sender_type", "ai");

    const { count: prevAgentMessages } = await (supabase as any)
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevStartDate)
      .lt("created_at", prevEndDate)
      .eq("sender_type", "agent");

    // ═════════════════════════════════════════════════════════════════════════
    // 3. AI 신뢰도
    // ═════════════════════════════════════════════════════════════════════════

    const { data: aiData } = await (supabase as any)
      .from("messages")
      .select("ai_confidence")
      .eq("sender_type", "ai")
      .not("ai_confidence", "is", null)
      .gte("created_at", startDate)
      .limit(500);

    const confidences = (aiData || [])
      .map((m: { ai_confidence: number }) => m.ai_confidence)
      .filter((c: number) => c > 0);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
      : 0;

    // 이전 기간 AI 신뢰도
    const { data: prevAiData } = await (supabase as any)
      .from("messages")
      .select("ai_confidence")
      .eq("sender_type", "ai")
      .not("ai_confidence", "is", null)
      .gte("created_at", prevStartDate)
      .lt("created_at", prevEndDate)
      .limit(500);

    const prevConfidences = (prevAiData || [])
      .map((m: { ai_confidence: number }) => m.ai_confidence)
      .filter((c: number) => c > 0);
    const prevAvgConfidence = prevConfidences.length > 0
      ? prevConfidences.reduce((a: number, b: number) => a + b, 0) / prevConfidences.length
      : 0;

    // ═════════════════════════════════════════════════════════════════════════
    // 4. KPI Cards 계산
    // ═════════════════════════════════════════════════════════════════════════

    const totalConv = periodConversations || 0;
    const prevTotalConv = prevConversations || 0;
    const convChange = prevTotalConv > 0 ? ((totalConv - prevTotalConv) / prevTotalConv * 100) : 0;

    const totalOutbound = (periodAiMessages || 0) + (periodAgentMessages || 0);
    const aiRate = totalOutbound > 0 ? ((periodAiMessages || 0) / totalOutbound * 100) : 0;
    const prevTotalOutbound = (prevAiMessages || 0) + (prevAgentMessages || 0);
    const prevAiRate = prevTotalOutbound > 0 ? ((prevAiMessages || 0) / prevTotalOutbound * 100) : 0;
    const aiRateChange = prevAiRate > 0 ? (aiRate - prevAiRate) : 0;

    const avgConfPct = Math.round(avgConfidence * 100);
    const prevAvgConfPct = Math.round(prevAvgConfidence * 100);

    const escalationRate = totalConv > 0 ? ((periodEscalated || 0) / totalConv * 100) : 0;
    const prevEscRate = prevTotalConv > 0 ? ((prevEscalated || 0) / prevTotalConv * 100) : 0;
    const escRateChange = prevEscRate > 0 ? (escalationRate - prevEscRate) : 0;

    // 응답시간 통계 (메시지 기반 근사)
    const { data: responsePairs } = await (supabase as any)
      .from("messages")
      .select("conversation_id, direction, created_at, sender_type")
      .gte("created_at", startDate)
      .order("created_at", { ascending: true })
      .limit(1000);

    // 응답시간 계산: inbound 메시지 이후 첫 outbound 메시지까지의 시간
    const responseTimesSeconds: number[] = [];
    const conversationLastInbound: Record<string, string> = {};

    (responsePairs || []).forEach((msg: any) => {
      if (msg.direction === "inbound") {
        conversationLastInbound[msg.conversation_id] = msg.created_at;
      } else if (msg.direction === "outbound" && conversationLastInbound[msg.conversation_id]) {
        const inboundTime = new Date(conversationLastInbound[msg.conversation_id]).getTime();
        const outboundTime = new Date(msg.created_at).getTime();
        const diffSeconds = (outboundTime - inboundTime) / 1000;
        if (diffSeconds > 0 && diffSeconds < 86400) { // 24시간 이내만
          responseTimesSeconds.push(diffSeconds);
        }
        delete conversationLastInbound[msg.conversation_id];
      }
    });

    const avgResponseMinutes = responseTimesSeconds.length > 0
      ? responseTimesSeconds.reduce((a, b) => a + b, 0) / responseTimesSeconds.length / 60
      : 0;

    // Sparkline 생성을 위한 일별 데이터 (최근 7일간)
    const sparklineDays = 7;
    const sparklineData: { conversations: number; aiRate: number; responseTime: number; escalationRate: number }[] = [];

    for (let i = sparklineDays - 1; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000).toISOString();
      const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();

      const { count: dayConv } = await (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      const { count: dayEsc } = await (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .eq("status", "escalated");

      const { count: dayAi } = await (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .eq("sender_type", "ai");

      const { count: dayAgent } = await (supabase as any)
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .eq("sender_type", "agent");

      const dayTotalOut = (dayAi || 0) + (dayAgent || 0);
      const dayAiRate = dayTotalOut > 0 ? ((dayAi || 0) / dayTotalOut * 100) : 0;
      const dayEscRate = (dayConv || 0) > 0 ? ((dayEsc || 0) / (dayConv || 1) * 100) : 0;

      sparklineData.push({
        conversations: dayConv || 0,
        aiRate: Math.round(dayAiRate * 10) / 10,
        responseTime: avgResponseMinutes, // 근사값 사용
        escalationRate: Math.round(dayEscRate * 10) / 10,
      });
    }

    const changeLabel = period === "1d" ? "전일 대비" : period === "30d" ? "전월 대비" : period === "90d" ? "전분기 대비" : "전주 대비";

    const kpiCards = [
      {
        id: "conversations",
        label: "총 대화",
        value: totalConv,
        format: "number",
        change: Math.round(convChange * 10) / 10,
        changeLabel,
        icon: "MessageSquare",
        color: "blue",
        sparkline: sparklineData.map((d) => d.conversations),
      },
      {
        id: "ai-resolution",
        label: "AI 자동 해결율",
        value: Math.round(aiRate * 10) / 10,
        format: "percent",
        change: Math.round(aiRateChange * 10) / 10,
        changeLabel,
        icon: "Bot",
        color: "violet",
        sparkline: sparklineData.map((d) => d.aiRate),
      },
      {
        id: "response-time",
        label: "평균 응답시간",
        value: Math.round(avgResponseMinutes * 10) / 10,
        format: "minutes",
        change: 0, // 이전 기간 응답시간 비교 어려움, 0으로 설정
        changeLabel,
        icon: "Clock",
        color: "emerald",
        sparkline: sparklineData.map((d) => d.responseTime),
      },
      {
        id: "csat",
        label: "AI 평균 신뢰도",
        value: avgConfPct,
        format: "percent",
        change: prevAvgConfPct > 0 ? Math.round((avgConfPct - prevAvgConfPct) * 10) / 10 : 0,
        changeLabel,
        icon: "ThumbsUp",
        color: "amber",
        sparkline: sparklineData.map(() => avgConfPct), // 일별 세분화 어려우므로 평균값 유지
      },
      {
        id: "escalation",
        label: "에스컬레이션율",
        value: Math.round(escalationRate * 10) / 10,
        format: "percent",
        change: Math.round(escRateChange * 10) / 10,
        changeLabel,
        icon: "ShieldAlert",
        color: "rose",
        sparkline: sparklineData.map((d) => d.escalationRate),
      },
    ];

    // ═════════════════════════════════════════════════════════════════════════
    // 5. 채널별 분포
    // ═════════════════════════════════════════════════════════════════════════

    // Get channel distribution via customer_channels → channel_accounts
    const { data: convChannels } = await (supabase as any)
      .from("conversations")
      .select(`
        id,
        customer:customers(
          customer_channels(
            channel_account:channel_accounts(channel_type)
          )
        )
      `)
      .gte("created_at", startDate)
      .limit(500);

    const channelCounts: Record<string, number> = {};
    (convChannels || []).forEach((conv: any) => {
      const type = conv.customer?.customer_channels?.[0]?.channel_account?.channel_type || "unknown";
      channelCounts[type] = (channelCounts[type] || 0) + 1;
    });

    const totalChannelConv = Object.values(channelCounts).reduce((a, b) => a + b, 0);
    const channelDistribution = Object.entries(channelCounts)
      .map(([type, count]) => {
        const config = channelColorMap[type] || channelColorMap.unknown;
        return {
          name: config.name,
          count,
          percentage: totalChannelConv > 0 ? Math.round((count / totalChannelConv) * 1000) / 10 : 0,
          color: config.color,
        };
      })
      .sort((a, b) => b.count - a.count);

    // ═════════════════════════════════════════════════════════════════════════
    // 6. 일별 트렌드
    // ═════════════════════════════════════════════════════════════════════════

    const trendDays = Math.min(days, 7); // 최대 7일 표시
    const dailyTrends: { day: string; conversations: number; resolved: number }[] = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayLabel = dayLabels[dayStart.getDay()];

      const { count: dayConvCount } = await (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString())
        .lt("created_at", dayEnd.toISOString());

      const { count: dayResolvedCount } = await (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString())
        .lt("created_at", dayEnd.toISOString())
        .eq("status", "resolved");

      dailyTrends.push({
        day: dayLabel,
        conversations: dayConvCount || 0,
        resolved: dayResolvedCount || 0,
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 7. 언어별 분포
    // ═════════════════════════════════════════════════════════════════════════

    const { data: customerLangs } = await (supabase as any)
      .from("customers")
      .select("language")
      .limit(1000);

    const langCounts: Record<string, number> = {};
    (customerLangs || []).forEach((c: { language: string | null }) => {
      const lang = (c.language || "unknown").toLowerCase();
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    });

    const totalLangCustomers = Object.values(langCounts).reduce((a, b) => a + b, 0);
    const languageDistribution = Object.entries(langCounts)
      .map(([lang, count]) => {
        const config = languageMap[lang] || { language: lang.toUpperCase(), code: lang.toUpperCase(), color: "#6b7280" };
        return {
          language: config.language,
          code: config.code,
          percentage: totalLangCustomers > 0 ? Math.round((count / totalLangCustomers) * 1000) / 10 : 0,
          count,
          color: config.color,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // 최대 6개 (나머지는 기타로 처리)

    // ═════════════════════════════════════════════════════════════════════════
    // 8. 에스컬레이션 사유
    // ═════════════════════════════════════════════════════════════════════════

    const { data: escalationReasonsData } = await (supabase as any)
      .from("escalations")
      .select("reason")
      .gte("created_at", startDate)
      .limit(500);

    const reasonCounts: Record<string, number> = {};
    (escalationReasonsData || []).forEach((e: { reason: string }) => {
      const r = e.reason || "기타";
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });

    const totalReasons = Object.values(reasonCounts).reduce((a, b) => a + b, 0);
    const escalationReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalReasons > 0 ? Math.round((count / totalReasons) * 1000) / 10 : 0,
        severity: classifyEscalationSeverity(reason),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ═════════════════════════════════════════════════════════════════════════
    // 9. 응답시간 분포
    // ═════════════════════════════════════════════════════════════════════════

    const bucketCounts = new Array(responseTimeBuckets.length).fill(0);
    responseTimesSeconds.forEach((sec) => {
      const idx = getResponseTimeBucketIndex(sec);
      bucketCounts[idx]++;
    });

    const totalResponseSamples = responseTimesSeconds.length;
    const responseTimeDistribution = responseTimeBuckets.map((bucket, i) => ({
      range: bucket.range,
      count: bucketCounts[i],
      percentage: totalResponseSamples > 0
        ? Math.round((bucketCounts[i] / totalResponseSamples) * 1000) / 10
        : 0,
    }));

    // ═════════════════════════════════════════════════════════════════════════
    // 10. 거래처별 성과
    // ═════════════════════════════════════════════════════════════════════════

    const { data: tenants } = await (supabase as any)
      .from("tenants")
      .select("id, name, name_en, specialty");

    const tenantPerformance = await Promise.all(
      (tenants || []).map(async (tenant: any) => {
        const { count: tConv } = await (supabase as any)
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", startDate);

        const { count: tResolved } = await (supabase as any)
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", startDate)
          .eq("status", "resolved");

        const { count: tEscalated } = await (supabase as any)
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", startDate)
          .eq("status", "escalated");

        // 이전 기간 대화 수 (비교용)
        const { count: prevTConv } = await (supabase as any)
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", prevStartDate)
          .lt("created_at", prevEndDate);

        // 테넌트 AI 메시지 - 먼저 conversation IDs를 가져온 후 메시지 카운트
        const { data: tenantConvIds } = await (supabase as any)
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenant.id);

        const tConvIdList = (tenantConvIds || []).map((c: any) => c.id);

        let tAiMsg = 0;
        let tAgentMsg = 0;

        if (tConvIdList.length > 0) {
          const { count: aiCount } = await (supabase as any)
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", tConvIdList)
            .gte("created_at", startDate)
            .eq("sender_type", "ai");

          const { count: agentCount } = await (supabase as any)
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", tConvIdList)
            .gte("created_at", startDate)
            .eq("sender_type", "agent");

          tAiMsg = aiCount || 0;
          tAgentMsg = agentCount || 0;
        }

        const tTotalOut = (tAiMsg || 0) + (tAgentMsg || 0);
        const tAiAccuracy = tTotalOut > 0 ? ((tAiMsg || 0) / tTotalOut * 100) : 0;
        const tEscRate = (tConv || 0) > 0 ? ((tEscalated || 0) / (tConv || 1) * 100) : 0;

        const tChange = (prevTConv || 0) > 0
          ? (((tConv || 0) - (prevTConv || 0)) / (prevTConv || 1) * 100)
          : 0;

        return {
          name: tenant.name || tenant.name_en || "Unknown",
          conversations: tConv || 0,
          aiAccuracy: Math.round(tAiAccuracy * 10) / 10,
          escalationRate: Math.round(tEscRate * 10) / 10,
          satisfaction: 0, // CSAT 데이터 별도 테이블 필요
          avgResponse: Math.round(avgResponseMinutes * 10) / 10, // 전체 평균 근사
          trend: tChange >= 0 ? ("up" as const) : ("down" as const),
          change: Math.round(tChange * 10) / 10,
        };
      })
    );

    // ═════════════════════════════════════════════════════════════════════════
    // 응답 반환
    // ═════════════════════════════════════════════════════════════════════════

    const response = NextResponse.json({
      period,
      kpiCards,
      channelDistribution,
      dailyTrends,
      tenantPerformance,
      languageDistribution,
      escalationReasons,
      responseTimeDistribution,
    });

    // ✅ 캐시 헤더 추가 - 30초 캐싱 (브라우저 + CDN)
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60"
    );

    return response;
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
