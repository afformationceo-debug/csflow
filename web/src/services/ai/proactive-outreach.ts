/**
 * Proactive Outreach Service
 * AI-driven customer engagement and follow-up automation
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";
import { conversionPredictionService, ConversionStage } from "./conversion-prediction";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface OutreachCandidate {
  customerId: string;
  name?: string;
  language: string;
  channelType: string;
  channelUserId: string;
  reason: OutreachReason;
  priority: "high" | "medium" | "low";
  suggestedMessage: string;
  suggestedTemplate?: string;
  conversionProbability: number;
  lastContactAt: string;
  daysSinceLastContact: number;
}

export type OutreachReason =
  | "high_conversion_probability"
  | "stale_conversation"
  | "abandoned_inquiry"
  | "post_consultation_followup"
  | "booking_reminder"
  | "birthday_greeting"
  | "seasonal_promotion"
  | "win_back"
  | "feedback_request";

export interface OutreachCampaign {
  id: string;
  name: string;
  tenantId: string;
  type: OutreachReason;
  status: "draft" | "scheduled" | "running" | "completed" | "paused";
  targetCriteria: TargetCriteria;
  messageTemplate: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  stats: CampaignStats;
}

export interface TargetCriteria {
  conversionStages?: ConversionStage[];
  minConversionProbability?: number;
  maxConversionProbability?: number;
  minDaysSinceContact?: number;
  maxDaysSinceContact?: number;
  languages?: string[];
  channels?: string[];
  tags?: string[];
  excludeTags?: string[];
}

export interface CampaignStats {
  totalTargeted: number;
  sent: number;
  delivered: number;
  opened: number;
  responded: number;
  converted: number;
}

/**
 * Identify customers for proactive outreach
 */
export async function identifyOutreachCandidates(
  tenantId: string,
  options: {
    limit?: number;
    reasons?: OutreachReason[];
    excludeRecentlyContacted?: boolean;
    minDaysSinceContact?: number;
  } = {}
): Promise<OutreachCandidate[]> {
  const supabase = await createServiceClient();
  const {
    limit = 50,
    reasons = ["high_conversion_probability", "stale_conversation", "abandoned_inquiry"],
    excludeRecentlyContacted = true,
    minDaysSinceContact = 3,
  } = options;

  const candidates: OutreachCandidate[] = [];

  // Get customers with their conversation data
  const { data: customersData } = await supabase
    .from("customers")
    .select(`
      id,
      name,
      language,
      metadata,
      updated_at,
      customer_channels (
        channel_user_id,
        channel_account:channel_accounts (
          channel_type
        )
      ),
      conversations (
        id,
        status,
        last_message_at,
        messages (
          direction,
          created_at
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .limit(200);

  if (!customersData) return [];

  // Type cast for complex nested query
  interface CustomerWithRelations {
    id: string;
    name: string;
    language: string;
    metadata: Record<string, unknown> | null;
    updated_at: string;
    customer_channels: Array<{
      channel_user_id: string;
      channel_account: { channel_type: string } | null;
    }> | null;
    conversations: Array<{
      id: string;
      status: string;
      last_message_at: string;
      messages: Array<{ direction: string; created_at: string }>;
    }> | null;
  }
  const customers = customersData as unknown as CustomerWithRelations[];

  for (const customer of customers) {
    const lastConversation = customer.conversations?.[0];
    const lastMessageAt = lastConversation?.last_message_at;
    const daysSinceLastContact = lastMessageAt
      ? Math.floor(
          (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    // Skip recently contacted if option enabled
    if (excludeRecentlyContacted && daysSinceLastContact < minDaysSinceContact) {
      continue;
    }

    const prediction = (customer.metadata as Record<string, { probability?: number; stage?: ConversionStage }>)?.conversion_prediction;
    const channelInfo = customer.customer_channels?.[0];

    if (!channelInfo) continue;

    // Determine outreach reason
    let reason: OutreachReason | null = null;
    let priority: "high" | "medium" | "low" = "medium";

    if (
      reasons.includes("high_conversion_probability") &&
      prediction?.probability &&
      prediction.probability > 0.6
    ) {
      reason = "high_conversion_probability";
      priority = "high";
    } else if (
      reasons.includes("stale_conversation") &&
      daysSinceLastContact >= 7 &&
      daysSinceLastContact <= 30
    ) {
      reason = "stale_conversation";
      priority = daysSinceLastContact < 14 ? "high" : "medium";
    } else if (
      reasons.includes("abandoned_inquiry") &&
      daysSinceLastContact >= 3 &&
      daysSinceLastContact <= 7 &&
      lastConversation?.status === "open"
    ) {
      reason = "abandoned_inquiry";
      priority = "high";
    } else if (
      reasons.includes("win_back") &&
      daysSinceLastContact > 30 &&
      prediction?.stage !== "booked"
    ) {
      reason = "win_back";
      priority = "low";
    }

    if (!reason) continue;

    // Generate suggested message
    const suggestedMessage = await generateOutreachMessage(
      customer.name || "고객님",
      customer.language || "ko",
      reason,
      tenantId
    );

    candidates.push({
      customerId: customer.id,
      name: customer.name || undefined,
      language: customer.language || "ko",
      channelType: (channelInfo.channel_account as { channel_type?: string })?.channel_type || "unknown",
      channelUserId: channelInfo.channel_user_id,
      reason,
      priority,
      suggestedMessage,
      conversionProbability: prediction?.probability || 0,
      lastContactAt: lastMessageAt || customer.updated_at,
      daysSinceLastContact,
    });

    if (candidates.length >= limit) break;
  }

  // Sort by priority and conversion probability
  return candidates.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.conversionProbability - a.conversionProbability;
  });
}

/**
 * Generate personalized outreach message using AI
 */
export async function generateOutreachMessage(
  customerName: string,
  language: string,
  reason: OutreachReason,
  tenantId: string,
  additionalContext?: string
): Promise<string> {
  const supabase = await createServiceClient();

  // Get tenant info for context
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name, specialty, settings")
    .eq("id", tenantId)
    .single();

  // Type cast for tenant data
  const tenant = tenantData as { name?: string; specialty?: string; settings?: Record<string, unknown> } | null;
  const hospitalName = tenant?.name || "병원";
  const specialty = tenant?.specialty || "의료";

  const reasonPrompts: Record<OutreachReason, string> = {
    high_conversion_probability: `이 고객은 예약할 가능성이 높습니다. 부드럽게 예약을 권유하는 메시지를 작성해주세요.`,
    stale_conversation: `이 고객과의 대화가 중단되었습니다. 자연스럽게 대화를 재개하는 메시지를 작성해주세요.`,
    abandoned_inquiry: `이 고객이 문의 후 응답이 없습니다. 추가 질문이 있는지 확인하는 메시지를 작성해주세요.`,
    post_consultation_followup: `상담 후 후속 연락입니다. 추가 궁금한 점이나 예약 의향을 확인하는 메시지를 작성해주세요.`,
    booking_reminder: `예약 관련 리마인더 메시지를 작성해주세요.`,
    birthday_greeting: `생일 축하 메시지와 함께 특별 혜택을 안내해주세요.`,
    seasonal_promotion: `계절 프로모션을 안내하는 메시지를 작성해주세요.`,
    win_back: `오랫동안 연락이 없던 고객에게 다시 연락하는 메시지를 작성해주세요. 새로운 서비스나 프로모션을 언급해주세요.`,
    feedback_request: `서비스 이용 후 피드백을 요청하는 메시지를 작성해주세요.`,
  };

  const langName = language === "ko" ? "한국어" : language === "ja" ? "일본어" : language === "zh" ? "중국어" : language === "en" ? "영어" : language === "vi" ? "베트남어" : "한국어";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 ${hospitalName}(${specialty} 전문)의 CS 담당자입니다.
친근하고 전문적인 톤으로 ${langName}로 메시지를 작성해주세요.
메시지는 짧고 핵심적이어야 합니다 (2-3문장).
강압적이지 않고 자연스러운 톤을 유지하세요.`,
        },
        {
          role: "user",
          content: `고객명: ${customerName}
${reasonPrompts[reason]}
${additionalContext ? `추가 컨텍스트: ${additionalContext}` : ""}

메시지만 작성해주세요 (인사말 포함):`,
        },
      ],
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content || getDefaultMessage(reason, customerName, language);
  } catch (error) {
    console.error("Failed to generate outreach message:", error);
    return getDefaultMessage(reason, customerName, language);
  }
}

/**
 * Get default message template
 */
function getDefaultMessage(
  reason: OutreachReason,
  customerName: string,
  language: string
): string {
  const templates: Record<OutreachReason, Record<string, string>> = {
    high_conversion_probability: {
      ko: `${customerName}님, 안녕하세요! 상담 관련 추가 궁금하신 점이 있으시면 언제든 문의해 주세요. 예약도 가능합니다 😊`,
      en: `Hi ${customerName}! If you have any questions about your consultation, please don't hesitate to ask. We're ready to help with booking too 😊`,
      ja: `${customerName}様、こんにちは！ご相談について何かご質問がございましたら、お気軽にお問い合わせください。ご予約も承っております😊`,
    },
    stale_conversation: {
      ko: `${customerName}님, 안녕하세요! 지난번 문의 관련하여 추가 도움이 필요하시면 말씀해 주세요.`,
      en: `Hi ${customerName}! Just checking in - let us know if you need any more help with your previous inquiry.`,
      ja: `${customerName}様、こんにちは！前回のお問い合わせについて、追加のサポートが必要でしたらお知らせください。`,
    },
    abandoned_inquiry: {
      ko: `${customerName}님, 안녕하세요! 혹시 추가 질문이 있으시거나 도움이 필요하시면 편하게 연락 주세요.`,
      en: `Hi ${customerName}! Feel free to reach out if you have any more questions or need assistance.`,
      ja: `${customerName}様、こんにちは！追加のご質問やサポートが必要でしたら、お気軽にご連絡ください。`,
    },
    post_consultation_followup: {
      ko: `${customerName}님, 상담은 도움이 되셨나요? 추가 궁금한 점이 있으시면 언제든 문의해 주세요.`,
      en: `Hi ${customerName}! Was the consultation helpful? Please let us know if you have any other questions.`,
      ja: `${customerName}様、ご相談はお役に立ちましたでしょうか？追加のご質問がございましたら、いつでもお問い合わせください。`,
    },
    booking_reminder: {
      ko: `${customerName}님, 예약 관련 리마인드 드립니다. 확인 부탁드립니다.`,
      en: `Hi ${customerName}! This is a reminder about your booking. Please confirm.`,
      ja: `${customerName}様、ご予約のリマインダーです。ご確認をお願いいたします。`,
    },
    birthday_greeting: {
      ko: `${customerName}님, 생일 축하드립니다! 🎂 특별한 생일 혜택을 준비했습니다.`,
      en: `Happy Birthday ${customerName}! 🎂 We have a special gift for you.`,
      ja: `${customerName}様、お誕生日おめでとうございます！🎂 特別なプレゼントをご用意しました。`,
    },
    seasonal_promotion: {
      ko: `${customerName}님, 안녕하세요! 특별 프로모션을 안내드립니다.`,
      en: `Hi ${customerName}! We have a special promotion for you.`,
      ja: `${customerName}様、こんにちは！特別プロモーションのご案内です。`,
    },
    win_back: {
      ko: `${customerName}님, 안녕하세요! 오랜만에 인사드립니다. 새로운 서비스가 추가되었습니다.`,
      en: `Hi ${customerName}! It's been a while. We have new services to share with you.`,
      ja: `${customerName}様、こんにちは！お久しぶりです。新しいサービスが追加されました。`,
    },
    feedback_request: {
      ko: `${customerName}님, 서비스는 만족스러우셨나요? 소중한 의견을 들려주세요.`,
      en: `Hi ${customerName}! We'd love to hear your feedback about our service.`,
      ja: `${customerName}様、サービスはご満足いただけましたでしょうか？ご意見をお聞かせください。`,
    },
  };

  return templates[reason]?.[language] || templates[reason]?.ko || "";
}

/**
 * Create outreach campaign
 */
export async function createCampaign(
  tenantId: string,
  campaign: Omit<OutreachCampaign, "id" | "stats">
): Promise<OutreachCampaign> {
  const supabase = await createServiceClient();

  const newCampaign: OutreachCampaign = {
    ...campaign,
    id: crypto.randomUUID(),
    stats: {
      totalTargeted: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      converted: 0,
    },
  };

  // In production, this would be stored in a campaigns table
  // For now, we store in tenant metadata
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();

  // Type cast for tenant settings
  const tenantSettings = tenantData as { settings?: Record<string, unknown> } | null;
  const campaigns = (tenantSettings?.settings as Record<string, OutreachCampaign[]> | undefined)?.outreach_campaigns || [];
  campaigns.push(newCampaign);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("tenants")
    .update({
      settings: {
        ...(tenantSettings?.settings || {}),
        outreach_campaigns: campaigns,
      },
    })
    .eq("id", tenantId);

  return newCampaign;
}

/**
 * Execute outreach campaign
 */
export async function executeCampaign(
  tenantId: string,
  campaignId: string
): Promise<CampaignStats> {
  const supabase = await createServiceClient();

  // Get campaign
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();

  // Type cast for tenant settings
  const tenantSettings = tenantData as { settings?: Record<string, unknown> } | null;
  const campaigns = (tenantSettings?.settings as Record<string, OutreachCampaign[]> | undefined)?.outreach_campaigns || [];
  const campaign = campaigns.find((c) => c.id === campaignId);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Get target customers based on criteria
  const candidates = await identifyOutreachCandidates(tenantId, {
    limit: 100,
    reasons: [campaign.type],
    minDaysSinceContact: campaign.targetCriteria.minDaysSinceContact,
  });

  // Filter by additional criteria
  const filteredCandidates = candidates.filter((c) => {
    if (
      campaign.targetCriteria.minConversionProbability &&
      c.conversionProbability < campaign.targetCriteria.minConversionProbability
    ) {
      return false;
    }
    if (
      campaign.targetCriteria.maxConversionProbability &&
      c.conversionProbability > campaign.targetCriteria.maxConversionProbability
    ) {
      return false;
    }
    if (
      campaign.targetCriteria.languages &&
      !campaign.targetCriteria.languages.includes(c.language)
    ) {
      return false;
    }
    if (
      campaign.targetCriteria.channels &&
      !campaign.targetCriteria.channels.includes(c.channelType)
    ) {
      return false;
    }
    return true;
  });

  // Update campaign stats
  campaign.stats.totalTargeted = filteredCandidates.length;
  campaign.status = "running";
  campaign.startedAt = new Date().toISOString();

  // In production, this would queue messages for sending
  // For now, we just update the stats
  campaign.stats.sent = filteredCandidates.length;
  campaign.status = "completed";
  campaign.completedAt = new Date().toISOString();

  // Update campaign in storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("tenants")
    .update({
      settings: {
        ...(tenantSettings?.settings || {}),
        outreach_campaigns: campaigns,
      },
    })
    .eq("id", tenantId);

  return campaign.stats;
}

/**
 * Get outreach analytics
 */
export async function getOutreachAnalytics(
  tenantId: string,
  dateRange: { start: Date; end: Date }
): Promise<{
  totalOutreach: number;
  responseRate: number;
  conversionRate: number;
  topPerformingReasons: Array<{ reason: OutreachReason; responseRate: number }>;
  campaignPerformance: Array<{ name: string; stats: CampaignStats }>;
}> {
  const supabase = await createServiceClient();

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();

  // Type cast for tenant settings
  const tenantSettings = tenantData as { settings?: Record<string, unknown> } | null;
  const campaigns = (tenantSettings?.settings as Record<string, OutreachCampaign[]> | undefined)?.outreach_campaigns || [];

  // Filter campaigns by date range
  const filteredCampaigns = campaigns.filter((c) => {
    if (!c.startedAt) return false;
    const startDate = new Date(c.startedAt);
    return startDate >= dateRange.start && startDate <= dateRange.end;
  });

  // Calculate aggregate stats
  const totalOutreach = filteredCampaigns.reduce((sum, c) => sum + c.stats.sent, 0);
  const totalResponded = filteredCampaigns.reduce((sum, c) => sum + c.stats.responded, 0);
  const totalConverted = filteredCampaigns.reduce((sum, c) => sum + c.stats.converted, 0);

  // Group by reason
  const reasonStats: Record<OutreachReason, { sent: number; responded: number }> = {} as Record<
    OutreachReason,
    { sent: number; responded: number }
  >;

  filteredCampaigns.forEach((c) => {
    if (!reasonStats[c.type]) {
      reasonStats[c.type] = { sent: 0, responded: 0 };
    }
    reasonStats[c.type].sent += c.stats.sent;
    reasonStats[c.type].responded += c.stats.responded;
  });

  const topPerformingReasons = Object.entries(reasonStats)
    .map(([reason, stats]) => ({
      reason: reason as OutreachReason,
      responseRate: stats.sent > 0 ? stats.responded / stats.sent : 0,
    }))
    .sort((a, b) => b.responseRate - a.responseRate);

  return {
    totalOutreach,
    responseRate: totalOutreach > 0 ? totalResponded / totalOutreach : 0,
    conversionRate: totalOutreach > 0 ? totalConverted / totalOutreach : 0,
    topPerformingReasons,
    campaignPerformance: filteredCampaigns.map((c) => ({
      name: c.name,
      stats: c.stats,
    })),
  };
}

export const proactiveOutreachService = {
  identifyOutreachCandidates,
  generateOutreachMessage,
  createCampaign,
  executeCampaign,
  getOutreachAnalytics,
};
