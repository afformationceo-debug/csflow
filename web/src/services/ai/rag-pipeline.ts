import { createServiceClient } from "@/lib/supabase/server";
import { Tenant, Message, Conversation } from "@/lib/supabase/types";
import { retrieveDocuments, hybridSearch, RetrievedDocument } from "./retriever";
import { llmService, LLMResponse, LLMModel } from "./llm";
import { translationService, SupportedLanguage } from "../translation";
import {
  CACHE_KEYS,
  CACHE_TTL,
  getFromCache,
  setToCache,
} from "@/lib/upstash/redis";

export interface RAGInput {
  query: string;
  tenantId: string;
  conversationId: string;
  customerLanguage?: SupportedLanguage;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

export interface RAGSource {
  type: "system_prompt" | "knowledge_base" | "tenant_config" | "conversation_history" | "feedback_db";
  name: string;
  description?: string;
  relevanceScore?: number;
}

export interface RAGOutput {
  response: string;
  translatedResponse?: string;
  confidence: number;
  model: LLMModel;
  retrievedDocuments: RetrievedDocument[];
  sources: RAGSource[];  // NEW: Track which sources were used
  shouldEscalate: boolean;
  escalationReason?: string;
  processingTimeMs: number;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason?: string;
  priority: "low" | "medium" | "high" | "urgent";
}

/**
 * Check if query should be escalated based on keywords and patterns
 */
function checkEscalationKeywords(
  query: string,
  tenantConfig: Tenant["ai_config"]
): EscalationDecision | null {
  const config = tenantConfig as {
    escalation_keywords?: string[];
    always_escalate_patterns?: string[];
  };

  // Urgent escalation patterns
  const urgentPatterns = [
    /응급|긴급|급하게|지금 당장/,
    /통증.*심하|심한.*통증/,
    /출혈|피가 나|bleeding/i,
    /complaint|complain|불만|화가|짜증/i,
    /소송|법적|변호사|lawyer/i,
  ];

  for (const pattern of urgentPatterns) {
    if (pattern.test(query)) {
      return {
        shouldEscalate: true,
        reason: "긴급 키워드 감지",
        priority: "urgent",
      };
    }
  }

  // Custom escalation keywords from tenant config
  const customKeywords = config?.escalation_keywords || [];
  for (const keyword of customKeywords) {
    if (query.toLowerCase().includes(keyword.toLowerCase())) {
      return {
        shouldEscalate: true,
        reason: `키워드 감지: ${keyword}`,
        priority: "high",
      };
    }
  }

  return null;
}

/**
 * Check if response confidence is below threshold
 */
function checkConfidenceThreshold(
  confidence: number,
  tenantConfig: Tenant["ai_config"]
): EscalationDecision | null {
  const config = tenantConfig as { confidence_threshold?: number };
  const threshold = config?.confidence_threshold || 0.75;

  if (confidence < threshold) {
    let priority: "low" | "medium" | "high" = "medium";
    if (confidence < 0.5) priority = "high";
    if (confidence < 0.3) priority = "high";

    return {
      shouldEscalate: true,
      reason: `신뢰도 미달: ${(confidence * 100).toFixed(1)}% (기준: ${(
        threshold * 100
      ).toFixed(1)}%)`,
      priority,
    };
  }

  return null;
}

/**
 * Check if query is about sensitive topics that need human review
 */
function checkSensitiveTopics(query: string): EscalationDecision | null {
  const sensitivePatterns = [
    { pattern: /가격.*할인|할인.*가격|discount|pricing/i, reason: "가격 협상" },
    { pattern: /환불|refund|취소.*돈/i, reason: "환불 요청" },
    { pattern: /부작용|side effect|합병증/i, reason: "의료적 우려사항" },
    { pattern: /실패|잘못|mistake|wrong/i, reason: "불만 가능성" },
  ];

  for (const { pattern, reason } of sensitivePatterns) {
    if (pattern.test(query)) {
      return {
        shouldEscalate: true,
        reason,
        priority: "medium",
      };
    }
  }

  return null;
}

/**
 * Main RAG Pipeline
 */
export const ragPipeline = {
  /**
   * Process a query through the full RAG pipeline
   */
  async process(input: RAGInput): Promise<RAGOutput> {
    const startTime = Date.now();
    const supabase = await createServiceClient();

    // 1. Get tenant configuration
    const { data: tenant } = await (supabase
      .from("tenants") as any)
      .select("*")
      .eq("id", input.tenantId)
      .single();

    if (!tenant) {
      throw new Error(`Tenant not found: ${input.tenantId}`);
    }

    const aiConfig = (tenant as any).ai_config as {
      enabled?: boolean;
      model?: LLMModel;
    };

    // Check if AI is enabled for this tenant
    if (!aiConfig?.enabled) {
      return {
        response: "",
        confidence: 0,
        model: "gpt-4",
        retrievedDocuments: [],
        sources: [],
        shouldEscalate: true,
        escalationReason: "AI 자동응대 비활성화됨",
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 2. Check for immediate escalation keywords
    const keywordEscalation = checkEscalationKeywords(input.query, (tenant as any).ai_config);
    if (keywordEscalation?.priority === "urgent") {
      return {
        response: "",
        confidence: 0,
        model: "gpt-4",
        retrievedDocuments: [],
        sources: [],
        shouldEscalate: true,
        escalationReason: keywordEscalation.reason,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 3. Translate query to Korean if needed (for retrieval)
    let queryForRetrieval = input.query;
    if (input.customerLanguage && input.customerLanguage !== "KO") {
      const translated = await translationService.translate(
        input.query,
        "KO",
        input.customerLanguage
      );
      queryForRetrieval = translated.text;
    }

    // 4. Retrieve relevant documents using hybrid search
    const documents = await hybridSearch({
      tenantId: input.tenantId,
      query: queryForRetrieval,
      topK: 5,
      threshold: 0.65,
    });

    // 5. Select model based on query complexity
    const selectedModel = aiConfig?.model || llmService.selectModel(
      input.query,
      documents.length
    );

    // 6. Generate response
    const llmResponse = await llmService.generate(
      queryForRetrieval,
      documents,
      {
        model: selectedModel,
        tenantConfig: (tenant as any).ai_config,
      }
    );

    // 7. Check for escalation conditions
    let escalationDecision: EscalationDecision | null = null;

    // Check confidence threshold
    escalationDecision = checkConfidenceThreshold(
      llmResponse.confidence,
      (tenant as any).ai_config
    );

    // Check sensitive topics if not already escalating
    if (!escalationDecision) {
      escalationDecision = checkSensitiveTopics(input.query);
    }

    // Check keyword escalation (non-urgent)
    if (!escalationDecision && keywordEscalation) {
      escalationDecision = keywordEscalation;
    }

    // 8. Translate response if customer uses different language
    let translatedResponse: string | undefined;
    if (
      input.customerLanguage &&
      input.customerLanguage !== "KO" &&
      llmResponse.content
    ) {
      const translated = await translationService.translate(
        llmResponse.content,
        input.customerLanguage,
        "KO"
      );
      translatedResponse = translated.text;
    }

    // 9. Build sources list
    const sources: RAGSource[] = [
      {
        type: "system_prompt",
        name: "시스템 프롬프트",
        description: `${tenant.name} 맞춤 AI 설정`,
      },
    ];

    // Add tenant config
    if (aiConfig) {
      sources.push({
        type: "tenant_config",
        name: "거래처 설정",
        description: `모델: ${selectedModel}, 신뢰도 임계값: ${(aiConfig as any).confidence_threshold || 0.75}`,
      });
    }

    // Add retrieved documents
    if (documents.length > 0) {
      documents.forEach((doc, idx) => {
        sources.push({
          type: "knowledge_base",
          name: doc.title || `문서 #${idx + 1}`,
          description: doc.category,
          relevanceScore: doc.similarity,
        });
      });
    }

    // Add conversation history if provided
    if (input.conversationHistory && input.conversationHistory.length > 0) {
      sources.push({
        type: "conversation_history",
        name: "대화 기록",
        description: `${input.conversationHistory.length}개 이전 메시지`,
      });
    }

    // 10. Log AI response for learning
    await this.logResponse({
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      query: input.query,
      response: llmResponse.content,
      model: llmResponse.model,
      confidence: llmResponse.confidence,
      retrievedDocs: documents,
      escalated: !!escalationDecision,
      processingTimeMs: Date.now() - startTime,
    });

    return {
      response: llmResponse.content,
      translatedResponse,
      confidence: llmResponse.confidence,
      model: llmResponse.model,
      retrievedDocuments: documents,
      sources,  // NEW: Include sources
      shouldEscalate: !!escalationDecision,
      escalationReason: escalationDecision?.reason,
      processingTimeMs: Date.now() - startTime,
    };
  },

  /**
   * Log AI response for learning and analytics
   */
  async logResponse(data: {
    conversationId: string;
    tenantId: string;
    query: string;
    response: string;
    model: string;
    confidence: number;
    retrievedDocs: RetrievedDocument[];
    escalated: boolean;
    processingTimeMs: number;
    messageId?: string;
  }): Promise<void> {
    const supabase = await createServiceClient();

    await (supabase.from("ai_response_logs") as any).insert({
      conversation_id: data.conversationId,
      tenant_id: data.tenantId,
      message_id: data.messageId || "",
      query: data.query,
      response: data.response,
      model: data.model,
      confidence: data.confidence,
      retrieved_docs: data.retrievedDocs.map((d) => ({
        id: d.id,
        title: d.title,
        similarity: d.similarity,
      })),
      escalated: data.escalated,
      processing_time_ms: data.processingTimeMs,
    });
  },

  /**
   * Get AI suggestion for agent (real-time assistance)
   */
  async getSuggestion(
    query: string,
    tenantId: string,
    conversationHistory: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    // Check cache
    const cacheKey = CACHE_KEYS.aiResponse(
      `suggestion:${tenantId}:${query.slice(0, 50)}`
    );
    const cached = await getFromCache<string>(cacheKey);
    if (cached) return cached;

    // Retrieve documents
    const documents = await retrieveDocuments({
      tenantId,
      query,
      topK: 3,
    });

    // Generate suggestion
    const suggestion = await llmService.generateSuggestion(
      query,
      documents,
      conversationHistory
    );

    // Cache for 30 minutes
    await setToCache(cacheKey, suggestion, CACHE_TTL.aiResponse);

    return suggestion;
  },

  /**
   * Provide feedback on AI response (for learning)
   */
  async provideFeedback(
    logId: string,
    feedback: "positive" | "negative"
  ): Promise<void> {
    const supabase = await createServiceClient();

    await (supabase
      .from("ai_response_logs") as any)
      .update({ feedback })
      .eq("id", logId);
  },
};

export default ragPipeline;
