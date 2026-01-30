/**
 * RAG Pipeline + Booking Integration
 *
 * RAG 응답에 예약 유도 로직을 통합
 * 풀자동화 모드 채널에서만 동작
 */

import { ragPipeline, RAGInput, RAGOutput } from "@/services/ai/rag-pipeline";
import {
  detectBookingIntent,
  logBookingIntent,
  generateBookingForm,
  parseBookingFormResponse,
  BookingIntent,
} from "./intent-detection";
import {
  createBookingRequest,
  isFullAutomationEnabled,
  getAutomationConfig,
} from "./booking-request";
import { createServiceClient } from "@/lib/supabase/server";

export interface EnhancedRAGInput extends RAGInput {
  channelAccountId: string; // 풀자동화 모드 확인용
  customerId: string; // 예약 생성용
  messageId?: string; // 로그용
}

export interface EnhancedRAGOutput extends RAGOutput {
  bookingIntent?: BookingIntent;
  bookingFormSent?: boolean;
  bookingRequestId?: string;
  bookingGuidance?: string; // 예약 유도 멘트
}

/**
 * RAG 응답에 예약 유도 멘트 추가
 */
function addBookingGuidance(
  baseResponse: string,
  intensity: "low" | "medium" | "high",
  language: string
): string {
  const guidanceTemplates = {
    ko: {
      low: "\n\n💡 상담 예약도 가능합니다.",
      medium:
        "\n\n📅 상담 예약을 원하시면 말씀해주세요. 희망하시는 날짜를 알려주시면 도와드리겠습니다.",
      high: "\n\n✨ 지금 바로 상담 예약을 도와드릴까요? 희망 날짜와 시술 종류를 말씀해주시면 빠르게 안내해드립니다!",
    },
    ja: {
      low: "\n\n💡 カウンセリングの予約も可能です。",
      medium:
        "\n\n📅 カウンセリングの予約をご希望の場合はお知らせください。ご希望の日付をお教えいただければお手伝いいたします。",
      high: "\n\n✨ 今すぐカウンセリングの予約をお手伝いしましょうか？ご希望の日付と施術の種類をお知らせください！",
    },
    en: {
      low: "\n\n💡 Consultation booking is available.",
      medium:
        "\n\n📅 Please let me know if you'd like to book a consultation. I'll help you with your preferred date.",
      high: "\n\n✨ Would you like to book a consultation right now? Just tell me your preferred date and treatment type!",
    },
    zh: {
      low: "\n\n💡 也可以预约咨询。",
      medium: "\n\n📅 如果您想预约咨询，请告诉我。我会帮您安排您希望的日期。",
      high: "\n\n✨ 现在就帮您预约咨询吗？请告诉我您希望的日期和治疗类型！",
    },
  };

  const templates = guidanceTemplates[language as keyof typeof guidanceTemplates] || guidanceTemplates.en;
  const guidance = templates[intensity];

  return baseResponse + guidance;
}

/**
 * 예약 양식 응답인지 확인 (날짜/시간/시술 포함 여부)
 */
function isBookingFormResponse(message: string): boolean {
  const hasDatePattern = /날짜[:：]\s*.+|date[:：]\s*.+/i.test(message);
  const hasTimePattern = /시간[:：]\s*.+|time[:：]\s*.+/i.test(message);
  const hasTreatmentPattern = /시술[:：]\s*.+|treatment[:：]\s*.+/i.test(message);

  return hasDatePattern && (hasTimePattern || hasTreatmentPattern);
}

/**
 * Enhanced RAG Pipeline with Booking Intelligence
 */
export const enhancedRAGPipeline = {
  /**
   * Process query with booking intent detection
   */
  async process(input: EnhancedRAGInput): Promise<EnhancedRAGOutput> {
    // 1. Check if full automation is enabled for this channel
    const fullAutomationEnabled = await isFullAutomationEnabled(input.channelAccountId);

    if (!fullAutomationEnabled) {
      // 풀자동화 비활성: 기존 RAG만 실행
      const ragOutput = await ragPipeline.process(input);
      return { ...ragOutput };
    }

    // 2. Get automation config
    const automationConfig = await getAutomationConfig(input.channelAccountId);
    const bookingPromptIntensity = automationConfig?.bookingPromptIntensity || "medium";

    // 3. Check if message is booking form response
    if (isBookingFormResponse(input.query)) {
      return await this.handleBookingFormSubmission(input);
    }

    // 4. Detect booking intent in parallel with RAG
    const [ragOutput, bookingIntent] = await Promise.all([
      ragPipeline.process(input),
      detectBookingIntent(
        input.query,
        input.conversationHistory || [],
        input.customerLanguage || "ko"
      ),
    ]);

    // 5. Log intent detection
    if (input.messageId) {
      await logBookingIntent(input.conversationId, input.messageId, bookingIntent);
    }

    // 6. Handle high-confidence booking intent
    if (bookingIntent.detected && bookingIntent.confidence >= 0.7) {
      if (bookingIntent.recommendedAction === "send_form") {
        // Send booking form
        const form = generateBookingForm(input.customerLanguage || "ko", bookingIntent.entities);

        return {
          ...ragOutput,
          response: bookingIntent.suggestedResponse + "\n\n" + form.content,
          bookingIntent,
          bookingFormSent: true,
        };
      } else if (bookingIntent.recommendedAction === "confirm_booking") {
        // Direct booking request - create booking request immediately
        const bookingRequestId = await this.createBookingRequestFromIntent(
          input,
          bookingIntent
        );

        // Generate confirmation response
        const confirmationResponse = this.generateBookingConfirmation(
          input.customerLanguage || "ko",
          bookingIntent.entities
        );

        return {
          ...ragOutput,
          response: confirmationResponse,
          bookingIntent,
          bookingRequestId,
        };
      }
    }

    // 7. Add booking guidance to normal responses
    if (!bookingIntent.detected || bookingIntent.confidence < 0.5) {
      const guidedResponse = addBookingGuidance(
        ragOutput.response,
        bookingPromptIntensity,
        input.customerLanguage || "ko"
      );

      return {
        ...ragOutput,
        response: guidedResponse,
        bookingIntent,
        bookingGuidance: "added",
      };
    }

    // 8. Medium confidence: Use AI's suggested response
    return {
      ...ragOutput,
      response: bookingIntent.suggestedResponse || ragOutput.response,
      bookingIntent,
    };
  },

  /**
   * Handle booking form submission
   */
  async handleBookingFormSubmission(
    input: EnhancedRAGInput
  ): Promise<EnhancedRAGOutput> {
    const parsed = parseBookingFormResponse(input.query);

    if (!parsed.requestedDate) {
      // Incomplete form - ask for missing info
      const response =
        input.customerLanguage === "ja"
          ? "ご希望の日付を教えていただけますか？"
          : input.customerLanguage === "en"
          ? "Could you please provide your preferred date?"
          : "희망하시는 날짜를 알려주시겠어요?";

      return {
        response,
        confidence: 1.0,
        model: "gpt-4",
        retrievedDocuments: [],
        sources: [],
        shouldEscalate: false,
        processingTimeMs: 0,
      };
    }

    // Create booking request
    try {
      const supabase = await createServiceClient();

      // Get tenant_id from channel_account
      const { data: channelAccount } = await supabase
        .from("channel_accounts")
        .select("tenant_id")
        .eq("id", input.channelAccountId)
        .single();

      if (!channelAccount) {
        throw new Error("Channel account not found");
      }

      const bookingRequest = await createBookingRequest({
        tenantId: channelAccount.tenant_id,
        customerId: input.customerId,
        conversationId: input.conversationId,
        requestedDate: parsed.requestedDate,
        requestedTime: parsed.requestedTime || undefined,
        treatmentType: parsed.treatmentType || undefined,
        specialRequests: parsed.specialRequests || undefined,
        metadata: {
          source: "booking_form",
          language: input.customerLanguage,
        },
      });

      // Generate confirmation message
      const confirmationMsg = this.generateBookingConfirmation(
        input.customerLanguage || "ko",
        {
          requestedDate: parsed.requestedDate,
          requestedTime: parsed.requestedTime || undefined,
          treatmentType: parsed.treatmentType || undefined,
        }
      );

      return {
        response: confirmationMsg,
        confidence: 1.0,
        model: "gpt-4",
        retrievedDocuments: [],
        sources: [],
        shouldEscalate: false,
        processingTimeMs: 0,
        bookingRequestId: bookingRequest.id,
      };
    } catch (error) {
      console.error("[Booking Form] Error:", error);

      // Error response
      const errorMsg =
        input.customerLanguage === "ja"
          ? "申し訳ございません。予約処理中にエラーが発生しました。担当者にお繋ぎします。"
          : input.customerLanguage === "en"
          ? "I'm sorry, there was an error processing your booking. Let me connect you with our staff."
          : "죄송합니다. 예약 처리 중 오류가 발생했습니다. 담당자에게 연결해드리겠습니다.";

      return {
        response: errorMsg,
        confidence: 0,
        model: "gpt-4",
        retrievedDocuments: [],
        sources: [],
        shouldEscalate: true,
        escalationReason: "예약 처리 오류",
        processingTimeMs: 0,
      };
    }
  },

  /**
   * Create booking request from detected intent
   */
  async createBookingRequestFromIntent(
    input: EnhancedRAGInput,
    intent: BookingIntent
  ): Promise<string> {
    const supabase = await createServiceClient();

    // Get tenant_id from channel_account
    const { data: channelAccount } = await supabase
      .from("channel_accounts")
      .select("tenant_id")
      .eq("id", input.channelAccountId)
      .single();

    if (!channelAccount) {
      throw new Error("Channel account not found");
    }

    const bookingRequest = await createBookingRequest({
      tenantId: channelAccount.tenant_id,
      customerId: input.customerId,
      conversationId: input.conversationId,
      requestedDate: intent.entities.requestedDate || "",
      requestedTime: intent.entities.requestedTime,
      treatmentType: intent.entities.treatmentType,
      specialRequests: intent.entities.specialRequests,
      metadata: {
        source: "intent_detection",
        confidence: intent.confidence,
        language: input.customerLanguage,
      },
    });

    return bookingRequest.id;
  },

  /**
   * Generate booking confirmation message
   */
  generateBookingConfirmation(
    language: string,
    entities: {
      requestedDate?: string;
      requestedTime?: string;
      treatmentType?: string;
    }
  ): string {
    const templates = {
      ko: `✅ 예약 신청이 접수되었습니다!

📅 희망 날짜: ${entities.requestedDate}
${entities.requestedTime ? `🕐 희망 시간: ${entities.requestedTime}` : ""}
${entities.treatmentType ? `💊 시술: ${entities.treatmentType}` : ""}

담당자가 확인 후 24시간 내에 예약 가능 여부를 안내해드리겠습니다.
감사합니다! 🙏`,

      ja: `✅ 予約申し込みを受け付けました！

📅 ご希望日: ${entities.requestedDate}
${entities.requestedTime ? `🕐 ご希望時間: ${entities.requestedTime}` : ""}
${entities.treatmentType ? `💊 施術: ${entities.treatmentType}` : ""}

担当者が確認後、24時間以内に予約可能かどうかをご案内いたします。
ありがとうございます！ 🙏`,

      en: `✅ Your booking request has been received!

📅 Preferred Date: ${entities.requestedDate}
${entities.requestedTime ? `🕐 Preferred Time: ${entities.requestedTime}` : ""}
${entities.treatmentType ? `💊 Treatment: ${entities.treatmentType}` : ""}

Our staff will review and confirm availability within 24 hours.
Thank you! 🙏`,

      zh: `✅ 您的预约申请已收到！

📅 希望日期: ${entities.requestedDate}
${entities.requestedTime ? `🕐 希望时间: ${entities.requestedTime}` : ""}
${entities.treatmentType ? `💊 治疗: ${entities.treatmentType}` : ""}

我们的工作人员将在24小时内确认并通知您预约是否可行。
谢谢！ 🙏`,
    };

    return templates[language as keyof typeof templates] || templates.en;
  },
};
