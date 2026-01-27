/**
 * Sentiment Analysis Service
 * Analyzes customer sentiment and adjusts conversation priority
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SentimentResult {
  sentiment: SentimentType;
  score: number; // -1 (very negative) to 1 (very positive)
  confidence: number;
  emotions: EmotionScore[];
  urgency: UrgencyLevel;
  topics: string[];
  suggestedPriority: "urgent" | "high" | "normal" | "low";
  requiresEscalation: boolean;
  escalationReason?: string;
}

export type SentimentType =
  | "very_positive"
  | "positive"
  | "neutral"
  | "negative"
  | "very_negative";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";

export interface EmotionScore {
  emotion: string;
  score: number;
}

export interface SentimentAnalysisOptions {
  language?: string;
  includeEmotions?: boolean;
  conversationHistory?: Array<{ role: string; content: string }>;
  tenantContext?: string; // Domain-specific context (e.g., medical)
}

/**
 * Analyze sentiment of a single message
 */
export async function analyzeSentiment(
  text: string,
  options: SentimentAnalysisOptions = {}
): Promise<SentimentResult> {
  const { language = "ko", includeEmotions = true, conversationHistory, tenantContext } = options;

  const systemPrompt = buildSentimentSystemPrompt(language, tenantContext);
  const userPrompt = buildSentimentUserPrompt(text, includeEmotions, conversationHistory);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini model for cost efficiency
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from sentiment analysis");
    }

    return JSON.parse(content) as SentimentResult;
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    // Return neutral sentiment on error
    return {
      sentiment: "neutral",
      score: 0,
      confidence: 0.5,
      emotions: [],
      urgency: "medium",
      topics: [],
      suggestedPriority: "normal",
      requiresEscalation: false,
    };
  }
}

/**
 * Analyze sentiment trend over conversation
 */
export async function analyzeSentimentTrend(
  messages: Array<{ content: string; direction: "inbound" | "outbound"; created_at: string }>
): Promise<{
  trend: "improving" | "stable" | "declining";
  averageSentiment: number;
  sentimentOverTime: Array<{ timestamp: string; score: number }>;
  riskLevel: "low" | "medium" | "high";
}> {
  // Filter only inbound (customer) messages
  const customerMessages = messages
    .filter((m) => m.direction === "inbound")
    .slice(-10); // Last 10 messages

  if (customerMessages.length === 0) {
    return {
      trend: "stable",
      averageSentiment: 0,
      sentimentOverTime: [],
      riskLevel: "low",
    };
  }

  // Analyze each message
  const sentimentResults = await Promise.all(
    customerMessages.map(async (msg) => {
      const result = await analyzeSentiment(msg.content, { includeEmotions: false });
      return {
        timestamp: msg.created_at,
        score: result.score,
      };
    })
  );

  // Calculate trend
  const scores = sentimentResults.map((r) => r.score);
  const averageSentiment = scores.reduce((a, b) => a + b, 0) / scores.length;

  let trend: "improving" | "stable" | "declining" = "stable";
  if (scores.length >= 3) {
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg - firstAvg > 0.2) trend = "improving";
    else if (firstAvg - secondAvg > 0.2) trend = "declining";
  }

  // Calculate risk level
  let riskLevel: "low" | "medium" | "high" = "low";
  if (averageSentiment < -0.5 || trend === "declining") {
    riskLevel = "high";
  } else if (averageSentiment < -0.2) {
    riskLevel = "medium";
  }

  return {
    trend,
    averageSentiment,
    sentimentOverTime: sentimentResults,
    riskLevel,
  };
}

/**
 * Update conversation priority based on sentiment
 */
export async function updatePriorityBasedOnSentiment(
  conversationId: string,
  sentimentResult: SentimentResult
): Promise<void> {
  const supabase = await createServiceClient();

  const priorityMap: Record<string, string> = {
    urgent: "urgent",
    high: "high",
    normal: "normal",
    low: "low",
  };

  const updates: Record<string, unknown> = {
    priority: priorityMap[sentimentResult.suggestedPriority] || "normal",
    metadata: {
      sentiment: {
        type: sentimentResult.sentiment,
        score: sentimentResult.score,
        urgency: sentimentResult.urgency,
        analyzed_at: new Date().toISOString(),
      },
    },
  };

  // If escalation is required, update status
  if (sentimentResult.requiresEscalation) {
    updates.status = "escalated";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversations")
    .update(updates)
    .eq("id", conversationId);

  if (error) {
    console.error("Failed to update conversation priority:", error);
  }

  // Create escalation if needed
  if (sentimentResult.requiresEscalation) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("escalations").insert({
      conversation_id: conversationId,
      reason: sentimentResult.escalationReason || "Negative sentiment detected",
      priority: sentimentResult.suggestedPriority,
      status: "pending",
    });
  }
}

/**
 * Get sentiment dashboard data for a tenant
 */
export async function getSentimentDashboard(
  tenantId: string,
  dateRange: { start: Date; end: Date }
): Promise<{
  overallSentiment: number;
  sentimentDistribution: Record<SentimentType, number>;
  trendData: Array<{ date: string; avgScore: number; count: number }>;
  topNegativeTopics: Array<{ topic: string; count: number }>;
  atRiskConversations: number;
}> {
  const supabase = await createServiceClient();

  // Get conversations with sentiment data
  const { data: conversationsData } = await supabase
    .from("conversations")
    .select(`
      id,
      metadata,
      created_at,
      messages (
        content,
        direction,
        created_at
      )
    `)
    .gte("created_at", dateRange.start.toISOString())
    .lte("created_at", dateRange.end.toISOString())
    .eq("channel_account_id", tenantId);

  // Type cast for conversation data
  const conversations = conversationsData as Array<{
    id: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    messages: Array<{ content: string; direction: string; created_at: string }>;
  }> | null;

  // Process data (simplified - in production, this would use stored sentiment data)
  const sentimentDistribution: Record<SentimentType, number> = {
    very_positive: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    very_negative: 0,
  };

  let totalScore = 0;
  let count = 0;
  let atRiskCount = 0;

  conversations?.forEach((conv) => {
    const sentiment = conv.metadata?.sentiment as {
      type?: SentimentType;
      score?: number;
    } | undefined;
    if (sentiment?.type) {
      sentimentDistribution[sentiment.type]++;
      if (sentiment.score !== undefined) {
        totalScore += sentiment.score;
        count++;
        if (sentiment.score < -0.3) atRiskCount++;
      }
    }
  });

  return {
    overallSentiment: count > 0 ? totalScore / count : 0,
    sentimentDistribution,
    trendData: [], // Would be populated from time-series data
    topNegativeTopics: [], // Would be populated from topic analysis
    atRiskConversations: atRiskCount,
  };
}

/**
 * Real-time sentiment monitoring - process incoming message
 */
export async function processMessageSentiment(
  messageId: string,
  conversationId: string,
  content: string
): Promise<SentimentResult> {
  const supabase = await createServiceClient();

  // Get conversation history for context
  const { data: messagesData } = await supabase
    .from("messages")
    .select("content, direction")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Type cast for message data
  const messages = messagesData as Array<{ content: string; direction: string }> | null;

  const conversationHistory = messages?.reverse().map((m) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.content,
  }));

  // Analyze sentiment
  const result = await analyzeSentiment(content, {
    conversationHistory,
    includeEmotions: true,
  });

  // Store sentiment in message metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("messages")
    .update({
      metadata: {
        sentiment: {
          type: result.sentiment,
          score: result.score,
          emotions: result.emotions,
        },
      },
    })
    .eq("id", messageId);

  // Update conversation priority if needed
  if (result.suggestedPriority !== "normal" || result.requiresEscalation) {
    await updatePriorityBasedOnSentiment(conversationId, result);
  }

  return result;
}

// Helper functions

function buildSentimentSystemPrompt(language: string, tenantContext?: string): string {
  const langName = language === "ko" ? "한국어" : language === "ja" ? "일본어" : "영어";

  return `당신은 고객 감정 분석 전문가입니다. ${langName}로 분석된 메시지의 감정 상태를 평가합니다.

${tenantContext ? `도메인 컨텍스트: ${tenantContext}` : ""}

분석 기준:
1. 감정 상태: very_positive, positive, neutral, negative, very_negative
2. 점수: -1 (매우 부정) ~ 1 (매우 긍정)
3. 긴급도: critical, high, medium, low
4. 에스컬레이션 필요 여부

특히 주의할 신호:
- 불만, 분노, 실망 표현
- 환불/취소 요청
- 경쟁사 언급
- 법적 조치 언급
- 욕설이나 공격적 언어

응답은 반드시 JSON 형식으로 해주세요.`;
}

function buildSentimentUserPrompt(
  text: string,
  includeEmotions: boolean,
  conversationHistory?: Array<{ role: string; content: string }>
): string {
  const historyContext = conversationHistory
    ? `이전 대화:\n${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\n`
    : "";

  return `${historyContext}다음 메시지의 감정을 분석해주세요:

"${text}"

JSON 형식으로 응답:
{
  "sentiment": "very_positive | positive | neutral | negative | very_negative",
  "score": -1부터 1 사이의 숫자,
  "confidence": 0부터 1 사이의 신뢰도,
  ${includeEmotions ? `"emotions": [{"emotion": "감정명", "score": 0-1}],` : ""}
  "urgency": "critical | high | medium | low",
  "topics": ["감지된 주제들"],
  "suggestedPriority": "urgent | high | normal | low",
  "requiresEscalation": true/false,
  "escalationReason": "에스컬레이션 필요시 이유"
}`;
}

export const sentimentAnalysisService = {
  analyzeSentiment,
  analyzeSentimentTrend,
  updatePriorityBasedOnSentiment,
  getSentimentDashboard,
  processMessageSentiment,
};
