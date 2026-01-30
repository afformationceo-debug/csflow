/**
 * AI Booking Intent Detection Service
 *
 * 고객 메시지에서 예약 의도를 감지하고 엔티티를 추출합니다.
 * Human-in-the-Loop 풀자동화 시스템의 핵심 컴포넌트
 */

import { llmService } from "@/services/ai/llm";
import { createServiceClient } from "@/lib/supabase/server";

export interface BookingIntent {
  detected: boolean;
  confidence: number; // 0.0 ~ 1.0
  intentType:
    | "booking_inquiry" // "예약 가능한가요?"
    | "booking_request" // "2월 15일에 예약하고 싶어요"
    | "booking_modification" // "예약 날짜 변경"
    | "booking_cancellation" // "예약 취소"
    | null;

  // 추출된 엔티티
  entities: {
    requestedDate?: string; // "2026-02-15", "다음주 월요일"
    requestedTime?: string; // "오전 10시", "14:00"
    treatmentType?: string; // "라식", "라섹", "스마일라식"
    specialRequests?: string; // 고객의 특별 요청사항
  };

  // AI 추천 액션
  recommendedAction:
    | "send_form" // 예약 양식 전송
    | "ask_details" // 추가 정보 요청
    | "confirm_booking" // 예약 확정 진행
    | "escalate" // 휴먼 에스컬레이션
    | null;

  // AI 생성 응답
  suggestedResponse: string;
}

/**
 * 고객 메시지에서 예약 의도 감지
 */
export async function detectBookingIntent(
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  customerLanguage: string = "ko"
): Promise<BookingIntent> {
  const systemPrompt = `You are an expert booking intent classifier for a medical tourism platform.

Your task: Analyze customer messages to detect booking intentions and extract booking-related entities.

Response format (JSON only, no other text):
{
  "detected": boolean,
  "confidence": 0.0-1.0,
  "intentType": "booking_inquiry" | "booking_request" | "booking_modification" | "booking_cancellation" | null,
  "entities": {
    "requestedDate": "YYYY-MM-DD or natural language",
    "requestedTime": "HH:MM or natural language",
    "treatmentType": "specific treatment name",
    "specialRequests": "any special requests"
  },
  "recommendedAction": "send_form" | "ask_details" | "confirm_booking" | "escalate" | null,
  "suggestedResponse": "appropriate response in customer's language"
}

Intent types:
- booking_inquiry: Customer asking about availability ("예약 가능한가요?", "When can I book?")
- booking_request: Customer requesting specific date ("2월 15일에 예약", "I want to book for next Monday")
- booking_modification: Change existing booking
- booking_cancellation: Cancel booking

Confidence scoring:
- 0.9-1.0: Explicit booking request with date/time
- 0.7-0.89: Clear booking intention but missing details
- 0.5-0.69: Possible booking interest (asking about prices with scheduling context)
- 0.0-0.49: No booking intent

Entity extraction rules:
- Extract dates in both YYYY-MM-DD format AND original natural language
- Recognize relative dates: "다음주", "next week", "来週", "下周"
- Extract treatment types: LASIK, LASEK, Smile LASIK, Cataract, etc.
- Capture any special requests or concerns

Recommended actions:
- send_form: Confidence >0.7, customer ready to book
- ask_details: Confidence 0.5-0.7, need more info
- confirm_booking: Confidence >0.9, has date/time/treatment
- escalate: Complex situation or VIP customer

Customer language: ${customerLanguage}
Respond in customer's language.`;

  const userPrompt = `Current message: "${message}"

Conversation history:
${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

Analyze and respond with JSON only.`;

  try {
    const response = await llmService.query({
      systemPrompt,
      userPrompt,
      model: "gpt-4", // GPT-4 for better intent classification
      temperature: 0.1, // Low temperature for consistent classification
      maxTokens: 500,
    });

    // Parse JSON response
    const result = JSON.parse(response.text);

    // Validate confidence range
    if (result.confidence < 0 || result.confidence > 1) {
      result.confidence = Math.max(0, Math.min(1, result.confidence));
    }

    return result as BookingIntent;
  } catch (error) {
    console.error("[Intent Detection] Error:", error);

    // Fallback: 키워드 기반 간단 감지
    return fallbackKeywordDetection(message, customerLanguage);
  }
}

/**
 * 폴백: 키워드 기반 예약 의도 감지
 */
function fallbackKeywordDetection(
  message: string,
  language: string
): BookingIntent {
  const lowerMessage = message.toLowerCase();

  // 다국어 예약 키워드
  const bookingKeywords = {
    ko: ["예약", "방문", "상담 신청", "예약하고 싶", "예약 가능"],
    en: ["book", "appointment", "schedule", "reservation", "visit"],
    ja: ["予約", "訪問", "カウンセリング", "予約したい"],
    zh: ["预约", "预订", "咨询", "访问"],
  };

  const keywords = bookingKeywords[language as keyof typeof bookingKeywords] || bookingKeywords.en;
  const hasBookingKeyword = keywords.some((kw) => lowerMessage.includes(kw.toLowerCase()));

  if (hasBookingKeyword) {
    return {
      detected: true,
      confidence: 0.6, // Medium confidence for keyword match
      intentType: "booking_inquiry",
      entities: {},
      recommendedAction: "ask_details",
      suggestedResponse:
        language === "ko"
          ? "예약을 도와드리겠습니다. 희망하시는 날짜와 시술 종류를 알려주시겠어요?"
          : language === "ja"
          ? "ご予約をお手伝いします。ご希望の日付と施術の種類を教えていただけますか？"
          : "I'd be happy to help you book an appointment. Could you share your preferred date and treatment type?",
    };
  }

  return {
    detected: false,
    confidence: 0,
    intentType: null,
    entities: {},
    recommendedAction: null,
    suggestedResponse: "",
  };
}

/**
 * 예약 의도 감지 로그를 DB에 저장
 */
export async function logBookingIntent(
  conversationId: string,
  messageId: string | null,
  intent: BookingIntent
): Promise<void> {
  try {
    const supabase = await createServiceClient();

    await supabase.from("booking_intent_logs").insert({
      conversation_id: conversationId,
      message_id: messageId,
      intent_detected: intent.detected,
      intent_confidence: intent.confidence,
      intent_type: intent.intentType,
      extracted_entities: intent.entities,
      ai_action: intent.recommendedAction,
      ai_response: intent.suggestedResponse,
    });
  } catch (error) {
    console.error("[Intent Logging] Error:", error);
    // Non-blocking: 로그 실패해도 메인 플로우는 계속 진행
  }
}

/**
 * 예약 양식 생성 (고객 언어별)
 */
export function generateBookingForm(
  language: string,
  prefillData?: {
    requestedDate?: string;
    requestedTime?: string;
    treatmentType?: string;
  }
): {
  formType: "text" | "quick_reply" | "rich_message";
  content: string;
  metadata?: Record<string, unknown>;
} {
  const translations = {
    ko: {
      title: "📋 예약 신청서",
      intro: "아래 정보를 입력해주세요:",
      dateLabel: "희망 날짜",
      timeLabel: "희망 시간",
      treatmentLabel: "시술 종류",
      requestsLabel: "특별 요청사항",
      submitButton: "예약 신청",
    },
    ja: {
      title: "📋 予約申込書",
      intro: "以下の情報を入力してください：",
      dateLabel: "ご希望日",
      timeLabel: "ご希望時間",
      treatmentLabel: "施術の種類",
      requestsLabel: "特別なご要望",
      submitButton: "予約を申し込む",
    },
    en: {
      title: "📋 Booking Form",
      intro: "Please provide the following information:",
      dateLabel: "Preferred Date",
      timeLabel: "Preferred Time",
      treatmentLabel: "Treatment Type",
      requestsLabel: "Special Requests",
      submitButton: "Submit Booking",
    },
    zh: {
      title: "📋 预约表",
      intro: "请提供以下信息：",
      dateLabel: "希望日期",
      timeLabel: "希望时间",
      treatmentLabel: "治疗类型",
      requestsLabel: "特殊要求",
      submitButton: "提交预约",
    },
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const formContent = `${t.title}

${t.intro}

1️⃣ ${t.dateLabel}: ${prefillData?.requestedDate || "_______"}
2️⃣ ${t.timeLabel}: ${prefillData?.requestedTime || "_______"}
3️⃣ ${t.treatmentLabel}: ${prefillData?.treatmentType || "_______"}
4️⃣ ${t.requestsLabel}: _______

📝 아래 형식으로 답변해주세요:
날짜: YYYY-MM-DD
시간: HH:MM
시술: 종류
요청사항: 내용`;

  return {
    formType: "text",
    content: formContent,
    metadata: {
      formId: "booking_form_v1",
      prefilled: prefillData,
      language,
    },
  };
}

/**
 * 예약 양식 응답 파싱
 */
export function parseBookingFormResponse(response: string): {
  requestedDate: string | null;
  requestedTime: string | null;
  treatmentType: string | null;
  specialRequests: string | null;
} {
  const result = {
    requestedDate: null as string | null,
    requestedTime: null as string | null,
    treatmentType: null as string | null,
    specialRequests: null as string | null,
  };

  // 정규식으로 필드 추출
  const dateMatch = response.match(/날짜[:：]\s*(.+)/i) || response.match(/date[:：]\s*(.+)/i);
  const timeMatch = response.match(/시간[:：]\s*(.+)/i) || response.match(/time[:：]\s*(.+)/i);
  const treatmentMatch =
    response.match(/시술[:：]\s*(.+)/i) || response.match(/treatment[:：]\s*(.+)/i);
  const requestsMatch =
    response.match(/요청사항[:：]\s*(.+)/i) || response.match(/requests[:：]\s*(.+)/i);

  if (dateMatch) result.requestedDate = dateMatch[1].trim();
  if (timeMatch) result.requestedTime = timeMatch[1].trim();
  if (treatmentMatch) result.treatmentType = treatmentMatch[1].trim();
  if (requestsMatch) result.specialRequests = requestsMatch[1].trim();

  return result;
}
