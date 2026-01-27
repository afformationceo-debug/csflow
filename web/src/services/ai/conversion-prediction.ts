/**
 * Conversion Prediction Service
 * ML-based prediction of customer booking/conversion probability
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ConversionPrediction {
  probability: number; // 0-1 probability of conversion
  confidence: number;
  stage: ConversionStage;
  factors: ConversionFactor[];
  recommendedActions: RecommendedAction[];
  predictedTimeframe?: string; // e.g., "within 7 days"
  riskOfChurn: number; // 0-1 probability of losing the customer
}

export type ConversionStage =
  | "initial_inquiry"
  | "information_gathering"
  | "consideration"
  | "decision_pending"
  | "ready_to_book"
  | "booked"
  | "at_risk";

export interface ConversionFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number; // 0-1
  description: string;
}

export interface RecommendedAction {
  action: string;
  priority: "high" | "medium" | "low";
  expectedImpact: number; // Expected increase in conversion probability
  template?: string; // Suggested message template
}

export interface CustomerFeatures {
  messageCount: number;
  responseRate: number;
  avgResponseTime: number;
  sentimentScore: number;
  inquiryTopics: string[];
  priceInquired: boolean;
  appointmentMentioned: boolean;
  competitorMentioned: boolean;
  daysSinceFirstContact: number;
  channelType: string;
  language: string;
  previousBookings?: number;
}

/**
 * Predict conversion probability for a customer
 */
export async function predictConversion(
  customerId: string,
  tenantId: string
): Promise<ConversionPrediction> {
  const supabase = await createServiceClient();

  // Gather customer features
  const features = await gatherCustomerFeatures(customerId, tenantId);

  // Use LLM for feature analysis and prediction
  const prediction = await analyzeWithLLM(features, tenantId);

  // Store prediction
  await storePrediction(customerId, prediction);

  return prediction;
}

/**
 * Gather features for prediction model
 */
async function gatherCustomerFeatures(
  customerId: string,
  tenantId: string
): Promise<CustomerFeatures> {
  const supabase = await createServiceClient();

  // Get customer data
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  // Get conversation data with messages
  const { data: conversationsData } = await supabase
    .from("conversations")
    .select(`
      id,
      created_at,
      messages (
        id,
        content,
        direction,
        created_at,
        metadata
      )
    `)
    .eq("customer_id", customerId);

  // Type the conversations with messages
  interface MessageData {
    id: string;
    content: string;
    direction: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }
  interface ConversationWithMessages {
    id: string;
    created_at: string;
    messages: MessageData[];
  }
  const conversations = conversationsData as unknown as ConversationWithMessages[] | null;

  // Get booking history
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", customerId);

  // Calculate features
  const allMessages = conversations?.flatMap((c) => c.messages || []) || [];
  const inboundMessages = allMessages.filter((m) => m.direction === "inbound");
  const outboundMessages = allMessages.filter((m) => m.direction === "outbound");

  // Analyze message content for topics
  const messageContent = inboundMessages.map((m) => m.content).join(" ");
  const priceInquired = /가격|비용|얼마|price|cost|how much/i.test(messageContent);
  const appointmentMentioned = /예약|방문|appointment|visit|book/i.test(messageContent);
  const competitorMentioned = /다른|비교|competitor|other hospital/i.test(messageContent);

  // Calculate response rate and time
  let responseRate = 0;
  let avgResponseTime = 0;
  if (outboundMessages.length > 0 && inboundMessages.length > 1) {
    // Simplified calculation - in production would be more sophisticated
    responseRate = Math.min(inboundMessages.length / outboundMessages.length, 1);
  }

  // Get sentiment scores from metadata
  const sentimentScores = inboundMessages
    .map((m) => (m.metadata as Record<string, { score?: number }>)?.sentiment?.score)
    .filter((s) => s !== undefined) as number[];
  const avgSentiment =
    sentimentScores.length > 0
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : 0;

  // Calculate days since first contact
  const firstContact = conversations?.[0]?.created_at;
  const daysSinceFirstContact = firstContact
    ? Math.floor(
        (Date.now() - new Date(firstContact).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerData = customer as any;
  const customerMeta = customerData?.metadata;

  return {
    messageCount: allMessages.length,
    responseRate,
    avgResponseTime,
    sentimentScore: avgSentiment,
    inquiryTopics: extractTopics(messageContent),
    priceInquired,
    appointmentMentioned,
    competitorMentioned,
    daysSinceFirstContact,
    channelType: customerMeta?.primary_channel || "unknown",
    language: customerData?.language || "ko",
    previousBookings: bookings?.length || 0,
  };
}

/**
 * Use LLM for conversion prediction analysis
 */
async function analyzeWithLLM(
  features: CustomerFeatures,
  tenantId: string
): Promise<ConversionPrediction> {
  const prompt = `당신은 고객 전환율 예측 전문가입니다. 다음 고객 데이터를 분석하여 예약/전환 확률을 예측해주세요.

고객 데이터:
- 총 메시지 수: ${features.messageCount}
- 응답률: ${(features.responseRate * 100).toFixed(1)}%
- 감정 점수: ${features.sentimentScore.toFixed(2)} (-1~1)
- 문의 주제: ${features.inquiryTopics.join(", ")}
- 가격 문의 여부: ${features.priceInquired ? "예" : "아니오"}
- 예약 언급 여부: ${features.appointmentMentioned ? "예" : "아니오"}
- 경쟁사 언급 여부: ${features.competitorMentioned ? "예" : "아니오"}
- 첫 연락 이후 경과일: ${features.daysSinceFirstContact}일
- 채널: ${features.channelType}
- 언어: ${features.language}
- 이전 예약 횟수: ${features.previousBookings}

다음 JSON 형식으로 응답해주세요:
{
  "probability": 0~1 사이의 전환 확률,
  "confidence": 0~1 사이의 예측 신뢰도,
  "stage": "initial_inquiry | information_gathering | consideration | decision_pending | ready_to_book | booked | at_risk",
  "factors": [
    {
      "factor": "요인명",
      "impact": "positive | negative | neutral",
      "weight": 0~1 가중치,
      "description": "설명"
    }
  ],
  "recommendedActions": [
    {
      "action": "권장 행동",
      "priority": "high | medium | low",
      "expectedImpact": 0~1 예상 영향,
      "template": "제안 메시지 템플릿 (선택)"
    }
  ],
  "predictedTimeframe": "예상 전환 기간 (예: within 7 days)",
  "riskOfChurn": 0~1 이탈 위험도
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 의료 관광 CS 플랫폼의 고객 전환율 예측 전문가입니다. 데이터 기반으로 정확한 예측을 제공합니다.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    return JSON.parse(content) as ConversionPrediction;
  } catch (error) {
    console.error("Conversion prediction error:", error);
    // Return default prediction on error
    return getDefaultPrediction(features);
  }
}

/**
 * Get default prediction based on simple heuristics
 */
function getDefaultPrediction(features: CustomerFeatures): ConversionPrediction {
  let probability = 0.3; // Base probability

  // Positive factors
  if (features.priceInquired) probability += 0.15;
  if (features.appointmentMentioned) probability += 0.25;
  if (features.sentimentScore > 0.3) probability += 0.1;
  if (features.previousBookings && features.previousBookings > 0) probability += 0.2;
  if (features.responseRate > 0.7) probability += 0.1;

  // Negative factors
  if (features.competitorMentioned) probability -= 0.1;
  if (features.sentimentScore < -0.3) probability -= 0.15;
  if (features.daysSinceFirstContact > 30) probability -= 0.1;

  probability = Math.max(0, Math.min(1, probability));

  return {
    probability,
    confidence: 0.6,
    stage: determineStage(features, probability),
    factors: [],
    recommendedActions: [],
    riskOfChurn: features.sentimentScore < -0.2 ? 0.5 : 0.2,
  };
}

/**
 * Determine conversion stage
 */
function determineStage(features: CustomerFeatures, probability: number): ConversionStage {
  if (features.previousBookings && features.previousBookings > 0) return "booked";
  if (probability > 0.7 && features.appointmentMentioned) return "ready_to_book";
  if (probability > 0.5 && features.priceInquired) return "decision_pending";
  if (features.priceInquired || features.appointmentMentioned) return "consideration";
  if (features.messageCount > 3) return "information_gathering";
  if (features.sentimentScore < -0.3) return "at_risk";
  return "initial_inquiry";
}

/**
 * Extract topics from message content
 */
function extractTopics(content: string): string[] {
  const topics: string[] = [];
  const topicPatterns: Record<string, RegExp> = {
    pricing: /가격|비용|얼마|price|cost/i,
    procedure: /시술|수술|procedure|surgery/i,
    scheduling: /예약|일정|schedule|appointment/i,
    recovery: /회복|기간|recovery|healing/i,
    visa: /비자|visa/i,
    accommodation: /숙소|호텔|accommodation|hotel/i,
    transportation: /교통|픽업|transport|pickup/i,
    insurance: /보험|insurance/i,
    reviews: /후기|리뷰|review/i,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(content)) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Store prediction in database
 */
async function storePrediction(
  customerId: string,
  prediction: ConversionPrediction
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("customers").update({
    metadata: {
      conversion_prediction: {
        ...prediction,
        predicted_at: new Date().toISOString(),
      },
    },
  }).eq("id", customerId);
}

/**
 * Get high-value leads (customers with high conversion probability)
 */
export async function getHighValueLeads(
  tenantId: string,
  options: {
    minProbability?: number;
    limit?: number;
    stages?: ConversionStage[];
  } = {}
): Promise<Array<{ customerId: string; prediction: ConversionPrediction }>> {
  const supabase = await createServiceClient();
  const { minProbability = 0.5, limit = 20, stages } = options;

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .not("metadata->conversion_prediction", "is", null);

  if (!customersData) return [];

  // Type cast for metadata access
  const customers = customersData as Array<{ id: string; metadata: Record<string, ConversionPrediction> | null }>;

  return customers
    .filter((c) => {
      const prediction = c.metadata?.conversion_prediction;
      if (!prediction) return false;
      if (prediction.probability < minProbability) return false;
      if (stages && !stages.includes(prediction.stage)) return false;
      return true;
    })
    .map((c) => ({
      customerId: c.id,
      prediction: c.metadata!.conversion_prediction,
    }))
    .sort((a, b) => b.prediction.probability - a.prediction.probability)
    .slice(0, limit);
}

/**
 * Get conversion funnel analytics
 */
export async function getConversionFunnel(
  tenantId: string,
  dateRange: { start: Date; end: Date }
): Promise<{
  stages: Record<ConversionStage, number>;
  conversionRates: Record<string, number>;
  averageProbability: number;
  topFactors: Array<{ factor: string; count: number }>;
}> {
  const supabase = await createServiceClient();

  const { data: customersData } = await supabase
    .from("customers")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .gte("created_at", dateRange.start.toISOString())
    .lte("created_at", dateRange.end.toISOString());

  // Type cast for metadata access
  const customers = customersData as Array<{ metadata: Record<string, ConversionPrediction> | null }> | null;

  const stages: Record<ConversionStage, number> = {
    initial_inquiry: 0,
    information_gathering: 0,
    consideration: 0,
    decision_pending: 0,
    ready_to_book: 0,
    booked: 0,
    at_risk: 0,
  };

  let totalProbability = 0;
  let count = 0;
  const factorCounts: Record<string, number> = {};

  customers?.forEach((c) => {
    const prediction = c.metadata?.conversion_prediction;
    if (prediction) {
      stages[prediction.stage]++;
      totalProbability += prediction.probability;
      count++;

      prediction.factors?.forEach((f) => {
        factorCounts[f.factor] = (factorCounts[f.factor] || 0) + 1;
      });
    }
  });

  const total = Object.values(stages).reduce((a, b) => a + b, 0) || 1;
  const conversionRates: Record<string, number> = {
    inquiry_to_consideration:
      total > 0
        ? (stages.consideration + stages.decision_pending + stages.ready_to_book + stages.booked) /
          total
        : 0,
    consideration_to_booking:
      stages.consideration + stages.decision_pending + stages.ready_to_book > 0
        ? stages.booked /
          (stages.consideration + stages.decision_pending + stages.ready_to_book + stages.booked)
        : 0,
  };

  const topFactors = Object.entries(factorCounts)
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    stages,
    conversionRates,
    averageProbability: count > 0 ? totalProbability / count : 0,
    topFactors,
  };
}

/**
 * Batch update predictions for all active customers
 */
export async function batchUpdatePredictions(tenantId: string): Promise<number> {
  const supabase = await createServiceClient();

  // Get active customers (with recent conversations)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: customersData } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .gte("updated_at", thirtyDaysAgo.toISOString());

  // Type cast for id access
  const customers = customersData as Array<{ id: string }> | null;

  if (!customers) return 0;

  let updated = 0;
  for (const customer of customers) {
    try {
      await predictConversion(customer.id, tenantId);
      updated++;
    } catch (error) {
      console.error(`Failed to update prediction for customer ${customer.id}:`, error);
    }
  }

  return updated;
}

export const conversionPredictionService = {
  predictConversion,
  getHighValueLeads,
  getConversionFunnel,
  batchUpdatePredictions,
};
