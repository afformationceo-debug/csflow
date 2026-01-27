/**
 * Tenant Management Service
 * Handles multi-tenant isolation, configuration, and administration
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface TenantConfig {
  id: string;
  name: string;
  displayName: string;
  specialty: string | null;
  logoUrl: string | null;
  settings: TenantSettings;
  aiConfig: TenantAIConfig;
  subscription: TenantSubscription;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  timezone: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  workingHours: {
    start: string;
    end: string;
    days: number[]; // 0-6, Sunday-Saturday
  };
  autoResponseEnabled: boolean;
  escalationEmail: string | null;
  notificationChannels: {
    slack?: { webhookUrl: string; channel: string };
    email?: { recipients: string[] };
    kakao?: { templateId: string };
  };
  customBranding?: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
}

export interface TenantAIConfig {
  enabled: boolean;
  confidenceThreshold: number;
  maxResponseLength: number;
  preferredModel: "gpt-4" | "gpt-4-turbo" | "claude-3-opus" | "claude-3-sonnet";
  systemPrompt: string;
  escalationKeywords: string[];
  prohibitedTopics: string[];
  requiredDisclaimers: string[];
  responseStyle: {
    tone: "formal" | "friendly" | "professional";
    language: "simple" | "technical";
  };
}

export interface TenantSubscription {
  plan: "free" | "starter" | "professional" | "enterprise";
  status: "active" | "suspended" | "cancelled";
  messagesPerMonth: number;
  messagesUsed: number;
  aiResponsesPerMonth: number;
  aiResponsesUsed: number;
  maxChannels: number;
  maxUsers: number;
  features: string[];
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;
}

export interface TenantUsage {
  tenantId: string;
  period: string; // YYYY-MM
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  aiResponses: number;
  aiEscalations: number;
  avgResponseTimeMs: number;
  avgAIConfidence: number;
  activeConversations: number;
  resolvedConversations: number;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "manager" | "agent";
  permissions: string[];
  isActive: boolean;
  invitedAt: Date;
  joinedAt: Date | null;
  lastActiveAt: Date | null;
}

/**
 * Tenant Management Service
 */
export const tenantManagementService = {
  /**
   * Get tenant configuration
   */
  async getTenant(tenantId: string): Promise<TenantConfig | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    const tenant = data as {
      id: string;
      name: string;
      display_name: string;
      specialty: string | null;
      logo_url: string | null;
      settings: TenantSettings;
      ai_config: TenantAIConfig;
      subscription?: TenantSubscription;
      created_at: string;
      updated_at: string;
    };

    return {
      id: tenant.id,
      name: tenant.name,
      displayName: tenant.display_name,
      specialty: tenant.specialty,
      logoUrl: tenant.logo_url,
      settings: tenant.settings || this.getDefaultSettings(),
      aiConfig: tenant.ai_config || this.getDefaultAIConfig(),
      subscription: tenant.subscription || this.getDefaultSubscription(),
      createdAt: new Date(tenant.created_at),
      updatedAt: new Date(tenant.updated_at),
    };
  },

  /**
   * Create new tenant
   */
  async createTenant(input: {
    name: string;
    displayName: string;
    specialty?: string;
    adminEmail: string;
    adminName: string;
    plan?: TenantSubscription["plan"];
  }): Promise<{ tenantId: string; adminUserId: string }> {
    const supabase = await createServiceClient();

    // Create tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant, error: tenantError } = await (supabase as any)
      .from("tenants")
      .insert({
        name: input.name,
        display_name: input.displayName,
        specialty: input.specialty,
        settings: this.getDefaultSettings(),
        ai_config: this.getDefaultAIConfig(),
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Failed to create tenant: ${tenantError?.message}`);
    }

    // Create admin user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user, error: userError } = await (supabase as any)
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        email: input.adminEmail,
        name: input.adminName,
        role: "admin",
        tenant_ids: [(tenant as { id: string }).id],
        is_active: true,
      })
      .select()
      .single();

    if (userError || !user) {
      // Rollback tenant creation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("tenants").delete().eq("id", (tenant as { id: string }).id);
      throw new Error(`Failed to create admin user: ${userError?.message}`);
    }

    return {
      tenantId: (tenant as { id: string }).id,
      adminUserId: (user as { id: string }).id,
    };
  },

  /**
   * Update tenant settings
   */
  async updateTenantSettings(
    tenantId: string,
    settings: Partial<TenantSettings>
  ): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const currentSettings = (current as { settings: TenantSettings } | null)?.settings || {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("tenants")
      .update({
        settings: { ...currentSettings, ...settings },
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  },

  /**
   * Update tenant AI configuration
   */
  async updateTenantAIConfig(
    tenantId: string,
    aiConfig: Partial<TenantAIConfig>
  ): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("tenants")
      .select("ai_config")
      .eq("id", tenantId)
      .single();

    const currentConfig = (current as { ai_config: TenantAIConfig } | null)?.ai_config || {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("tenants")
      .update({
        ai_config: { ...currentConfig, ...aiConfig },
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (error) {
      throw new Error(`Failed to update AI config: ${error.message}`);
    }
  },

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(
    tenantId: string,
    period?: string
  ): Promise<TenantUsage> {
    const supabase = await createServiceClient();
    const targetPeriod = period || new Date().toISOString().slice(0, 7);

    const startOfMonth = `${targetPeriod}-01`;
    const endOfMonth = new Date(
      parseInt(targetPeriod.slice(0, 4)),
      parseInt(targetPeriod.slice(5, 7)),
      0
    ).toISOString().slice(0, 10);

    // Get message counts
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    const { count: inboundMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("direction", "inbound")
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    // Get AI response stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: aiLogs } = await (supabase as any)
      .from("ai_response_logs")
      .select("confidence, processing_time_ms, escalated")
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth)
      .lte("created_at", endOfMonth);

    const typedAiLogs = (aiLogs || []) as Array<{
      confidence: number;
      processing_time_ms: number;
      escalated: boolean;
    }>;

    const aiResponses = typedAiLogs.length;
    const aiEscalations = typedAiLogs.filter((l) => l.escalated).length;
    const avgResponseTimeMs = aiResponses
      ? typedAiLogs.reduce((s, l) => s + l.processing_time_ms, 0) / aiResponses
      : 0;
    const avgAIConfidence = aiResponses
      ? typedAiLogs.reduce((s, l) => s + l.confidence, 0) / aiResponses
      : 0;

    // Get conversation counts
    const { count: activeConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "waiting", "escalated"]);

    const { count: resolvedConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "resolved")
      .gte("updated_at", startOfMonth)
      .lte("updated_at", endOfMonth);

    return {
      tenantId,
      period: targetPeriod,
      totalMessages: totalMessages || 0,
      inboundMessages: inboundMessages || 0,
      outboundMessages: (totalMessages || 0) - (inboundMessages || 0),
      aiResponses,
      aiEscalations,
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      avgAIConfidence: Math.round(avgAIConfidence * 100) / 100,
      activeConversations: activeConversations || 0,
      resolvedConversations: resolvedConversations || 0,
    };
  },

  /**
   * List tenant users
   */
  async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .contains("tenant_ids", [tenantId])
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }

    return (data || []).map((u) => {
      const user = u as {
        id: string;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        created_at: string;
        last_login_at: string | null;
      };
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as TenantUser["role"],
        permissions: this.getRolePermissions(user.role as TenantUser["role"]),
        isActive: user.is_active,
        invitedAt: new Date(user.created_at),
        joinedAt: new Date(user.created_at),
        lastActiveAt: user.last_login_at
          ? new Date(user.last_login_at)
          : null,
      };
    });
  },

  /**
   * Invite user to tenant
   */
  async inviteUser(
    tenantId: string,
    input: {
      email: string;
      name: string;
      role: TenantUser["role"];
    }
  ): Promise<{ userId: string; inviteToken: string }> {
    const supabase = await createServiceClient();

    // Check if user already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("users")
      .select("id, tenant_ids")
      .eq("email", input.email)
      .single();

    if (existing) {
      // Add tenant to existing user
      const user = existing as { id: string; tenant_ids: string[] };
      if (!user.tenant_ids.includes(tenantId)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("users")
          .update({
            tenant_ids: [...user.tenant_ids, tenantId],
          })
          .eq("id", user.id);
      }
      return { userId: user.id, inviteToken: "" };
    }

    // Create new user
    const userId = crypto.randomUUID();
    const inviteToken = crypto.randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("users").insert({
      id: userId,
      email: input.email,
      name: input.name,
      role: input.role === "owner" ? "admin" : input.role,
      tenant_ids: [tenantId],
      is_active: false, // Will be activated when invite is accepted
    });

    if (error) {
      throw new Error(`Failed to invite user: ${error.message}`);
    }

    // TODO: Send invite email

    return { userId, inviteToken };
  },

  /**
   * Remove user from tenant
   */
  async removeUser(tenantId: string, userId: string): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user } = await (supabase as any)
      .from("users")
      .select("tenant_ids")
      .eq("id", userId)
      .single();

    if (!user) {
      throw new Error("User not found");
    }

    const tenantIds = ((user as { tenant_ids: string[] }).tenant_ids || []).filter(
      (id) => id !== tenantId
    );

    if (tenantIds.length === 0) {
      // Deactivate user if no more tenants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("users")
        .update({ is_active: false, tenant_ids: [] })
        .eq("id", userId);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("users")
        .update({ tenant_ids: tenantIds })
        .eq("id", userId);
    }
  },

  /**
   * Check if user has permission
   */
  hasPermission(
    userRole: TenantUser["role"],
    permission: string
  ): boolean {
    const permissions = this.getRolePermissions(userRole);
    return permissions.includes(permission) || permissions.includes("*");
  },

  /**
   * Get permissions for role
   */
  getRolePermissions(role: TenantUser["role"]): string[] {
    const permissionMap: Record<TenantUser["role"], string[]> = {
      owner: ["*"],
      admin: [
        "tenant:read",
        "tenant:update",
        "users:manage",
        "channels:manage",
        "knowledge:manage",
        "automation:manage",
        "analytics:read",
        "conversations:manage",
        "escalations:manage",
      ],
      manager: [
        "tenant:read",
        "users:read",
        "channels:read",
        "knowledge:manage",
        "automation:read",
        "analytics:read",
        "conversations:manage",
        "escalations:manage",
      ],
      agent: [
        "tenant:read",
        "knowledge:read",
        "conversations:manage",
        "escalations:handle",
      ],
    };

    return permissionMap[role] || [];
  },

  /**
   * Get default settings
   */
  getDefaultSettings(): TenantSettings {
    return {
      timezone: "Asia/Seoul",
      defaultLanguage: "ko",
      supportedLanguages: ["ko", "en", "ja", "zh", "vi", "th"],
      workingHours: {
        start: "09:00",
        end: "18:00",
        days: [1, 2, 3, 4, 5], // Monday to Friday
      },
      autoResponseEnabled: true,
      escalationEmail: null,
      notificationChannels: {},
    };
  },

  /**
   * Get default AI config
   */
  getDefaultAIConfig(): TenantAIConfig {
    return {
      enabled: true,
      confidenceThreshold: 0.75,
      maxResponseLength: 500,
      preferredModel: "gpt-4-turbo",
      systemPrompt: "",
      escalationKeywords: ["긴급", "불만", "환불", "취소", "화남"],
      prohibitedTopics: [],
      requiredDisclaimers: [],
      responseStyle: {
        tone: "professional",
        language: "simple",
      },
    };
  },

  /**
   * Get default subscription
   */
  getDefaultSubscription(): TenantSubscription {
    return {
      plan: "free",
      status: "active",
      messagesPerMonth: 1000,
      messagesUsed: 0,
      aiResponsesPerMonth: 500,
      aiResponsesUsed: 0,
      maxChannels: 2,
      maxUsers: 3,
      features: ["basic_inbox", "basic_ai"],
      billingCycle: "monthly",
      nextBillingDate: "",
    };
  },

  /**
   * Validate tenant access for a user
   */
  async validateTenantAccess(
    userId: string,
    tenantId: string
  ): Promise<{ hasAccess: boolean; role: TenantUser["role"] | null }> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user } = await (supabase as any)
      .from("users")
      .select("tenant_ids, role, is_active")
      .eq("id", userId)
      .single();

    if (!user) {
      return { hasAccess: false, role: null };
    }

    const userData = user as {
      tenant_ids: string[];
      role: string;
      is_active: boolean;
    };

    if (!userData.is_active) {
      return { hasAccess: false, role: null };
    }

    const hasAccess = (userData.tenant_ids || []).includes(tenantId);
    return {
      hasAccess,
      role: hasAccess ? (userData.role as TenantUser["role"]) : null,
    };
  },
};

export default tenantManagementService;
