import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Force dynamic - no caching for real-time data
export const dynamic = "force-dynamic";

// Default AI config for tenants that don't have one set
const DEFAULT_AI_CONFIG = {
  preferred_model: "gpt-4",
  confidence_threshold: 0.85,
  auto_response_enabled: true,
  system_prompt: "",
  escalation_keywords: [] as string[],
};

/**
 * GET /api/tenants
 * List all tenants with channel accounts, computed stats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // 1. Fetch tenants
    const { data: tenants, error: tenantError } = await (supabase as any)
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (tenantError) {
      console.error("Tenants fetch error:", tenantError);
      return NextResponse.json({ error: tenantError.message }, { status: 500 });
    }

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ tenants: [] });
    }

    const tenantIds = tenants.map((t: Record<string, unknown>) => t.id);

    // 2. Fetch channel_accounts for all tenants
    const { data: channels, error: channelError } = await (supabase as any)
      .from("channel_accounts")
      .select("id, tenant_id, channel_type, account_name, is_active")
      .in("tenant_id", tenantIds);

    if (channelError) {
      console.error("Channel accounts fetch error:", channelError);
    }

    // Group channels by tenant_id
    const channelsByTenant: Record<string, Array<{ type: string; accountName: string }>> = {};
    if (channels) {
      for (const ch of channels) {
        const tid = ch.tenant_id as string;
        if (!channelsByTenant[tid]) {
          channelsByTenant[tid] = [];
        }
        channelsByTenant[tid].push({
          type: ch.channel_type,
          accountName: ch.account_name,
        });
      }
    }

    // 3. Fetch conversation counts per tenant
    const { data: convCounts, error: convError } = await (supabase as any)
      .from("conversations")
      .select("tenant_id")
      .in("tenant_id", tenantIds);

    if (convError) {
      console.error("Conversations count error:", convError);
    }

    // Count conversations per tenant
    const totalConvByTenant: Record<string, number> = {};
    if (convCounts) {
      for (const c of convCounts) {
        const tid = c.tenant_id as string;
        totalConvByTenant[tid] = (totalConvByTenant[tid] || 0) + 1;
      }
    }

    // 4. Fetch conversations created this month per tenant
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: monthlyConvs, error: monthlyError } = await (supabase as any)
      .from("conversations")
      .select("tenant_id")
      .in("tenant_id", tenantIds)
      .gte("created_at", monthStart);

    if (monthlyError) {
      console.error("Monthly conversations error:", monthlyError);
    }

    const monthlyByTenant: Record<string, number> = {};
    if (monthlyConvs) {
      for (const c of monthlyConvs) {
        const tid = c.tenant_id as string;
        monthlyByTenant[tid] = (monthlyByTenant[tid] || 0) + 1;
      }
    }

    // 5. Fetch escalation counts per tenant (via conversations)
    const { data: escalations, error: escError } = await (supabase as any)
      .from("escalations")
      .select("conversation_id, conversations!inner(tenant_id)")
      .in("conversations.tenant_id", tenantIds);

    // Group escalation counts by tenant
    const escalationByTenant: Record<string, number> = {};
    if (!escError && escalations) {
      for (const esc of escalations) {
        const tid = (esc.conversations as any)?.tenant_id as string;
        if (tid) {
          escalationByTenant[tid] = (escalationByTenant[tid] || 0) + 1;
        }
      }
    }

    // 6. Fetch AI response logs for accuracy stats
    const { data: aiLogs, error: aiLogError } = await (supabase as any)
      .from("ai_response_logs")
      .select("tenant_id, confidence, feedback")
      .in("tenant_id", tenantIds);

    // Compute AI accuracy per tenant
    const aiStatsByTenant: Record<string, { totalLogs: number; sumConfidence: number; positiveCount: number }> = {};
    if (!aiLogError && aiLogs) {
      for (const log of aiLogs) {
        const tid = log.tenant_id as string;
        if (!aiStatsByTenant[tid]) {
          aiStatsByTenant[tid] = { totalLogs: 0, sumConfidence: 0, positiveCount: 0 };
        }
        aiStatsByTenant[tid].totalLogs += 1;
        aiStatsByTenant[tid].sumConfidence += Number(log.confidence) || 0;
        if (log.feedback === "positive" || log.feedback === "helpful") {
          aiStatsByTenant[tid].positiveCount += 1;
        }
      }
    }

    // 7. Map to response format
    const mapped = tenants.map((t: Record<string, unknown>) => {
      const tid = t.id as string;
      const totalConv = totalConvByTenant[tid] || 0;
      const escCount = escalationByTenant[tid] || 0;
      const aiStats = aiStatsByTenant[tid];

      // Calculate AI accuracy: use average confidence * 100, or 0 if no logs
      let aiAccuracy = 0;
      if (aiStats && aiStats.totalLogs > 0) {
        aiAccuracy = parseFloat(((aiStats.sumConfidence / aiStats.totalLogs) * 100).toFixed(1));
      }

      // Calculate escalation rate
      const escalationRate = totalConv > 0
        ? parseFloat(((escCount / totalConv) * 100).toFixed(1))
        : 0;

      // Parse ai_config from DB, merge with defaults
      const rawAiConfig = (t.ai_config as Record<string, unknown>) || {};
      const aiConfig = {
        preferred_model: (rawAiConfig.model as string) || (rawAiConfig.preferred_model as string) || DEFAULT_AI_CONFIG.preferred_model,
        confidence_threshold: typeof rawAiConfig.confidence_threshold === "number"
          ? rawAiConfig.confidence_threshold
          : DEFAULT_AI_CONFIG.confidence_threshold,
        auto_response_enabled: typeof rawAiConfig.auto_response_enabled === "boolean"
          ? rawAiConfig.auto_response_enabled
          : (rawAiConfig.enabled !== undefined ? Boolean(rawAiConfig.enabled) : DEFAULT_AI_CONFIG.auto_response_enabled),
        system_prompt: (rawAiConfig.system_prompt as string) || DEFAULT_AI_CONFIG.system_prompt,
        escalation_keywords: Array.isArray(rawAiConfig.escalation_keywords)
          ? rawAiConfig.escalation_keywords
          : DEFAULT_AI_CONFIG.escalation_keywords,
      };

      // Determine display_name: prefer display_name, then name_en, then name
      const displayName = (t.display_name as string) || (t.name_en as string) || (t.name as string);

      // Determine status
      const isActive = t.is_active !== undefined ? Boolean(t.is_active) : true;
      const status = isActive ? "active" : "suspended";

      // Determine default_language from settings
      const settings = (t.settings as Record<string, unknown>) || {};
      const defaultLanguage = (settings.default_language as string) || "ko";

      return {
        id: tid,
        name: t.name,
        display_name: displayName,
        specialty: (t.specialty as string) || "general",
        country: t.country || null,
        status,
        default_language: defaultLanguage,
        logo_url: t.logo_url,
        ai_config: aiConfig,
        stats: {
          total_conversations: totalConv,
          ai_accuracy: aiAccuracy,
          escalation_rate: escalationRate,
          csat_score: 0, // Would need survey data
          monthly_inquiries: monthlyByTenant[tid] || 0,
        },
        channels: channelsByTenant[tid] || [],
        created_at: t.created_at,
      };
    });

    return NextResponse.json({ tenants: mapped });
  } catch (error) {
    console.error("GET /api/tenants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants
 * Create a new tenant
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, name_en, display_name, specialty, default_language, country } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const displayName = display_name || name_en || name;

    const insertData: Record<string, unknown> = {
      name,
      display_name: displayName,
      specialty: specialty || "general",
      country: country || null,
      settings: {
        default_language: default_language || "ko",
      },
      ai_config: {
        model: "gpt-4",
        preferred_model: "gpt-4",
        enabled: true,
        auto_response_enabled: true,
        confidence_threshold: 0.85,
        system_prompt: "",
        escalation_keywords: [],
      },
    };

    const { data, error } = await (supabase as any)
      .from("tenants")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Tenant creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tenant: data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tenants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenants
 * Update tenant settings / ai_config
 * Body: { id: string, ai_config?: {...}, settings?: {...}, ... }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ai_config, settings, name, display_name, name_en, specialty, country } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Build update payload
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (display_name !== undefined) updateData.display_name = display_name;
    if (name_en !== undefined) updateData.display_name = name_en;
    if (country !== undefined) updateData.country = country;
    if (specialty !== undefined) updateData.specialty = specialty;

    if (ai_config !== undefined) {
      // Map page's ai_config format to DB format
      updateData.ai_config = {
        model: ai_config.preferred_model || "gpt-4",
        preferred_model: ai_config.preferred_model || "gpt-4",
        enabled: ai_config.auto_response_enabled !== undefined ? ai_config.auto_response_enabled : true,
        auto_response_enabled: ai_config.auto_response_enabled !== undefined ? ai_config.auto_response_enabled : true,
        confidence_threshold: ai_config.confidence_threshold ?? 0.85,
        system_prompt: ai_config.system_prompt ?? "",
        escalation_keywords: ai_config.escalation_keywords ?? [],
      };
    }

    // Merge settings with existing settings (not overwrite)
    if (settings !== undefined) {
      // Fetch current settings first
      const { data: currentTenant } = await (supabase as any)
        .from("tenants")
        .select("settings")
        .eq("id", id)
        .single();

      const currentSettings = (currentTenant?.settings as Record<string, unknown>) || {};
      updateData.settings = { ...currentSettings, ...settings };
    }

    const { data, error } = await (supabase as any)
      .from("tenants")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Tenant update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tenant: data });
  } catch (error) {
    console.error("PATCH /api/tenants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenants?id=xxx
 * Delete a tenant
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { error } = await (supabase as any)
      .from("tenants")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Tenant delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tenants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
