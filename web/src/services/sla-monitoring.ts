/**
 * SLA Monitoring Service
 * Tracks and monitors service level agreements
 */

import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/upstash/qstash";

export interface SLAConfig {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  targets: SLATargets;
  businessHours: BusinessHours;
  escalationPolicy: EscalationPolicy;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLATargets {
  // Response time targets (in minutes)
  firstResponseTime: {
    target: number;
    warning: number;
  };
  // Resolution time targets (in minutes)
  resolutionTime: {
    target: number;
    warning: number;
  };
  // AI auto-response rate target (percentage)
  aiResponseRate: {
    target: number;
    warning: number;
  };
  // Customer satisfaction target (1-5 scale)
  customerSatisfaction: {
    target: number;
    warning: number;
  };
  // Escalation rate target (percentage, lower is better)
  escalationRate: {
    target: number;
    warning: number;
  };
}

export interface BusinessHours {
  timezone: string;
  schedule: {
    [day: string]: {
      // day: 0-6 (Sun-Sat)
      isWorkday: boolean;
      start: string; // HH:mm
      end: string;
    };
  };
  holidays: string[]; // ISO date strings
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  level: number;
  thresholdMinutes: number;
  notifyChannels: ("email" | "slack" | "sms" | "kakao")[];
  notifyUserIds: string[];
  autoAssign: boolean;
}

export interface SLAMetrics {
  tenantId: string;
  period: string; // YYYY-MM
  firstResponseTime: {
    average: number;
    p50: number;
    p90: number;
    p99: number;
    breachCount: number;
    breachRate: number;
  };
  resolutionTime: {
    average: number;
    p50: number;
    p90: number;
    p99: number;
    breachCount: number;
    breachRate: number;
  };
  aiResponseRate: {
    current: number;
    target: number;
    met: boolean;
  };
  customerSatisfaction: {
    average: number;
    responseCount: number;
    target: number;
    met: boolean;
  };
  escalationRate: {
    current: number;
    target: number;
    met: boolean;
  };
  overallHealth: "healthy" | "warning" | "critical";
}

export interface SLABreach {
  id: string;
  tenantId: string;
  conversationId: string;
  customerId: string;
  breachType: "first_response" | "resolution" | "escalation";
  targetMinutes: number;
  actualMinutes: number;
  isResolved: boolean;
  resolvedAt: Date | null;
  notifiedAt: Date | null;
  createdAt: Date;
}

export interface ConversationSLAStatus {
  conversationId: string;
  firstResponseStatus: {
    targetMinutes: number;
    elapsedMinutes: number;
    isBreached: boolean;
    breachAt: Date | null;
  };
  resolutionStatus: {
    targetMinutes: number;
    elapsedMinutes: number;
    isBreached: boolean;
    breachAt: Date | null;
  };
  currentEscalationLevel: number;
  nextEscalationAt: Date | null;
}

/**
 * SLA Monitoring Service
 */
export const slaMonitoringService = {
  /**
   * Get SLA configuration for tenant
   */
  async getSLAConfig(tenantId: string): Promise<SLAConfig | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("sla_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!data) {
      return this.getDefaultSLAConfig(tenantId);
    }

    const config = data as {
      id: string;
      tenant_id: string;
      name: string;
      description: string | null;
      targets: SLATargets;
      business_hours: BusinessHours;
      escalation_policy: EscalationPolicy;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };

    return {
      id: config.id,
      tenantId: config.tenant_id,
      name: config.name,
      description: config.description,
      targets: config.targets,
      businessHours: config.business_hours,
      escalationPolicy: config.escalation_policy,
      isActive: config.is_active,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at),
    };
  },

  /**
   * Create or update SLA configuration
   */
  async upsertSLAConfig(
    tenantId: string,
    config: Partial<Omit<SLAConfig, "id" | "tenantId" | "createdAt" | "updatedAt">>
  ): Promise<SLAConfig> {
    const supabase = await createServiceClient();

    const existing = await this.getSLAConfig(tenantId);
    const defaults = this.getDefaultSLAConfig(tenantId);

    const payload = {
      tenant_id: tenantId,
      name: config.name || defaults.name,
      description: config.description || defaults.description,
      targets: config.targets || defaults.targets,
      business_hours: config.businessHours || defaults.businessHours,
      escalation_policy: config.escalationPolicy || defaults.escalationPolicy,
      is_active: config.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    if (existing && existing.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sla_configs")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update SLA config: ${error.message}`);
      return this.mapSLAConfig(data);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("sla_configs")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to create SLA config: ${error.message}`);
    return this.mapSLAConfig(data);
  },

  /**
   * Calculate SLA metrics for a period
   */
  async calculateMetrics(
    tenantId: string,
    period?: string
  ): Promise<SLAMetrics> {
    const supabase = await createServiceClient();
    const targetPeriod = period || new Date().toISOString().slice(0, 7);
    const startOfMonth = `${targetPeriod}-01`;

    const slaConfig = await this.getSLAConfig(tenantId);
    const targets = slaConfig?.targets || this.getDefaultSLAConfig(tenantId).targets;

    // Get conversation response times
    const { data: conversations } = await supabase
      .from("conversations")
      .select(`
        id,
        created_at,
        status,
        updated_at,
        messages(created_at, sender_type)
      `)
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth);

    const firstResponseTimes: number[] = [];
    const resolutionTimes: number[] = [];
    let totalConversations = 0;
    let resolvedConversations = 0;

    for (const conv of (conversations || []) as Array<{
      id: string;
      created_at: string;
      status: string;
      updated_at: string;
      messages: Array<{ created_at: string; sender_type: string }>;
    }>) {
      totalConversations++;

      // Calculate first response time
      const customerMessages = conv.messages
        .filter((m) => m.sender_type === "customer")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const agentResponses = conv.messages
        .filter((m) => m.sender_type === "agent" || m.sender_type === "ai")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      if (customerMessages.length > 0 && agentResponses.length > 0) {
        const firstCustomerMsg = new Date(customerMessages[0].created_at);
        const firstResponse = new Date(agentResponses[0].created_at);
        const responseTime = (firstResponse.getTime() - firstCustomerMsg.getTime()) / 60000;
        if (responseTime > 0) {
          firstResponseTimes.push(responseTime);
        }
      }

      // Calculate resolution time
      if (conv.status === "resolved") {
        resolvedConversations++;
        const created = new Date(conv.created_at);
        const resolved = new Date(conv.updated_at);
        const resolutionTime = (resolved.getTime() - created.getTime()) / 60000;
        if (resolutionTime > 0) {
          resolutionTimes.push(resolutionTime);
        }
      }
    }

    // Calculate percentiles
    const calcPercentiles = (values: number[]) => {
      if (values.length === 0) {
        return { average: 0, p50: 0, p90: 0, p99: 0 };
      }
      const sorted = [...values].sort((a, b) => a - b);
      return {
        average: values.reduce((a, b) => a + b, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      };
    };

    const firstResponseStats = calcPercentiles(firstResponseTimes);
    const resolutionStats = calcPercentiles(resolutionTimes);

    const firstResponseBreaches = firstResponseTimes.filter(
      (t) => t > targets.firstResponseTime.target
    ).length;

    const resolutionBreaches = resolutionTimes.filter(
      (t) => t > targets.resolutionTime.target
    ).length;

    // Get AI response rate
    const { count: aiResponses } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("sender_type", "ai")
      .gte("created_at", startOfMonth);

    const { count: totalResponses } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("sender_type", ["ai", "agent"])
      .gte("created_at", startOfMonth);

    const aiResponseRate = totalResponses
      ? ((aiResponses || 0) / totalResponses) * 100
      : 0;

    // Get satisfaction scores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: surveyData } = await (supabase as any)
      .from("survey_responses")
      .select("overall_rating")
      .eq("tenant_id", tenantId)
      .gte("completed_at", startOfMonth);

    const surveyResponses = (surveyData || []) as Array<{ overall_rating: number }>;
    const avgSatisfaction = surveyResponses.length
      ? surveyResponses.reduce((s, r) => s + r.overall_rating, 0) / surveyResponses.length
      : 0;

    // Get escalation rate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: escalations } = await (supabase as any)
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth);

    const escalationRate = totalConversations
      ? ((escalations || 0) / totalConversations) * 100
      : 0;

    // Determine overall health
    const issues: string[] = [];
    if (firstResponseStats.average > targets.firstResponseTime.warning) {
      issues.push("first_response");
    }
    if (resolutionStats.average > targets.resolutionTime.warning) {
      issues.push("resolution");
    }
    if (aiResponseRate < targets.aiResponseRate.warning) {
      issues.push("ai_rate");
    }
    if (avgSatisfaction < targets.customerSatisfaction.warning && surveyResponses.length > 0) {
      issues.push("satisfaction");
    }
    if (escalationRate > targets.escalationRate.warning) {
      issues.push("escalation");
    }

    let overallHealth: "healthy" | "warning" | "critical" = "healthy";
    if (issues.length >= 3) {
      overallHealth = "critical";
    } else if (issues.length >= 1) {
      overallHealth = "warning";
    }

    return {
      tenantId,
      period: targetPeriod,
      firstResponseTime: {
        ...firstResponseStats,
        breachCount: firstResponseBreaches,
        breachRate: firstResponseTimes.length
          ? (firstResponseBreaches / firstResponseTimes.length) * 100
          : 0,
      },
      resolutionTime: {
        ...resolutionStats,
        breachCount: resolutionBreaches,
        breachRate: resolutionTimes.length
          ? (resolutionBreaches / resolutionTimes.length) * 100
          : 0,
      },
      aiResponseRate: {
        current: Math.round(aiResponseRate * 10) / 10,
        target: targets.aiResponseRate.target,
        met: aiResponseRate >= targets.aiResponseRate.target,
      },
      customerSatisfaction: {
        average: Math.round(avgSatisfaction * 10) / 10,
        responseCount: surveyResponses.length,
        target: targets.customerSatisfaction.target,
        met: avgSatisfaction >= targets.customerSatisfaction.target,
      },
      escalationRate: {
        current: Math.round(escalationRate * 10) / 10,
        target: targets.escalationRate.target,
        met: escalationRate <= targets.escalationRate.target,
      },
      overallHealth,
    };
  },

  /**
   * Check SLA status for a conversation
   */
  async checkConversationSLA(
    conversationId: string
  ): Promise<ConversationSLAStatus> {
    const supabase = await createServiceClient();

    const { data: conversation } = await supabase
      .from("conversations")
      .select(`
        *,
        tenant:tenants(*),
        messages(created_at, sender_type)
      `)
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const conv = conversation as {
      id: string;
      tenant_id: string;
      created_at: string;
      status: string;
      messages: Array<{ created_at: string; sender_type: string }>;
    };

    const slaConfig = await this.getSLAConfig(conv.tenant_id);
    const targets = slaConfig?.targets || this.getDefaultSLAConfig(conv.tenant_id).targets;
    const escalationPolicy = slaConfig?.escalationPolicy || this.getDefaultSLAConfig(conv.tenant_id).escalationPolicy;

    const now = new Date();
    const conversationStart = new Date(conv.created_at);
    const elapsedMinutes = (now.getTime() - conversationStart.getTime()) / 60000;

    // Check first response
    const customerMessages = conv.messages
      .filter((m) => m.sender_type === "customer")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const agentResponses = conv.messages
      .filter((m) => m.sender_type === "agent" || m.sender_type === "ai")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let firstResponseElapsed = elapsedMinutes;
    let firstResponseBreached = false;

    if (customerMessages.length > 0 && agentResponses.length > 0) {
      const firstCustomerMsg = new Date(customerMessages[0].created_at);
      const firstResponse = new Date(agentResponses[0].created_at);
      firstResponseElapsed = (firstResponse.getTime() - firstCustomerMsg.getTime()) / 60000;
    } else if (customerMessages.length > 0) {
      const firstCustomerMsg = new Date(customerMessages[0].created_at);
      firstResponseElapsed = (now.getTime() - firstCustomerMsg.getTime()) / 60000;
      firstResponseBreached = firstResponseElapsed > targets.firstResponseTime.target;
    }

    // Calculate escalation level
    let currentEscalationLevel = 0;
    let nextEscalationAt: Date | null = null;

    if (conv.status !== "resolved") {
      for (const level of escalationPolicy.levels) {
        if (elapsedMinutes >= level.thresholdMinutes) {
          currentEscalationLevel = level.level;
        } else {
          nextEscalationAt = new Date(
            conversationStart.getTime() + level.thresholdMinutes * 60000
          );
          break;
        }
      }
    }

    // Resolution status
    const resolutionBreached = conv.status !== "resolved" && elapsedMinutes > targets.resolutionTime.target;

    return {
      conversationId,
      firstResponseStatus: {
        targetMinutes: targets.firstResponseTime.target,
        elapsedMinutes: Math.round(firstResponseElapsed),
        isBreached: firstResponseBreached,
        breachAt: firstResponseBreached
          ? new Date(customerMessages[0] ? new Date(customerMessages[0].created_at).getTime() + targets.firstResponseTime.target * 60000 : now.getTime())
          : null,
      },
      resolutionStatus: {
        targetMinutes: targets.resolutionTime.target,
        elapsedMinutes: Math.round(elapsedMinutes),
        isBreached: resolutionBreached,
        breachAt: resolutionBreached
          ? new Date(conversationStart.getTime() + targets.resolutionTime.target * 60000)
          : null,
      },
      currentEscalationLevel,
      nextEscalationAt,
    };
  },

  /**
   * Record SLA breach
   */
  async recordBreach(
    tenantId: string,
    conversationId: string,
    customerId: string,
    breachType: SLABreach["breachType"],
    targetMinutes: number,
    actualMinutes: number
  ): Promise<void> {
    const supabase = await createServiceClient();

    // Check if breach already recorded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("sla_breaches")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("breach_type", breachType)
      .single();

    if (existing) return; // Already recorded

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("sla_breaches").insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      customer_id: customerId,
      breach_type: breachType,
      target_minutes: targetMinutes,
      actual_minutes: actualMinutes,
      is_resolved: false,
      created_at: new Date().toISOString(),
    });

    // Trigger breach notification
    await enqueueJob({
      type: "sla_breach_notification",
      data: {
        tenantId,
        conversationId,
        customerId,
        breachType,
        targetMinutes,
        actualMinutes,
      },
    });
  },

  /**
   * Get SLA breaches
   */
  async getBreaches(
    tenantId: string,
    options?: {
      isResolved?: boolean;
      breachType?: SLABreach["breachType"];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<SLABreach[]> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("sla_breaches")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (options?.isResolved !== undefined) {
      query = query.eq("is_resolved", options.isResolved);
    }

    if (options?.breachType) {
      query = query.eq("breach_type", options.breachType);
    }

    if (options?.startDate) {
      query = query.gte("created_at", options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte("created_at", options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data } = await query;

    return (data || []).map((b) => {
      const breach = b as {
        id: string;
        tenant_id: string;
        conversation_id: string;
        customer_id: string;
        breach_type: SLABreach["breachType"];
        target_minutes: number;
        actual_minutes: number;
        is_resolved: boolean;
        resolved_at: string | null;
        notified_at: string | null;
        created_at: string;
      };
      return {
        id: breach.id,
        tenantId: breach.tenant_id,
        conversationId: breach.conversation_id,
        customerId: breach.customer_id,
        breachType: breach.breach_type,
        targetMinutes: breach.target_minutes,
        actualMinutes: breach.actual_minutes,
        isResolved: breach.is_resolved,
        resolvedAt: breach.resolved_at ? new Date(breach.resolved_at) : null,
        notifiedAt: breach.notified_at ? new Date(breach.notified_at) : null,
        createdAt: new Date(breach.created_at),
      };
    });
  },

  /**
   * Run SLA check job for all active conversations
   */
  async runSLACheck(): Promise<{
    checked: number;
    breaches: number;
  }> {
    const supabase = await createServiceClient();

    // Get all active conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, tenant_id, customer_id")
      .in("status", ["active", "waiting", "escalated"]);

    let breaches = 0;

    for (const conv of (conversations || []) as Array<{
      id: string;
      tenant_id: string;
      customer_id: string;
    }>) {
      const status = await this.checkConversationSLA(conv.id);

      if (status.firstResponseStatus.isBreached) {
        await this.recordBreach(
          conv.tenant_id,
          conv.id,
          conv.customer_id,
          "first_response",
          status.firstResponseStatus.targetMinutes,
          status.firstResponseStatus.elapsedMinutes
        );
        breaches++;
      }

      if (status.resolutionStatus.isBreached) {
        await this.recordBreach(
          conv.tenant_id,
          conv.id,
          conv.customer_id,
          "resolution",
          status.resolutionStatus.targetMinutes,
          status.resolutionStatus.elapsedMinutes
        );
        breaches++;
      }
    }

    return {
      checked: (conversations || []).length,
      breaches,
    };
  },

  /**
   * Get default SLA configuration
   */
  getDefaultSLAConfig(tenantId: string): SLAConfig {
    return {
      id: "",
      tenantId,
      name: "Default SLA",
      description: "Default SLA configuration",
      targets: {
        firstResponseTime: { target: 5, warning: 3 },
        resolutionTime: { target: 240, warning: 120 },
        aiResponseRate: { target: 80, warning: 70 },
        customerSatisfaction: { target: 4.0, warning: 3.5 },
        escalationRate: { target: 20, warning: 30 },
      },
      businessHours: {
        timezone: "Asia/Seoul",
        schedule: {
          "0": { isWorkday: false, start: "00:00", end: "00:00" },
          "1": { isWorkday: true, start: "09:00", end: "18:00" },
          "2": { isWorkday: true, start: "09:00", end: "18:00" },
          "3": { isWorkday: true, start: "09:00", end: "18:00" },
          "4": { isWorkday: true, start: "09:00", end: "18:00" },
          "5": { isWorkday: true, start: "09:00", end: "18:00" },
          "6": { isWorkday: false, start: "00:00", end: "00:00" },
        },
        holidays: [],
      },
      escalationPolicy: {
        levels: [
          {
            level: 1,
            thresholdMinutes: 15,
            notifyChannels: ["email"],
            notifyUserIds: [],
            autoAssign: false,
          },
          {
            level: 2,
            thresholdMinutes: 60,
            notifyChannels: ["email", "slack"],
            notifyUserIds: [],
            autoAssign: true,
          },
          {
            level: 3,
            thresholdMinutes: 240,
            notifyChannels: ["email", "slack", "sms"],
            notifyUserIds: [],
            autoAssign: true,
          },
        ],
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Map database row to SLAConfig
   */
  mapSLAConfig(data: unknown): SLAConfig {
    const config = data as {
      id: string;
      tenant_id: string;
      name: string;
      description: string | null;
      targets: SLATargets;
      business_hours: BusinessHours;
      escalation_policy: EscalationPolicy;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    return {
      id: config.id,
      tenantId: config.tenant_id,
      name: config.name,
      description: config.description,
      targets: config.targets,
      businessHours: config.business_hours,
      escalationPolicy: config.escalation_policy,
      isActive: config.is_active,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at),
    };
  },
};

export default slaMonitoringService;
