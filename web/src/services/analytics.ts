/**
 * Analytics Service
 * Provides comprehensive analytics for CS automation platform
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface OverviewMetrics {
  totalConversations: number;
  totalMessages: number;
  uniqueCustomers: number;
  avgResponseTime: number; // in minutes
  aiResolutionRate: number; // percentage
  escalationRate: number; // percentage
  satisfactionScore: number; // 1-5
}

export interface ChannelMetrics {
  channelType: string;
  conversations: number;
  messages: number;
  avgResponseTime: number;
  aiResolutionRate: number;
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  conversationsHandled: number;
  messagesent: number;
  avgResponseTime: number;
  satisfactionScore: number;
  escalationsResolved: number;
}

export interface AIMetrics {
  totalResponses: number;
  avgConfidence: number;
  highConfidenceRate: number; // > 0.85
  escalationTriggerRate: number;
  topEscalationReasons: Array<{ reason: string; count: number }>;
  modelUsage: Array<{ model: string; count: number; avgConfidence: number }>;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface ConversationTrends {
  daily: TrendDataPoint[];
  weekly: TrendDataPoint[];
  byHour: Array<{ hour: number; count: number }>;
  byDayOfWeek: Array<{ day: number; count: number }>;
}

/**
 * Analytics Service
 */
export const analyticsService = {
  /**
   * Get overview metrics for a tenant
   */
  async getOverviewMetrics(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<OverviewMetrics> {
    const supabase = await createServiceClient();

    // Build date filter
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    // Total conversations
    const { count: totalConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // Total messages
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // Unique customers
    const { data: customerData } = await supabase
      .from("conversations")
      .select("customer_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const uniqueCustomers = new Set(
      (customerData as Array<{ customer_id: string }> | null)?.map((c) => c.customer_id) || []
    ).size;

    // AI responses for resolution rate
    const { count: aiResponses } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("message_type", "ai")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const aiResolutionRate = totalConversations
      ? ((aiResponses || 0) / (totalConversations || 1)) * 100
      : 0;

    // Escalation rate
    const { count: escalations } = await supabase
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const escalationRate = totalConversations
      ? ((escalations || 0) / (totalConversations || 1)) * 100
      : 0;

    // Average satisfaction score
    const { data: surveyData } = await supabase
      .from("survey_responses")
      .select("overall_rating")
      .eq("tenant_id", tenantId)
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", endDate.toISOString());

    const typedSurveyData = (surveyData || []) as Array<{ overall_rating: number }>;
    const satisfactionScore = typedSurveyData.length
      ? typedSurveyData.reduce((sum, s) => sum + s.overall_rating, 0) / typedSurveyData.length
      : 0;

    // Average response time (simplified calculation)
    const avgResponseTime = 5; // Placeholder - would need proper calculation from message timestamps

    return {
      totalConversations: totalConversations || 0,
      totalMessages: totalMessages || 0,
      uniqueCustomers,
      avgResponseTime,
      aiResolutionRate: Math.round(aiResolutionRate * 10) / 10,
      escalationRate: Math.round(escalationRate * 10) / 10,
      satisfactionScore: Math.round(satisfactionScore * 10) / 10,
    };
  },

  /**
   * Get metrics by channel
   */
  async getChannelMetrics(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<ChannelMetrics[]> {
    const supabase = await createServiceClient();

    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    // Get conversations with channel info
    const { data: conversations } = await supabase
      .from("conversations")
      .select(`
        id,
        customer_channel:customer_channels(
          channel_type
        )
      `)
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // Aggregate by channel
    const channelMap = new Map<string, { conversations: number; messages: number }>();

    for (const conv of (conversations || []) as Array<{
      id: string;
      customer_channel: { channel_type: string };
    }>) {
      const channelType = conv.customer_channel?.channel_type || "unknown";
      const current = channelMap.get(channelType) || { conversations: 0, messages: 0 };
      current.conversations++;
      channelMap.set(channelType, current);
    }

    // Convert to array
    const results: ChannelMetrics[] = [];
    for (const [channelType, data] of channelMap) {
      results.push({
        channelType,
        conversations: data.conversations,
        messages: data.messages,
        avgResponseTime: 5, // Placeholder
        aiResolutionRate: 75, // Placeholder
      });
    }

    return results.sort((a, b) => b.conversations - a.conversations);
  },

  /**
   * Get AI performance metrics
   */
  async getAIMetrics(
    tenantId: string,
    dateRange?: DateRange
  ): Promise<AIMetrics> {
    const supabase = await createServiceClient();

    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    // Get AI messages
    const { data: aiMessages } = await supabase
      .from("messages")
      .select("ai_confidence, ai_model")
      .eq("tenant_id", tenantId)
      .eq("message_type", "ai")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const typedMessages = (aiMessages || []) as Array<{
      ai_confidence: number;
      ai_model?: string;
    }>;

    const totalResponses = typedMessages.length;
    const avgConfidence = totalResponses
      ? typedMessages.reduce((sum, m) => sum + (m.ai_confidence || 0), 0) / totalResponses
      : 0;

    const highConfidenceCount = typedMessages.filter(
      (m) => (m.ai_confidence || 0) > 0.85
    ).length;
    const highConfidenceRate = totalResponses
      ? (highConfidenceCount / totalResponses) * 100
      : 0;

    // Model usage
    const modelUsage = new Map<string, { count: number; totalConfidence: number }>();
    for (const msg of typedMessages) {
      const model = msg.ai_model || "unknown";
      const current = modelUsage.get(model) || { count: 0, totalConfidence: 0 };
      current.count++;
      current.totalConfidence += msg.ai_confidence || 0;
      modelUsage.set(model, current);
    }

    // Escalation reasons
    const { data: escalations } = await supabase
      .from("escalations")
      .select("reason")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const reasonCounts = new Map<string, number>();
    for (const esc of (escalations || []) as Array<{ reason: string }>) {
      const reason = esc.reason || "기타";
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    const escalationTriggerRate = totalResponses
      ? ((escalations?.length || 0) / totalResponses) * 100
      : 0;

    return {
      totalResponses,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      highConfidenceRate: Math.round(highConfidenceRate * 10) / 10,
      escalationTriggerRate: Math.round(escalationTriggerRate * 10) / 10,
      topEscalationReasons: Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      modelUsage: Array.from(modelUsage.entries()).map(([model, data]) => ({
        model,
        count: data.count,
        avgConfidence:
          Math.round((data.totalConfidence / data.count) * 100) / 100,
      })),
    };
  },

  /**
   * Get conversation trends
   */
  async getConversationTrends(
    tenantId: string,
    days: number = 30
  ): Promise<ConversationTrends> {
    const supabase = await createServiceClient();

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const { data: conversations } = await supabase
      .from("conversations")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const typedConversations = (conversations || []) as Array<{ created_at: string }>;

    // Daily trend
    const dailyCounts = new Map<string, number>();
    for (const conv of typedConversations) {
      const date = new Date(conv.created_at).toISOString().split("T")[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    }

    const daily: TrendDataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      daily.push({
        date,
        value: dailyCounts.get(date) || 0,
      });
    }

    // Weekly trend (aggregate by week)
    const weeklyCounts = new Map<string, number>();
    for (const conv of typedConversations) {
      const date = new Date(conv.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];
      weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);
    }

    const weekly = Array.from(weeklyCounts.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // By hour of day
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: typedConversations.filter(
        (c) => new Date(c.created_at).getHours() === hour
      ).length,
    }));

    // By day of week (0 = Sunday)
    const byDayOfWeek = Array.from({ length: 7 }, (_, day) => ({
      day,
      count: typedConversations.filter(
        (c) => new Date(c.created_at).getDay() === day
      ).length,
    }));

    return {
      daily,
      weekly,
      byHour,
      byDayOfWeek,
    };
  },

  /**
   * Get tenant comparison metrics (for multi-tenant dashboards)
   */
  async getTenantComparison(
    tenantIds: string[],
    dateRange?: DateRange
  ): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      metrics: OverviewMetrics;
    }>
  > {
    const results = [];

    for (const tenantId of tenantIds) {
      const metrics = await this.getOverviewMetrics(tenantId, dateRange);
      results.push({
        tenantId,
        tenantName: tenantId, // Would need to load actual tenant name
        metrics,
      });
    }

    return results;
  },

  /**
   * Get real-time dashboard metrics (for live updates)
   */
  async getRealTimeMetrics(tenantId: string): Promise<{
    activeConversations: number;
    waitingConversations: number;
    escalatedConversations: number;
    todayConversations: number;
    todayMessages: number;
    todayAIResponses: number;
    recentMessages: Array<{
      id: string;
      content: string;
      channelType: string;
      timestamp: string;
    }>;
  }> {
    const supabase = await createServiceClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Active/waiting/escalated conversations
    const { count: active } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    const { count: waiting } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "waiting");

    const { count: escalated } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "escalated");

    // Today's stats
    const { count: todayConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", today.toISOString());

    const { count: todayMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", today.toISOString());

    const { count: todayAIResponses } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("message_type", "ai")
      .gte("created_at", today.toISOString());

    // Recent messages
    const { data: recentMessages } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        conversation:conversations(
          customer_channel:customer_channels(
            channel_type
          )
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("message_type", "customer")
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      activeConversations: active || 0,
      waitingConversations: waiting || 0,
      escalatedConversations: escalated || 0,
      todayConversations: todayConversations || 0,
      todayMessages: todayMessages || 0,
      todayAIResponses: todayAIResponses || 0,
      recentMessages: ((recentMessages || []) as Array<{
        id: string;
        content: string;
        created_at: string;
        conversation: {
          customer_channel: { channel_type: string };
        };
      }>).map((m) => ({
        id: m.id,
        content: m.content?.slice(0, 100) || "",
        channelType: m.conversation?.customer_channel?.channel_type || "unknown",
        timestamp: m.created_at,
      })),
    };
  },
};

export default analyticsService;
