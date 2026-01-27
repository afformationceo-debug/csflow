/**
 * Escalation Learning Pipeline
 * Converts resolved escalations into knowledge base entries
 */

import { createServiceClient } from "@/lib/supabase/server";
import { knowledgeBaseService } from "./ai/knowledge-base";
import { llmService } from "./ai/llm";

interface EscalationData {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId: string;
  reason: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

interface ConversationContext {
  customerMessage: string;
  agentResponse: string;
  customerLanguage: string;
  conversationHistory: Array<{
    role: "customer" | "agent";
    content: string;
  }>;
}

interface LearningResult {
  success: boolean;
  documentId?: string;
  extractedKnowledge?: {
    question: string;
    answer: string;
    paraphrases: string[];
    category: string;
    tags: string[];
  };
  error?: string;
}

/**
 * Learning Pipeline Service
 */
export const learningPipeline = {
  /**
   * Process a resolved escalation and extract knowledge
   */
  async processEscalation(
    escalationId: string
  ): Promise<LearningResult> {
    const supabase = await createServiceClient();

    try {
      // Load escalation data
      const { data: escalation, error: escError } = await supabase
        .from("escalations")
        .select(`
          *,
          conversation:conversations(
            *,
            customer:customers(*),
            customer_channel:customer_channels(*)
          ),
          message:messages(*)
        `)
        .eq("id", escalationId)
        .single();

      if (escError || !escalation) {
        return { success: false, error: "Escalation not found" };
      }

      const escData = escalation as unknown as {
        id: string;
        tenant_id: string;
        conversation_id: string;
        message_id: string;
        reason: string;
        resolution?: string;
        resolved_by?: string;
        resolved_at?: string;
        conversation: {
          id: string;
          customer: { language?: string };
        };
        message: { content?: string };
      };

      // Check if already processed
      const { data: existing } = await (supabase
        .from("knowledge_documents") as unknown as {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => {
                single: () => Promise<{ data: unknown | null }>;
              };
            };
          };
        })
        .select("id")
        .eq("source_type", "escalation")
        .eq("source_id", escalationId)
        .single();

      if (existing) {
        return {
          success: false,
          error: "Escalation already processed",
        };
      }

      // Get conversation context
      const context = await this.getConversationContext(
        escData.conversation_id,
        escData.message_id
      );

      if (!context) {
        return { success: false, error: "Could not load conversation context" };
      }

      // Extract knowledge using LLM
      const extractedKnowledge = await this.extractKnowledge(
        context,
        escData.resolution || ""
      );

      if (!extractedKnowledge) {
        return { success: false, error: "Could not extract knowledge" };
      }

      // Create knowledge document
      const document = await knowledgeBaseService.createDocument({
        tenantId: escData.tenant_id,
        title: extractedKnowledge.question.slice(0, 100),
        content: this.formatKnowledgeContent(extractedKnowledge),
        category: extractedKnowledge.category,
        tags: extractedKnowledge.tags,
        sourceType: "escalation",
        sourceId: escalationId,
        createdBy: escData.resolved_by,
      });

      // Mark escalation as learned
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("escalations")
        .update({
          learned_at: new Date().toISOString(),
          knowledge_document_id: document.id,
        })
        .eq("id", escalationId);

      return {
        success: true,
        documentId: document.id,
        extractedKnowledge,
      };
    } catch (error) {
      console.error("Learning pipeline error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Get conversation context for knowledge extraction
   */
  async getConversationContext(
    conversationId: string,
    triggerMessageId: string
  ): Promise<ConversationContext | null> {
    const supabase = await createServiceClient();

    // Get messages around the trigger message
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!messages || messages.length === 0) {
      return null;
    }

    // Find trigger message
    const triggerIndex = messages.findIndex(
      (m: { id: string }) => m.id === triggerMessageId
    );

    const triggerMsg = messages[triggerIndex] as {
      content?: string;
      message_type: string;
      original_language?: string;
    } | undefined;

    if (!triggerMsg) {
      return null;
    }

    // Get customer message (trigger) and agent response (next agent message)
    const customerMessage = triggerMsg.content || "";

    // Find agent response after trigger
    const agentResponse = (messages.slice(triggerIndex + 1) as Array<{
      content?: string;
      message_type: string;
    }>).find(
      (m) => m.message_type === "agent"
    )?.content || "";

    // Build conversation history
    const conversationHistory = (messages.slice(
      Math.max(0, triggerIndex - 5),
      triggerIndex + 3
    ) as Array<{
      message_type: string;
      content?: string;
    }>).map((m) => ({
      role: (m.message_type === "customer" ? "customer" : "agent") as
        | "customer"
        | "agent",
      content: m.content || "",
    }));

    return {
      customerMessage,
      agentResponse,
      customerLanguage: triggerMsg.original_language || "KO",
      conversationHistory,
    };
  },

  /**
   * Extract knowledge from conversation using LLM
   */
  async extractKnowledge(
    context: ConversationContext,
    resolution: string
  ): Promise<{
    question: string;
    answer: string;
    paraphrases: string[];
    category: string;
    tags: string[];
  } | null> {
    const prompt = `다음 고객 상담 대화를 분석하여 지식베이스에 추가할 정보를 추출해주세요.

## 고객 질문
${context.customerMessage}

## 상담사 답변
${context.agentResponse || resolution}

## 대화 맥락
${context.conversationHistory.map((m) => `${m.role === "customer" ? "고객" : "상담사"}: ${m.content}`).join("\n")}

## 요청사항
위 대화를 분석하여 다음 JSON 형식으로 지식을 추출해주세요:

{
  "question": "고객의 핵심 질문 (정제된 형태)",
  "answer": "상담사의 답변 (정리된 형태)",
  "paraphrases": ["유사한 질문 형태 1", "유사한 질문 형태 2", "유사한 질문 형태 3"],
  "category": "FAQ/가격/예약/시술정보/주의사항 중 하나",
  "tags": ["관련 키워드 태그 배열"]
}

JSON만 출력해주세요.`;

    try {
      // Use llmService with proper signature
      const llmResponse = await llmService.generate(
        prompt,
        [], // No documents needed
        { temperature: 0.3 }
      );

      // Parse JSON response
      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        question: parsed.question,
        answer: parsed.answer,
        paraphrases: parsed.paraphrases || [],
        category: parsed.category || "FAQ",
        tags: parsed.tags || [],
      };
    } catch (error) {
      console.error("Knowledge extraction error:", error);
      return null;
    }
  },

  /**
   * Format extracted knowledge into document content
   */
  formatKnowledgeContent(knowledge: {
    question: string;
    answer: string;
    paraphrases: string[];
    category: string;
    tags: string[];
  }): string {
    return `## 질문
${knowledge.question}

## 답변
${knowledge.answer}

## 유사 질문 예시
${knowledge.paraphrases.map((p) => `- ${p}`).join("\n")}

## 메타데이터
- 카테고리: ${knowledge.category}
- 태그: ${knowledge.tags.join(", ")}
- 출처: 에스컬레이션 학습
`;
  },

  /**
   * Batch process all unlearned resolved escalations
   */
  async processUnlearnedEscalations(
    tenantId: string
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const supabase = await createServiceClient();

    // Find resolved escalations without learning
    const { data: escalations } = await supabase
      .from("escalations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "resolved")
      .is("learned_at", null)
      .limit(50);

    if (!escalations || escalations.length === 0) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    let successful = 0;
    let failed = 0;

    for (const esc of escalations as Array<{ id: string }>) {
      const result = await this.processEscalation(esc.id);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      processed: escalations.length,
      successful,
      failed,
    };
  },

  /**
   * Get learning statistics for a tenant
   */
  async getLearningStatistics(tenantId: string): Promise<{
    totalEscalations: number;
    resolvedEscalations: number;
    learnedEscalations: number;
    pendingLearning: number;
    documentsFromLearning: number;
  }> {
    const supabase = await createServiceClient();

    // Escalation counts
    const { count: total } = await supabase
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    const { count: resolved } = await supabase
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "resolved");

    const { count: learned } = await supabase
      .from("escalations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("learned_at", "is", null);

    // Documents from learning
    const { count: docs } = await (supabase
      .from("knowledge_documents") as unknown as {
        select: (cols: string, opts: { count: string; head: boolean }) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => Promise<{ count: number | null }>;
          };
        };
      })
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("source_type", "escalation");

    return {
      totalEscalations: total || 0,
      resolvedEscalations: resolved || 0,
      learnedEscalations: learned || 0,
      pendingLearning: (resolved || 0) - (learned || 0),
      documentsFromLearning: docs || 0,
    };
  },
};

export default learningPipeline;
