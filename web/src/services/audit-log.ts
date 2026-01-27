/**
 * Audit Log Service
 * Comprehensive logging for security, compliance, and debugging
 */

import { createServiceClient } from "@/lib/supabase/server";

export type AuditAction =
  // Authentication
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.password_reset"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  // User Management
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.invited"
  | "user.role_changed"
  | "user.deactivated"
  | "user.activated"
  // Tenant Management
  | "tenant.created"
  | "tenant.updated"
  | "tenant.settings_changed"
  | "tenant.ai_config_changed"
  | "tenant.subscription_changed"
  // Channel Management
  | "channel.created"
  | "channel.updated"
  | "channel.deleted"
  | "channel.credentials_updated"
  // Conversation
  | "conversation.created"
  | "conversation.assigned"
  | "conversation.status_changed"
  | "conversation.resolved"
  | "conversation.reopened"
  // Message
  | "message.sent"
  | "message.deleted"
  | "message.ai_response"
  // Escalation
  | "escalation.created"
  | "escalation.assigned"
  | "escalation.resolved"
  // Knowledge Base
  | "knowledge.document_created"
  | "knowledge.document_updated"
  | "knowledge.document_deleted"
  | "knowledge.bulk_import"
  // Automation
  | "automation.rule_created"
  | "automation.rule_updated"
  | "automation.rule_deleted"
  | "automation.rule_executed"
  // CRM
  | "crm.customer_synced"
  | "crm.booking_created"
  | "crm.booking_updated"
  // Data Export
  | "export.requested"
  | "export.completed"
  // API
  | "api.key_created"
  | "api.key_revoked"
  | "api.request"
  // System
  | "system.error"
  | "system.warning"
  | "system.maintenance";

export type AuditSeverity = "info" | "warning" | "error" | "critical";

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: AuditAction;
  severity: AuditSeverity;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}

export interface AuditLogFilter {
  tenantId?: string;
  userId?: string;
  action?: AuditAction | AuditAction[];
  severity?: AuditSeverity | AuditSeverity[];
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogInput {
  tenantId?: string | null;
  userId?: string | null;
  action: AuditAction;
  severity?: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Audit Log Service
 */
export const auditLogService = {
  /**
   * Log an audit event
   */
  async log(input: AuditLogInput): Promise<string> {
    const supabase = await createServiceClient();

    const severity = input.severity || this.getDefaultSeverity(input.action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("audit_logs")
      .insert({
        tenant_id: input.tenantId || null,
        user_id: input.userId || null,
        action: input.action,
        severity,
        resource_type: input.resourceType || null,
        resource_id: input.resourceId || null,
        description: input.description,
        metadata: input.metadata || {},
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        request_id: input.requestId || null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      // Don't throw - audit logging should not break the main flow
      console.error("Failed to write audit log:", error);
      return "";
    }

    const logId = (data as { id: string }).id;

    // For critical events, send immediate notification
    if (severity === "critical") {
      await this.notifyCriticalEvent(input, logId);
    }

    return logId;
  },

  /**
   * Query audit logs
   */
  async query(filter: AuditLogFilter): Promise<{
    logs: AuditLogEntry[];
    total: number;
  }> {
    const supabase = await createServiceClient();

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" });

    if (filter.tenantId) {
      query = query.eq("tenant_id", filter.tenantId);
    }

    if (filter.userId) {
      query = query.eq("user_id", filter.userId);
    }

    if (filter.action) {
      if (Array.isArray(filter.action)) {
        query = query.in("action", filter.action);
      } else {
        query = query.eq("action", filter.action);
      }
    }

    if (filter.severity) {
      if (Array.isArray(filter.severity)) {
        query = query.in("severity", filter.severity);
      } else {
        query = query.eq("severity", filter.severity);
      }
    }

    if (filter.resourceType) {
      query = query.eq("resource_type", filter.resourceType);
    }

    if (filter.resourceId) {
      query = query.eq("resource_id", filter.resourceId);
    }

    if (filter.startDate) {
      query = query.gte("created_at", filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query = query.lte("created_at", filter.endDate.toISOString());
    }

    if (filter.search) {
      query = query.ilike("description", `%${filter.search}%`);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(
        filter.offset || 0,
        (filter.offset || 0) + (filter.limit || 50) - 1
      );

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to query audit logs: ${error.message}`);
    }

    const logs = (data || []).map((row) => {
      const log = row as {
        id: string;
        tenant_id: string | null;
        user_id: string | null;
        action: AuditAction;
        severity: AuditSeverity;
        resource_type: string | null;
        resource_id: string | null;
        description: string;
        metadata: Record<string, unknown>;
        ip_address: string | null;
        user_agent: string | null;
        request_id: string | null;
        created_at: string;
      };
      return {
        id: log.id,
        tenantId: log.tenant_id,
        userId: log.user_id,
        action: log.action,
        severity: log.severity,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        description: log.description,
        metadata: log.metadata,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        requestId: log.request_id,
        createdAt: new Date(log.created_at),
      };
    });

    return { logs, total: count || 0 };
  },

  /**
   * Get audit log by ID
   */
  async getById(logId: string): Promise<AuditLogEntry | null> {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (error || !data) {
      return null;
    }

    const log = data as {
      id: string;
      tenant_id: string | null;
      user_id: string | null;
      action: AuditAction;
      severity: AuditSeverity;
      resource_type: string | null;
      resource_id: string | null;
      description: string;
      metadata: Record<string, unknown>;
      ip_address: string | null;
      user_agent: string | null;
      request_id: string | null;
      created_at: string;
    };

    return {
      id: log.id,
      tenantId: log.tenant_id,
      userId: log.user_id,
      action: log.action,
      severity: log.severity,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      description: log.description,
      metadata: log.metadata,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      requestId: log.request_id,
      createdAt: new Date(log.created_at),
    };
  },

  /**
   * Get audit summary for a tenant
   */
  async getSummary(
    tenantId: string,
    days: number = 30
  ): Promise<{
    totalEvents: number;
    bySeverity: Record<AuditSeverity, number>;
    byAction: Record<string, number>;
    recentCritical: AuditLogEntry[];
    dailyTrend: Array<{ date: string; count: number }>;
  }> {
    const supabase = await createServiceClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all logs in period
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("action, severity, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString());

    const typedLogs = (logs || []) as Array<{
      action: AuditAction;
      severity: AuditSeverity;
      created_at: string;
    }>;

    // Calculate summaries
    const bySeverity: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byAction: Record<string, number> = {};
    const dailyCount: Record<string, number> = {};

    typedLogs.forEach((log) => {
      bySeverity[log.severity]++;

      const actionCategory = log.action.split(".")[0];
      byAction[actionCategory] = (byAction[actionCategory] || 0) + 1;

      const date = log.created_at.slice(0, 10);
      dailyCount[date] = (dailyCount[date] || 0) + 1;
    });

    // Get recent critical events
    const { logs: recentCritical } = await this.query({
      tenantId,
      severity: "critical",
      limit: 5,
    });

    // Build daily trend
    const dailyTrend: Array<{ date: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      dailyTrend.push({
        date: dateStr,
        count: dailyCount[dateStr] || 0,
      });
    }

    return {
      totalEvents: typedLogs.length,
      bySeverity,
      byAction,
      recentCritical,
      dailyTrend,
    };
  },

  /**
   * Export audit logs
   */
  async export(
    filter: AuditLogFilter,
    format: "json" | "csv"
  ): Promise<string> {
    const { logs } = await this.query({ ...filter, limit: 10000 });

    if (format === "json") {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = [
      "id",
      "tenantId",
      "userId",
      "action",
      "severity",
      "resourceType",
      "resourceId",
      "description",
      "ipAddress",
      "userAgent",
      "createdAt",
    ];

    const rows = logs.map((log) => [
      log.id,
      log.tenantId || "",
      log.userId || "",
      log.action,
      log.severity,
      log.resourceType || "",
      log.resourceId || "",
      `"${log.description.replace(/"/g, '""')}"`,
      log.ipAddress || "",
      log.userAgent || "",
      log.createdAt.toISOString(),
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },

  /**
   * Cleanup old audit logs
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    const supabase = await createServiceClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Keep critical and error logs longer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: deletedInfo } = await (supabase as any)
      .from("audit_logs")
      .delete({ count: "exact" })
      .in("severity", ["info", "warning"])
      .lt("created_at", cutoffDate.toISOString());

    // Critical/error logs kept for 1 year
    const criticalCutoff = new Date();
    criticalCutoff.setDate(criticalCutoff.getDate() - 365);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: deletedCritical } = await (supabase as any)
      .from("audit_logs")
      .delete({ count: "exact" })
      .in("severity", ["error", "critical"])
      .lt("created_at", criticalCutoff.toISOString());

    return (deletedInfo || 0) + (deletedCritical || 0);
  },

  /**
   * Get default severity for action
   */
  getDefaultSeverity(action: AuditAction): AuditSeverity {
    const criticalActions: AuditAction[] = [
      "auth.login_failed",
      "user.deleted",
      "tenant.subscription_changed",
      "channel.credentials_updated",
      "api.key_created",
      "api.key_revoked",
      "system.error",
    ];

    const warningActions: AuditAction[] = [
      "user.deactivated",
      "user.role_changed",
      "escalation.created",
      "knowledge.document_deleted",
      "automation.rule_deleted",
      "system.warning",
    ];

    if (criticalActions.includes(action)) return "critical";
    if (warningActions.includes(action)) return "warning";
    return "info";
  },

  /**
   * Notify for critical events
   */
  async notifyCriticalEvent(
    input: AuditLogInput,
    logId: string
  ): Promise<void> {
    // TODO: Implement notification via Slack, email, etc.
    console.warn(
      `[CRITICAL AUDIT EVENT] ${input.action}: ${input.description} (Log ID: ${logId})`
    );
  },

  /**
   * Helper: Log authentication event
   */
  async logAuth(
    action: "login" | "logout" | "login_failed" | "password_reset",
    userId: string | null,
    metadata: {
      email?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<string> {
    return this.log({
      userId,
      action: `auth.${action}` as AuditAction,
      description:
        action === "login_failed"
          ? `Login attempt failed for ${metadata.email}`
          : `User ${action}`,
      metadata,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  },

  /**
   * Helper: Log resource change
   */
  async logResourceChange(
    action: "created" | "updated" | "deleted",
    resourceType: string,
    resourceId: string,
    options: {
      tenantId?: string;
      userId?: string;
      description?: string;
      oldValue?: unknown;
      newValue?: unknown;
    }
  ): Promise<string> {
    const actionMap: Record<string, AuditAction> = {
      "user.created": "user.created",
      "user.updated": "user.updated",
      "user.deleted": "user.deleted",
      "channel.created": "channel.created",
      "channel.updated": "channel.updated",
      "channel.deleted": "channel.deleted",
      "knowledge.created": "knowledge.document_created",
      "knowledge.updated": "knowledge.document_updated",
      "knowledge.deleted": "knowledge.document_deleted",
      "automation.created": "automation.rule_created",
      "automation.updated": "automation.rule_updated",
      "automation.deleted": "automation.rule_deleted",
    };

    const fullAction = `${resourceType}.${action}`;
    const auditAction =
      actionMap[fullAction] || (`${resourceType}.${action}` as AuditAction);

    return this.log({
      tenantId: options.tenantId,
      userId: options.userId,
      action: auditAction,
      resourceType,
      resourceId,
      description:
        options.description || `${resourceType} ${resourceId} ${action}`,
      metadata: {
        oldValue: options.oldValue,
        newValue: options.newValue,
      },
    });
  },
};

export default auditLogService;
