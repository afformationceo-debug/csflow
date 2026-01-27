/**
 * External API Service
 * Provides public API for third-party integrations
 */

import { createServiceClient } from "@/lib/supabase/server";
import { auditLogService } from "./audit-log";
import crypto from "crypto";

export interface APIKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string; // First 8 characters for identification
  keyHash: string; // SHA-256 hash of the full key
  permissions: APIPermission[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  allowedIPs: string[] | null; // null = all IPs allowed
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export type APIPermission =
  | "conversations:read"
  | "conversations:write"
  | "messages:read"
  | "messages:write"
  | "customers:read"
  | "customers:write"
  | "knowledge:read"
  | "knowledge:write"
  | "analytics:read"
  | "webhooks:manage";

export interface APIKeyCreateInput {
  tenantId: string;
  name: string;
  permissions: APIPermission[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  allowedIPs?: string[];
  expiresAt?: Date;
  createdBy: string;
}

export interface APIKeyValidation {
  isValid: boolean;
  apiKey?: APIKey;
  error?: string;
}

export interface WebhookConfig {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  headers: Record<string, string>;
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    retryDelayMs: number;
  };
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: "success" | "failed" | null;
  failureCount: number;
  createdAt: Date;
}

export type WebhookEvent =
  | "conversation.created"
  | "conversation.updated"
  | "conversation.resolved"
  | "message.received"
  | "message.sent"
  | "escalation.created"
  | "escalation.resolved"
  | "customer.created"
  | "customer.updated"
  | "booking.created"
  | "booking.updated";

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  deliveredAt: Date | null;
  attempts: number;
  nextRetryAt: Date | null;
  status: "pending" | "delivered" | "failed";
  createdAt: Date;
}

export interface APIRateLimitStatus {
  apiKeyId: string;
  minuteWindow: {
    current: number;
    limit: number;
    resetAt: Date;
  };
  dayWindow: {
    current: number;
    limit: number;
    resetAt: Date;
  };
  isLimited: boolean;
}

/**
 * External API Service
 */
export const externalApiService = {
  /**
   * Create API key
   */
  async createAPIKey(input: APIKeyCreateInput): Promise<{
    apiKey: APIKey;
    secretKey: string; // Only returned once at creation
  }> {
    const supabase = await createServiceClient();

    // Generate secure API key
    const secretKey = `csa_${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = secretKey.slice(0, 12);
    const keyHash = crypto.createHash("sha256").update(secretKey).digest("hex");

    const { data, error } = await (supabase as any)
      .from("api_keys")
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        permissions: input.permissions,
        rate_limit: input.rateLimit || {
          requestsPerMinute: 60,
          requestsPerDay: 10000,
        },
        allowed_ips: input.allowedIPs || null,
        expires_at: input.expiresAt?.toISOString() || null,
        is_active: true,
        created_by: input.createdBy,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    const apiKey = this.mapAPIKey(data);

    await auditLogService.log({
      tenantId: input.tenantId,
      userId: input.createdBy,
      action: "api.key_created",
      description: `API key "${input.name}" created`,
      resourceType: "api_key",
      resourceId: apiKey.id,
      metadata: {
        permissions: input.permissions,
        keyPrefix,
      },
    });

    return { apiKey, secretKey };
  },

  /**
   * Validate API key
   */
  async validateAPIKey(
    key: string,
    requiredPermission?: APIPermission,
    clientIP?: string
  ): Promise<APIKeyValidation> {
    const supabase = await createServiceClient();

    // Extract prefix and hash the key
    const keyPrefix = key.slice(0, 12);
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");

    const { data } = await (supabase as any)
      .from("api_keys")
      .select("*")
      .eq("key_prefix", keyPrefix)
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (!data) {
      return { isValid: false, error: "Invalid API key" };
    }

    const apiKey = this.mapAPIKey(data);

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { isValid: false, error: "API key has expired" };
    }

    // Check IP restrictions
    if (apiKey.allowedIPs && clientIP) {
      if (!apiKey.allowedIPs.includes(clientIP)) {
        await auditLogService.log({
          tenantId: apiKey.tenantId,
          action: "api.request",
          severity: "warning",
          description: `API request blocked: IP ${clientIP} not allowed`,
          resourceType: "api_key",
          resourceId: apiKey.id,
        });
        return { isValid: false, error: "IP address not allowed" };
      }
    }

    // Check permission
    if (requiredPermission && !apiKey.permissions.includes(requiredPermission)) {
      return { isValid: false, error: "Insufficient permissions" };
    }

    // Update last used
    await (supabase as any)
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: apiKey.usageCount + 1,
      })
      .eq("id", apiKey.id);

    return { isValid: true, apiKey };
  },

  /**
   * Check rate limit
   */
  async checkRateLimit(apiKeyId: string): Promise<APIRateLimitStatus> {
    const supabase = await createServiceClient();

    const { data: apiKey } = await (supabase as any)
      .from("api_keys")
      .select("rate_limit")
      .eq("id", apiKeyId)
      .single();

    if (!apiKey) {
      throw new Error("API key not found");
    }

    const rateLimit = (apiKey as { rate_limit: APIKey["rateLimit"] }).rate_limit;
    const now = new Date();

    // Get current minute window
    const minuteStart = new Date(now);
    minuteStart.setSeconds(0, 0);

    const { count: minuteCount } = await (supabase as any)
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .gte("created_at", minuteStart.toISOString());

    // Get current day window
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const { count: dayCount } = await (supabase as any)
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .gte("created_at", dayStart.toISOString());

    const minuteReset = new Date(minuteStart);
    minuteReset.setMinutes(minuteReset.getMinutes() + 1);

    const dayReset = new Date(dayStart);
    dayReset.setDate(dayReset.getDate() + 1);

    const isLimited =
      (minuteCount || 0) >= rateLimit.requestsPerMinute ||
      (dayCount || 0) >= rateLimit.requestsPerDay;

    return {
      apiKeyId,
      minuteWindow: {
        current: minuteCount || 0,
        limit: rateLimit.requestsPerMinute,
        resetAt: minuteReset,
      },
      dayWindow: {
        current: dayCount || 0,
        limit: rateLimit.requestsPerDay,
        resetAt: dayReset,
      },
      isLimited,
    };
  },

  /**
   * Log API request
   */
  async logRequest(
    apiKeyId: string,
    request: {
      method: string;
      path: string;
      statusCode: number;
      responseTimeMs: number;
      clientIP?: string;
    }
  ): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("api_request_logs").insert({
      api_key_id: apiKeyId,
      method: request.method,
      path: request.path,
      status_code: request.statusCode,
      response_time_ms: request.responseTimeMs,
      client_ip: request.clientIP,
      created_at: new Date().toISOString(),
    });
  },

  /**
   * Revoke API key
   */
  async revokeAPIKey(
    apiKeyId: string,
    userId: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    const { data: apiKey } = await (supabase as any)
      .from("api_keys")
      .select("tenant_id, name")
      .eq("id", apiKeyId)
      .single();

    if (!apiKey) {
      throw new Error("API key not found");
    }

    await (supabase as any)
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", apiKeyId);

    await auditLogService.log({
      tenantId: (apiKey as { tenant_id: string }).tenant_id,
      userId,
      action: "api.key_revoked",
      description: `API key "${(apiKey as { name: string }).name}" revoked`,
      resourceType: "api_key",
      resourceId: apiKeyId,
    });
  },

  /**
   * List API keys for tenant
   */
  async listAPIKeys(tenantId: string): Promise<APIKey[]> {
    const supabase = await createServiceClient();

    const { data } = await (supabase as any)
      .from("api_keys")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    return (data || []).map(this.mapAPIKey);
  },

  /**
   * Create webhook configuration
   */
  async createWebhook(
    tenantId: string,
    input: {
      name: string;
      url: string;
      events: WebhookEvent[];
      headers?: Record<string, string>;
      retryPolicy?: WebhookConfig["retryPolicy"];
    }
  ): Promise<WebhookConfig> {
    const supabase = await createServiceClient();

    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    const { data, error } = await (supabase as any)
      .from("webhooks")
      .insert({
        tenant_id: tenantId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret,
        headers: input.headers || {},
        is_active: true,
        retry_policy: input.retryPolicy || {
          maxRetries: 3,
          retryDelayMs: 5000,
        },
        failure_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook: ${error.message}`);
    }

    return this.mapWebhook(data);
  },

  /**
   * List webhooks for tenant
   */
  async listWebhooks(tenantId: string): Promise<WebhookConfig[]> {
    const supabase = await createServiceClient();

    const { data } = await (supabase as any)
      .from("webhooks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    return (data || []).map(this.mapWebhook);
  },

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<WebhookConfig, "name" | "url" | "events" | "headers" | "isActive" | "retryPolicy">>
  ): Promise<WebhookConfig> {
    const supabase = await createServiceClient();

    const updatePayload: Record<string, unknown> = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.url !== undefined) updatePayload.url = updates.url;
    if (updates.events !== undefined) updatePayload.events = updates.events;
    if (updates.headers !== undefined) updatePayload.headers = updates.headers;
    if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;
    if (updates.retryPolicy !== undefined) updatePayload.retry_policy = updates.retryPolicy;

    const { data, error } = await (supabase as any)
      .from("webhooks")
      .update(updatePayload)
      .eq("id", webhookId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update webhook: ${error.message}`);
    }

    return this.mapWebhook(data);
  },

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("webhooks").delete().eq("id", webhookId);
  },

  /**
   * Trigger webhook event
   */
  async triggerWebhook(
    tenantId: string,
    event: WebhookEvent,
    payload: unknown
  ): Promise<void> {
    const supabase = await createServiceClient();

    // Find active webhooks subscribed to this event
    const { data: webhooks } = await (supabase as any)
      .from("webhooks")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (!webhooks || webhooks.length === 0) return;

    // Queue deliveries for each webhook
    for (const webhook of webhooks as Array<{
      id: string;
      url: string;
      secret: string;
      headers: Record<string, string>;
    }>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("webhook_deliveries").insert({
        webhook_id: webhook.id,
        event,
        payload,
        status: "pending",
        attempts: 0,
      });
    }

    // In production, this would trigger a background job to process deliveries
    // For now, we'll process synchronously
    for (const webhook of webhooks as Array<{
      id: string;
      url: string;
      secret: string;
      headers: Record<string, string>;
    }>) {
      await this.deliverWebhook(webhook.id, event, payload);
    }
  },

  /**
   * Deliver webhook
   */
  async deliverWebhook(
    webhookId: string,
    event: WebhookEvent,
    payload: unknown
  ): Promise<boolean> {
    const supabase = await createServiceClient();

    const { data: webhook } = await (supabase as any)
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .single();

    if (!webhook) return false;

    const webhookConfig = this.mapWebhook(webhook);
    const timestamp = Math.floor(Date.now() / 1000);

    // Create signature
    const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac("sha256", webhookConfig.secret)
      .update(signaturePayload)
      .digest("hex");

    try {
      const response = await fetch(webhookConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Timestamp": timestamp.toString(),
          "X-Webhook-Signature": `v1=${signature}`,
          ...webhookConfig.headers,
        },
        body: JSON.stringify({
          event,
          timestamp,
          payload,
        }),
      });

      // Update webhook status
      await (supabase as any)
        .from("webhooks")
        .update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: response.ok ? "success" : "failed",
          failure_count: response.ok ? 0 : webhookConfig.failureCount + 1,
        })
        .eq("id", webhookId);

      return response.ok;
    } catch (error) {
      await (supabase as any)
        .from("webhooks")
        .update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: "failed",
          failure_count: webhookConfig.failureCount + 1,
        })
        .eq("id", webhookId);

      return false;
    }
  },

  /**
   * Generate API documentation
   */
  getAPIDocumentation(): object {
    return {
      openapi: "3.0.0",
      info: {
        title: "CS Automation API",
        version: "1.0.0",
        description: "External API for CS Automation Platform",
      },
      servers: [
        {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1`,
          description: "Production server",
        },
      ],
      security: [
        {
          apiKey: [],
        },
      ],
      paths: {
        "/conversations": {
          get: {
            summary: "List conversations",
            tags: ["Conversations"],
            parameters: [
              {
                name: "status",
                in: "query",
                schema: { type: "string", enum: ["active", "waiting", "resolved", "escalated"] },
              },
              {
                name: "limit",
                in: "query",
                schema: { type: "integer", default: 20 },
              },
              {
                name: "offset",
                in: "query",
                schema: { type: "integer", default: 0 },
              },
            ],
            responses: {
              "200": {
                description: "List of conversations",
              },
            },
          },
        },
        "/conversations/{id}": {
          get: {
            summary: "Get conversation by ID",
            tags: ["Conversations"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "Conversation details",
              },
            },
          },
        },
        "/conversations/{id}/messages": {
          get: {
            summary: "Get messages for a conversation",
            tags: ["Messages"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "List of messages",
              },
            },
          },
          post: {
            summary: "Send a message",
            tags: ["Messages"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      content: { type: "string" },
                      contentType: { type: "string", enum: ["text", "image"] },
                    },
                    required: ["content"],
                  },
                },
              },
            },
            responses: {
              "201": {
                description: "Message sent",
              },
            },
          },
        },
        "/customers": {
          get: {
            summary: "List customers",
            tags: ["Customers"],
            responses: {
              "200": {
                description: "List of customers",
              },
            },
          },
        },
        "/customers/{id}": {
          get: {
            summary: "Get customer by ID",
            tags: ["Customers"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "Customer details",
              },
            },
          },
        },
        "/analytics/overview": {
          get: {
            summary: "Get analytics overview",
            tags: ["Analytics"],
            responses: {
              "200": {
                description: "Analytics overview metrics",
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
        },
      },
    };
  },

  /**
   * Map API key from database
   */
  mapAPIKey(data: unknown): APIKey {
    const row = data as {
      id: string;
      tenant_id: string;
      name: string;
      key_prefix: string;
      key_hash: string;
      permissions: APIPermission[];
      rate_limit: APIKey["rateLimit"];
      allowed_ips: string[] | null;
      expires_at: string | null;
      last_used_at: string | null;
      usage_count: number;
      is_active: boolean;
      created_by: string;
      created_at: string;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      permissions: row.permissions,
      rateLimit: row.rate_limit,
      allowedIPs: row.allowed_ips,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      usageCount: row.usage_count,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  },

  /**
   * Map webhook from database
   */
  mapWebhook(data: unknown): WebhookConfig {
    const row = data as {
      id: string;
      tenant_id: string;
      name: string;
      url: string;
      events: WebhookEvent[];
      secret: string;
      headers: Record<string, string>;
      is_active: boolean;
      retry_policy: WebhookConfig["retryPolicy"];
      last_delivery_at: string | null;
      last_delivery_status: "success" | "failed" | null;
      failure_count: number;
      created_at: string;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      url: row.url,
      events: row.events,
      secret: row.secret,
      headers: row.headers,
      isActive: row.is_active,
      retryPolicy: row.retry_policy,
      lastDeliveryAt: row.last_delivery_at ? new Date(row.last_delivery_at) : null,
      lastDeliveryStatus: row.last_delivery_status,
      failureCount: row.failure_count,
      createdAt: new Date(row.created_at),
    };
  },
};

export default externalApiService;
