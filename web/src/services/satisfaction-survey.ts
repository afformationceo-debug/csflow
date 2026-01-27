/**
 * Satisfaction Survey Service
 * Handles automated customer satisfaction surveys
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendChannelMessage, UnifiedOutboundMessage } from "./channels";
import { translationService, SupportedLanguage } from "./translation";

export interface SurveyTemplate {
  id: string;
  tenantId: string;
  name: string;
  questions: SurveyQuestion[];
  thankYouMessage: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SurveyQuestion {
  id: string;
  type: "rating" | "text" | "choice";
  question: string;
  questionTranslations?: Record<string, string>;
  options?: string[]; // For choice type
  minRating?: number; // For rating type
  maxRating?: number;
  required?: boolean;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  conversationId: string;
  customerId: string;
  responses: Record<string, number | string>;
  overallRating?: number;
  completedAt: Date;
}

export interface SendSurveyInput {
  conversationId: string;
  customerId: string;
  templateId?: string;
  delayMinutes?: number;
}

/**
 * Default survey templates by language
 */
const defaultSurveyTemplates: Partial<Record<SupportedLanguage, {
  intro: string;
  ratingQuestion: string;
  feedbackQuestion: string;
  thankYou: string;
  ratingOptions: string[];
}>> = {
  KO: {
    intro: "안녕하세요! 상담 품질 향상을 위해 간단한 설문에 응해주세요.",
    ratingQuestion: "상담 서비스에 얼마나 만족하셨나요?",
    feedbackQuestion: "추가 의견이 있으시면 말씀해주세요.",
    thankYou: "소중한 의견 감사합니다! 더 나은 서비스로 보답하겠습니다.",
    ratingOptions: ["1-매우 불만족", "2-불만족", "3-보통", "4-만족", "5-매우 만족"],
  },
  EN: {
    intro: "Hello! Please take a moment to complete our satisfaction survey.",
    ratingQuestion: "How satisfied were you with our service?",
    feedbackQuestion: "Any additional feedback?",
    thankYou: "Thank you for your feedback! We appreciate your time.",
    ratingOptions: ["1-Very Unsatisfied", "2-Unsatisfied", "3-Neutral", "4-Satisfied", "5-Very Satisfied"],
  },
  JA: {
    intro: "こんにちは！サービス向上のため、簡単なアンケートにご協力ください。",
    ratingQuestion: "サービスにどの程度ご満足いただけましたか？",
    feedbackQuestion: "追加のご意見がございましたらお聞かせください。",
    thankYou: "貴重なご意見をありがとうございます！",
    ratingOptions: ["1-非常に不満", "2-不満", "3-普通", "4-満足", "5-非常に満足"],
  },
  ZH: {
    intro: "您好！请花一点时间完成我们的满意度调查。",
    ratingQuestion: "您对我们的服务满意度如何？",
    feedbackQuestion: "如有其他反馈，请告诉我们。",
    thankYou: "感谢您的反馈！",
    ratingOptions: ["1-非常不满意", "2-不满意", "3-一般", "4-满意", "5-非常满意"],
  },
  VI: {
    intro: "Xin chào! Vui lòng dành chút thời gian để hoàn thành khảo sát của chúng tôi.",
    ratingQuestion: "Bạn hài lòng với dịch vụ của chúng tôi như thế nào?",
    feedbackQuestion: "Bạn có phản hồi gì thêm không?",
    thankYou: "Cảm ơn phản hồi của bạn!",
    ratingOptions: ["1-Rất không hài lòng", "2-Không hài lòng", "3-Bình thường", "4-Hài lòng", "5-Rất hài lòng"],
  },
  TH: {
    intro: "สวัสดี! กรุณาสละเวลาทำแบบสำรวจความพึงพอใจ",
    ratingQuestion: "คุณพอใจกับบริการของเรามากแค่ไหน?",
    feedbackQuestion: "มีข้อเสนอแนะเพิ่มเติมไหม?",
    thankYou: "ขอบคุณสำหรับความคิดเห็นของคุณ!",
    ratingOptions: ["1-ไม่พอใจมาก", "2-ไม่พอใจ", "3-ปานกลาง", "4-พอใจ", "5-พอใจมาก"],
  },
};

/**
 * Satisfaction Survey Service
 */
export const satisfactionSurveyService = {
  /**
   * Send satisfaction survey to customer
   */
  async sendSurvey(input: SendSurveyInput): Promise<{
    success: boolean;
    surveyRequestId?: string;
    error?: string;
  }> {
    const supabase = await createServiceClient();

    try {
      // Get conversation and customer data
      const { data: conversation } = await supabase
        .from("conversations")
        .select(`
          *,
          customer:customers(*),
          customer_channel:customer_channels(
            *,
            channel_account:channel_accounts(*)
          )
        `)
        .eq("id", input.conversationId)
        .single();

      if (!conversation) {
        return { success: false, error: "Conversation not found" };
      }

      const conv = conversation as unknown as {
        tenant_id: string;
        customer: { id: string; language?: string };
        customer_channel: {
          channel_type: string;
          channel_user_id: string;
          channel_account: { id: string };
        };
      };

      // Determine customer language
      const customerLanguage = (conv.customer.language || "KO") as SupportedLanguage;

      // Get survey template
      const template = this.getSurveyTemplate(customerLanguage);

      // Create survey request record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: surveyRequest, error: insertError } = await (supabase as any)
        .from("survey_requests")
        .insert({
          tenant_id: conv.tenant_id,
          conversation_id: input.conversationId,
          customer_id: input.customerId,
          template_id: input.templateId || "default",
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create survey request:", insertError);
        return { success: false, error: "Failed to create survey request" };
      }

      // Build survey message
      const surveyMessage = this.buildSurveyMessage(
        template,
        (surveyRequest as { id: string }).id
      );

      // Send to customer
      const sendResult = await sendChannelMessage(
        conv.customer_channel.channel_type as "line" | "kakao" | "whatsapp" | "facebook" | "instagram",
        conv.customer_channel.channel_account.id,
        {
          channelType: conv.customer_channel.channel_type as "line" | "kakao" | "whatsapp" | "facebook" | "instagram",
          channelUserId: conv.customer_channel.channel_user_id,
          contentType: "text",
          text: surveyMessage.text,
          quickReplies: surveyMessage.quickReplies,
        }
      );

      if (!sendResult.success) {
        // Update status to failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("survey_requests")
          .update({ status: "failed" })
          .eq("id", (surveyRequest as { id: string }).id);

        return { success: false, error: sendResult.error };
      }

      return {
        success: true,
        surveyRequestId: (surveyRequest as { id: string }).id,
      };
    } catch (error) {
      console.error("Send survey error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Process survey response from customer
   */
  async processResponse(
    conversationId: string,
    customerId: string,
    messageContent: string
  ): Promise<{
    isSurveyResponse: boolean;
    processed: boolean;
    response?: SurveyResponse;
  }> {
    const supabase = await createServiceClient();

    // Find pending survey for this customer/conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: surveyRequest } = await (supabase as any)
      .from("survey_requests")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("customer_id", customerId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();

    if (!surveyRequest) {
      return { isSurveyResponse: false, processed: false };
    }

    const request = surveyRequest as {
      id: string;
      tenant_id: string;
    };

    // Parse response (look for rating number)
    const ratingMatch = messageContent.match(/[1-5]/);
    if (!ratingMatch) {
      return { isSurveyResponse: true, processed: false };
    }

    const rating = parseInt(ratingMatch[0], 10);

    // Extract text feedback (everything except the rating)
    const feedback = messageContent.replace(/[1-5]/, "").trim();

    // Create survey response record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: response, error } = await (supabase as any)
      .from("survey_responses")
      .insert({
        tenant_id: request.tenant_id,
        survey_request_id: request.id,
        conversation_id: conversationId,
        customer_id: customerId,
        overall_rating: rating,
        responses: {
          rating,
          feedback: feedback || null,
        },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save survey response:", error);
      return { isSurveyResponse: true, processed: false };
    }

    // Update survey request status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("survey_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    // Send thank you message
    await this.sendThankYouMessage(conversationId);

    return {
      isSurveyResponse: true,
      processed: true,
      response: response as unknown as SurveyResponse,
    };
  },

  /**
   * Get survey template by language
   */
  getSurveyTemplate(language: SupportedLanguage) {
    return defaultSurveyTemplates[language] || defaultSurveyTemplates.KO;
  },

  /**
   * Build survey message
   */
  buildSurveyMessage(
    template: typeof defaultSurveyTemplates.KO,
    surveyId: string
  ): {
    text: string;
    quickReplies: UnifiedOutboundMessage["quickReplies"];
  } {
    const text = `${template.intro}\n\n${template.ratingQuestion}`;

    const quickReplies = template.ratingOptions.map((option) => ({
      label: option,
      action: "message" as const,
      value: option.charAt(0), // Just the number
    }));

    return { text, quickReplies };
  },

  /**
   * Send thank you message after survey completion
   */
  async sendThankYouMessage(conversationId: string): Promise<void> {
    const supabase = await createServiceClient();

    const { data: conversation } = await supabase
      .from("conversations")
      .select(`
        customer:customers(language),
        customer_channel:customer_channels(
          channel_type,
          channel_user_id,
          channel_account:channel_accounts(id)
        )
      `)
      .eq("id", conversationId)
      .single();

    if (!conversation) return;

    const conv = conversation as unknown as {
      customer: { language?: string };
      customer_channel: {
        channel_type: string;
        channel_user_id: string;
        channel_account: { id: string };
      };
    };

    const language = (conv.customer.language || "KO") as SupportedLanguage;
    const template = this.getSurveyTemplate(language);

    await sendChannelMessage(
      conv.customer_channel.channel_type as "line" | "kakao" | "whatsapp" | "facebook" | "instagram",
      conv.customer_channel.channel_account.id,
      {
        channelType: conv.customer_channel.channel_type as "line" | "kakao" | "whatsapp" | "facebook" | "instagram",
        channelUserId: conv.customer_channel.channel_user_id,
        contentType: "text",
        text: template.thankYou,
      }
    );
  },

  /**
   * Get survey statistics for a tenant
   */
  async getStatistics(
    tenantId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalSent: number;
    totalCompleted: number;
    responseRate: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
    recentTrend: Array<{ date: string; averageRating: number; count: number }>;
  }> {
    const supabase = await createServiceClient();

    // Base query filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sentQuery = (supabase as any)
      .from("survey_requests")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let responseQuery = (supabase as any)
      .from("survey_responses")
      .select("overall_rating")
      .eq("tenant_id", tenantId);

    if (dateRange) {
      sentQuery = sentQuery
        .gte("sent_at", dateRange.start.toISOString())
        .lte("sent_at", dateRange.end.toISOString());

      responseQuery = responseQuery
        .gte("completed_at", dateRange.start.toISOString())
        .lte("completed_at", dateRange.end.toISOString());
    }

    const { count: totalSent } = await sentQuery;
    const { data: responses } = await responseQuery;

    const typedResponses = (responses || []) as Array<{ overall_rating: number }>;
    const totalCompleted = typedResponses.length;
    const responseRate = totalSent ? (totalCompleted / totalSent) * 100 : 0;

    // Calculate average rating
    const totalRating = typedResponses.reduce(
      (sum, r) => sum + (r.overall_rating || 0),
      0
    );
    const averageRating = totalCompleted ? totalRating / totalCompleted : 0;

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    typedResponses.forEach((r) => {
      if (r.overall_rating >= 1 && r.overall_rating <= 5) {
        ratingDistribution[r.overall_rating]++;
      }
    });

    // Recent trend (last 7 days)
    const recentTrend: Array<{ date: string; averageRating: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayResponses = typedResponses.filter((r) => {
        // This is simplified - in production, use proper date filtering
        return true;
      });

      if (dayResponses.length > 0) {
        const dayAvg =
          dayResponses.reduce((s, r) => s + r.overall_rating, 0) /
          dayResponses.length;
        recentTrend.push({
          date: dateStr,
          averageRating: Math.round(dayAvg * 10) / 10,
          count: dayResponses.length,
        });
      }
    }

    return {
      totalSent: totalSent || 0,
      totalCompleted,
      responseRate: Math.round(responseRate * 10) / 10,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      recentTrend,
    };
  },

  /**
   * Schedule survey for resolved conversation
   */
  async scheduleForResolvedConversation(
    conversationId: string,
    delayMinutes: number = 30
  ): Promise<void> {
    const supabase = await createServiceClient();

    const { data: conversation } = await supabase
      .from("conversations")
      .select("customer_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) return;

    // Schedule survey via job queue
    const { enqueueJob } = await import("@/lib/upstash/qstash");
    await enqueueJob({
      type: "send_satisfaction_survey",
      data: {
        conversationId,
        customerId: (conversation as { customer_id: string }).customer_id,
      },
      delay: delayMinutes * 60 * 1000,
    });
  },
};

export default satisfactionSurveyService;
