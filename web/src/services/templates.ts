import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { ChannelType, Json } from "@/lib/supabase/types";

/**
 * Message Template Types
 */
export type TemplateCategory =
  | "greeting"       // 인사말
  | "faq"           // 자주 묻는 질문 답변
  | "booking"       // 예약 관련
  | "reminder"      // 리마인드
  | "followup"      // 후속 안내
  | "promotion"     // 프로모션
  | "notification"  // 알림
  | "closing";      // 마무리

export type TemplateStatus = "draft" | "active" | "archived";

export interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: TemplateCategory;
  description?: string;

  // Content
  content: string;                    // Main content (Korean)
  contentTranslations?: {             // Pre-translated versions
    [lang: string]: string;
  };

  // Variables support: {{customerName}}, {{bookingDate}}, etc.
  variables: string[];

  // Channel-specific settings
  channelConfigs?: {
    [channel in ChannelType]?: {
      enabled: boolean;
      templateId?: string;            // For WhatsApp/KakaoTalk approved templates
      quickReplies?: { label: string; value: string }[];
      buttons?: { label: string; action: string; url?: string }[];
    };
  };

  // Metadata
  status: TemplateStatus;
  usageCount: number;
  lastUsedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  tenantId: string;
  name: string;
  category: TemplateCategory;
  description?: string;
  content: string;
  contentTranslations?: { [lang: string]: string };
  variables?: string[];
  channelConfigs?: MessageTemplate["channelConfigs"];
  status?: TemplateStatus;
  createdBy?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  category?: TemplateCategory;
  description?: string;
  content?: string;
  contentTranslations?: { [lang: string]: string };
  variables?: string[];
  channelConfigs?: MessageTemplate["channelConfigs"];
  status?: TemplateStatus;
}

export interface TemplateFilters {
  tenantId?: string;
  category?: TemplateCategory;
  status?: TemplateStatus;
  channelType?: ChannelType;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Extract variables from template content
 * Variables are in format: {{variableName}}
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = content.match(regex) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))];
}

/**
 * Apply variables to template content
 */
export function applyVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// Client-side service
export const templateService = {
  async getTemplates(filters: TemplateFilters = {}): Promise<MessageTemplate[]> {
    const supabase = createClient();

    let query = (supabase
      .from("message_templates") as any)
      .select("*")
      .order("updated_at", { ascending: false });

    if (filters.tenantId) {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
      );
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

    return (data || []).map(mapDbToTemplate);
  },

  async getTemplate(id: string): Promise<MessageTemplate | null> {
    const supabase = createClient();

    const { data, error } = await (supabase
      .from("message_templates") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return mapDbToTemplate(data);
  },

  async createTemplate(input: CreateTemplateInput): Promise<MessageTemplate> {
    const supabase = createClient();

    const variables = input.variables || extractVariables(input.content);

    const { data, error } = await (supabase
      .from("message_templates") as any)
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        category: input.category,
        description: input.description,
        content: input.content,
        content_translations: input.contentTranslations || {},
        variables,
        channel_configs: input.channelConfigs || {},
        status: input.status || "draft",
        usage_count: 0,
        created_by: input.createdBy,
      })
      .select()
      .single();

    if (error) throw error;

    return mapDbToTemplate(data);
  },

  async updateTemplate(
    id: string,
    updates: UpdateTemplateInput
  ): Promise<MessageTemplate> {
    const supabase = createClient();

    const updateData: Record<string, unknown> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.content !== undefined) {
      updateData.content = updates.content;
      updateData.variables = updates.variables || extractVariables(updates.content);
    }
    if (updates.contentTranslations !== undefined) {
      updateData.content_translations = updates.contentTranslations;
    }
    if (updates.variables !== undefined) updateData.variables = updates.variables;
    if (updates.channelConfigs !== undefined) {
      updateData.channel_configs = updates.channelConfigs;
    }
    if (updates.status !== undefined) updateData.status = updates.status;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await (supabase
      .from("message_templates") as any)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return mapDbToTemplate(data);
  },

  async deleteTemplate(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await (supabase
      .from("message_templates") as any)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async duplicateTemplate(id: string, newName?: string): Promise<MessageTemplate> {
    const template = await this.getTemplate(id);
    if (!template) throw new Error("Template not found");

    return this.createTemplate({
      tenantId: template.tenantId,
      name: newName || `${template.name} (복사본)`,
      category: template.category,
      description: template.description,
      content: template.content,
      contentTranslations: template.contentTranslations,
      variables: template.variables,
      channelConfigs: template.channelConfigs,
      status: "draft",
    });
  },

  async incrementUsage(id: string): Promise<void> {
    const supabase = createClient();

    // Use RPC for atomic increment
    await (supabase.rpc as any)("increment_template_usage", { template_id: id });
  },
};

// Server-side service
export const serverTemplateService = {
  async getTemplates(filters: TemplateFilters = {}): Promise<MessageTemplate[]> {
    const supabase = await createServiceClient();

    let query = (supabase
      .from("message_templates") as any)
      .select("*")
      .order("updated_at", { ascending: false });

    if (filters.tenantId) {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.channelType) {
      // Filter templates that are enabled for specific channel
      query = query.not(
        "channel_configs",
        "cs",
        `{"${filters.channelType}": null}`
      );
    }

    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
      );
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(mapDbToTemplate);
  },

  async getTemplate(id: string): Promise<MessageTemplate | null> {
    const supabase = await createServiceClient();

    const { data, error } = await (supabase
      .from("message_templates") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return mapDbToTemplate(data);
  },

  async getTemplateForChannel(
    tenantId: string,
    category: TemplateCategory,
    channelType: ChannelType,
    language?: string
  ): Promise<{ content: string; config: Record<string, unknown> } | null> {
    const supabase = await createServiceClient();

    const { data, error } = await (supabase
      .from("message_templates") as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("category", category)
      .eq("status", "active")
      .single();

    if (error || !data) return null;

    const template = mapDbToTemplate(data);
    const channelConfig = template.channelConfigs?.[channelType];

    // If channel is not enabled, return null
    if (channelConfig && !channelConfig.enabled) {
      return null;
    }

    // Get translated content if available
    let content = template.content;
    if (language && template.contentTranslations?.[language]) {
      content = template.contentTranslations[language];
    }

    return {
      content,
      config: channelConfig || {},
    };
  },

  async recordUsage(id: string): Promise<void> {
    const supabase = await createServiceClient();

    const { error } = await (supabase
      .from("message_templates") as any)
      .update({
        usage_count: (supabase as any).sql`usage_count + 1`,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to record template usage:", error);
    }
  },

  async createDefaultTemplates(tenantId: string): Promise<void> {
    const supabase = await createServiceClient();

    const defaultTemplates: CreateTemplateInput[] = [
      {
        tenantId,
        name: "기본 인사말",
        category: "greeting",
        description: "첫 문의 시 자동 발송되는 인사말",
        content: "안녕하세요, {{hospitalName}}입니다. 무엇을 도와드릴까요?",
        contentTranslations: {
          JA: "こんにちは、{{hospitalName}}です。ご質問はございますか？",
          EN: "Hello, this is {{hospitalName}}. How can we help you?",
          ZH: "您好，这里是{{hospitalName}}。有什么可以帮助您的吗？",
        },
        status: "active",
      },
      {
        tenantId,
        name: "예약 확정 안내",
        category: "booking",
        description: "예약 확정 시 발송되는 안내 메시지",
        content: `{{customerName}}님의 예약이 확정되었습니다.

📅 예약일시: {{bookingDate}} {{bookingTime}}
🏥 시술명: {{serviceName}}
📍 병원명: {{hospitalName}}

변경이나 취소가 필요하시면 언제든 말씀해주세요.`,
        contentTranslations: {
          JA: `{{customerName}}様のご予約が確定いたしました。

📅 予約日時: {{bookingDate}} {{bookingTime}}
🏥 施術名: {{serviceName}}
📍 病院名: {{hospitalName}}

変更やキャンセルが必要な場合は、お気軽にお知らせください。`,
          EN: `Dear {{customerName}}, your appointment has been confirmed.

📅 Date & Time: {{bookingDate}} {{bookingTime}}
🏥 Treatment: {{serviceName}}
📍 Hospital: {{hospitalName}}

Please let us know if you need to make any changes.`,
        },
        status: "active",
      },
      {
        tenantId,
        name: "방문 전일 리마인드",
        category: "reminder",
        description: "방문 1일 전 자동 발송되는 리마인드",
        content: `{{customerName}}님, 내일 {{hospitalName}} 방문 예정을 알려드립니다.

📅 예약일시: {{bookingDate}} {{bookingTime}}
📍 주소: {{hospitalAddress}}

궁금한 점이 있으시면 언제든 문의해주세요.`,
        status: "active",
      },
      {
        tenantId,
        name: "상담 종료 인사",
        category: "closing",
        description: "상담 종료 시 발송되는 마무리 메시지",
        content: `문의해주셔서 감사합니다. 추가 문의사항이 있으시면 언제든 연락주세요.

{{hospitalName}} 드림`,
        contentTranslations: {
          JA: `お問い合わせありがとうございます。追加のご質問があれば、いつでもご連絡ください。

{{hospitalName}}より`,
          EN: `Thank you for your inquiry. Please feel free to contact us if you have any further questions.

Best regards,
{{hospitalName}}`,
        },
        status: "active",
      },
    ];

    for (const template of defaultTemplates) {
      try {
        const variables = extractVariables(template.content);
        await (supabase.from("message_templates") as any).insert({
          tenant_id: template.tenantId,
          name: template.name,
          category: template.category,
          description: template.description,
          content: template.content,
          content_translations: template.contentTranslations || {},
          variables,
          channel_configs: {},
          status: template.status,
          usage_count: 0,
        });
      } catch (e) {
        console.error(`Failed to create default template: ${template.name}`, e);
      }
    }
  },
};

// Helper function to map database row to MessageTemplate
function mapDbToTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    category: row.category as TemplateCategory,
    description: row.description as string | undefined,
    content: row.content as string,
    contentTranslations: row.content_translations as { [lang: string]: string } | undefined,
    variables: row.variables as string[],
    channelConfigs: row.channel_configs as MessageTemplate["channelConfigs"],
    status: row.status as TemplateStatus,
    usageCount: row.usage_count as number,
    lastUsedAt: row.last_used_at as string | undefined,
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
