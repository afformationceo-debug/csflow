import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Escalation,
  EscalationPriority,
  EscalationStatus,
  Conversation,
  Customer,
  Message,
} from "@/lib/supabase/types";
import { enqueueJob } from "@/lib/upstash/qstash";

export interface EscalationWithDetails extends Escalation {
  conversation: Conversation & {
    customer: Customer;
  };
  trigger_message?: Message;
}

export interface EscalationFilters {
  tenantId?: string;
  status?: EscalationStatus | EscalationStatus[];
  priority?: EscalationPriority | EscalationPriority[];
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export interface CreateEscalationInput {
  conversationId: string;
  messageId?: string;
  reason: string;
  priority?: EscalationPriority;
  aiConfidence?: number;
  // AI analysis results
  recommendedAction?: "knowledge_base" | "tenant_info";
  missingInfo?: string[];
}

// Client-side service
export const escalationService = {
  async getEscalations(
    filters: EscalationFilters = {}
  ): Promise<EscalationWithDetails[]> {
    const supabase = createClient();

    let query = (supabase
      .from("escalations") as any)
      .select(
        `
        *,
        conversation:conversations(
          *,
          customer:customers(*)
        ),
        trigger_message:messages(*)
      `
      )
      .order("created_at", { ascending: false });

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        query = query.in("priority", filters.priority);
      } else {
        query = query.eq("priority", filters.priority);
      }
    }

    if (filters.assignedTo) {
      query = query.eq("assigned_to", filters.assignedTo);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 20) - 1
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data as unknown as EscalationWithDetails[]) || [];
  },

  async getEscalation(id: string): Promise<EscalationWithDetails | null> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("escalations") as any)
      .select(
        `
        *,
        conversation:conversations(
          *,
          customer:customers(*)
        ),
        trigger_message:messages(*)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    return data as unknown as EscalationWithDetails;
  },

  async assignEscalation(
    escalationId: string,
    userId: string
  ): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("escalations") as any)
      .update({
        assigned_to: userId,
        status: "assigned",
      })
      .eq("id", escalationId);

    if (error) throw error;
  },

  async startProgress(escalationId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("escalations") as any)
      .update({ status: "in_progress" })
      .eq("id", escalationId);

    if (error) throw error;
  },

  async resolveEscalation(
    escalationId: string,
    userId: string,
    resolutionNote?: string
  ): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("escalations") as any)
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_note: resolutionNote,
      })
      .eq("id", escalationId);

    if (error) throw error;

    // Also update conversation status
    const { data: escalation } = await (supabase
      .from("escalations") as any)
      .select("conversation_id")
      .eq("id", escalationId)
      .single();

    if (escalation) {
      await (supabase
        .from("conversations") as any)
        .update({ status: "resolved" })
        .eq("id", escalation.conversation_id);
    }
  },

  async getEscalationCount(
    tenantId?: string,
    status?: EscalationStatus[]
  ): Promise<number> {
    const supabase = createClient();

    let query = (supabase
      .from("escalations") as any)
      .select("*", { count: "exact", head: true });

    if (status) {
      query = query.in("status", status);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  },

  // Real-time subscription
  subscribeToEscalations(
    callback: (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Escalation;
      old: Escalation;
    }) => void
  ) {
    const supabase = createClient();

    return (supabase as any)
      .channel("escalations_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escalations",
        },
        (payload) => {
          callback({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as Escalation,
            old: payload.old as Escalation,
          });
        }
      )
      .subscribe();
  },
};

// Server-side service
export const serverEscalationService = {
  async createEscalation(
    input: CreateEscalationInput
  ): Promise<Escalation> {
    const supabase = await createServiceClient();

    // Update conversation status
    await (supabase
      .from("conversations") as any)
      .update({ status: "escalated" })
      .eq("id", input.conversationId);

    // Store AI recommendation in metadata
    const metadata: any = {};
    if (input.recommendedAction) {
      metadata.recommended_action = input.recommendedAction;
    }
    if (input.missingInfo && input.missingInfo.length > 0) {
      metadata.missing_info = input.missingInfo;
    }

    // Create escalation
    const { data: escalation, error } = await (supabase
      .from("escalations") as any)
      .insert({
        conversation_id: input.conversationId,
        message_id: input.messageId,
        reason: input.reason,
        priority: input.priority || "medium",
        ai_confidence: input.aiConfidence,
        status: "pending",
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
      .select()
      .single();

    if (error) throw error;

    // Queue notification job
    await enqueueJob({
      type: "send_escalation_notification",
      data: {
        escalationId: escalation.id,
        conversationId: input.conversationId,
        reason: input.reason,
        priority: input.priority || "medium",
      },
    });

    return escalation;
  },

  async autoAssignEscalation(escalationId: string): Promise<string | null> {
    const supabase = await createServiceClient();

    // Get escalation details
    const { data: escalation } = await (supabase
      .from("escalations") as any)
      .select(
        `
        *,
        conversation:conversations(tenant_id)
      `
      )
      .eq("id", escalationId)
      .single();

    if (!escalation) return null;

    const tenantId = (
      escalation.conversation as { tenant_id: string }
    ).tenant_id;

    // Find available agent with least workload
    const { data: agents } = await (supabase
      .from("users") as any)
      .select("id")
      .contains("tenant_ids", [tenantId])
      .in("role", ["agent", "manager"])
      .eq("is_active", true);

    if (!agents || agents.length === 0) return null;

    // Get escalation counts per agent
    const { data: counts } = await (supabase
      .from("escalations") as any)
      .select("assigned_to")
      .in("status", ["assigned", "in_progress"])
      .in(
        "assigned_to",
        agents.map((a: { id: string }) => a.id)
      );

    const countMap = new Map<string, number>();
    agents.forEach((a) => countMap.set(a.id, 0));
    counts?.forEach((c) => {
      if (c.assigned_to) {
        countMap.set(c.assigned_to, (countMap.get(c.assigned_to) || 0) + 1);
      }
    });

    // Find agent with least workload
    let minAgent = agents[0].id;
    let minCount = countMap.get(minAgent) || 0;

    agents.forEach((agent) => {
      const count = countMap.get(agent.id) || 0;
      if (count < minCount) {
        minCount = count;
        minAgent = agent.id;
      }
    });

    // Assign escalation
    await (supabase
      .from("escalations") as any)
      .update({
        assigned_to: minAgent,
        status: "assigned",
      })
      .eq("id", escalationId);

    return minAgent;
  },

  async getEscalationMetrics(
    tenantId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    total: number;
    pending: number;
    avgResolutionTime: number;
    byPriority: Record<EscalationPriority, number>;
    byReason: Record<string, number>;
  }> {
    const supabase = await createServiceClient();

    let query = (supabase
      .from("escalations") as any)
      .select(
        `
        *,
        conversation:conversations!inner(tenant_id)
      `
      )
      .eq("conversation.tenant_id", tenantId);

    if (dateRange) {
      query = query
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
    }

    const { data: escalations } = await query;

    if (!escalations) {
      return {
        total: 0,
        pending: 0,
        avgResolutionTime: 0,
        byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
        byReason: {},
      };
    }

    const total = escalations.length;
    const pending = escalations.filter(
      (e) => e.status === "pending" || e.status === "assigned"
    ).length;

    // Calculate average resolution time
    const resolved = escalations.filter(
      (e) => e.status === "resolved" && e.resolved_at
    );
    const avgResolutionTime =
      resolved.length > 0
        ? resolved.reduce((sum, e) => {
            const created = new Date(e.created_at).getTime();
            const resolved = new Date(e.resolved_at!).getTime();
            return sum + (resolved - created);
          }, 0) /
          resolved.length /
          (1000 * 60) // Convert to minutes
        : 0;

    // Count by priority
    const byPriority: Record<EscalationPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    escalations.forEach((e) => {
      byPriority[e.priority]++;
    });

    // Count by reason
    const byReason: Record<string, number> = {};
    escalations.forEach((e) => {
      const reason = e.reason.split(":")[0].trim(); // Get main reason
      byReason[reason] = (byReason[reason] || 0) + 1;
    });

    return {
      total,
      pending,
      avgResolutionTime,
      byPriority,
      byReason,
    };
  },
};
