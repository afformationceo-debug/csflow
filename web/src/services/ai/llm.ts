import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { Tenant } from "@/lib/supabase/types";
import { RetrievedDocument } from "./retriever";

// Lazy initialization of clients
let openai: OpenAI | null = null;
let anthropic: Anthropic | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export type LLMModel = "gpt-4" | "gpt-4-turbo" | "claude-3-opus" | "claude-3-sonnet";

export interface LLMResponse {
  content: string;
  model: LLMModel;
  confidence: number;
  tokensUsed: number;
  processingTimeMs: number;
}

export interface GenerateOptions {
  model?: LLMModel;
  temperature?: number;
  maxTokens?: number;
  tenantConfig?: Tenant["ai_config"];
}

/**
 * Build context from retrieved documents
 */
function buildContext(documents: RetrievedDocument[]): string {
  if (documents.length === 0) {
    return "관련 정보가 없습니다.";
  }

  return documents
    .map(
      (doc, i) =>
        `[문서 ${i + 1}] ${doc.title}\n${doc.chunkText}\n(유사도: ${(
          doc.similarity * 100
        ).toFixed(1)}%)`
    )
    .join("\n\n");
}

/**
 * Build system prompt for tenant
 */
function buildSystemPrompt(
  tenantConfig: Tenant["ai_config"],
  context: string
): string {
  const config = tenantConfig as {
    system_prompt?: string;
    hospital_name?: string;
    specialty?: string;
  };

  const basePrompt = config?.system_prompt || getDefaultSystemPrompt();

  return `${basePrompt}

## 병원 정보
- 병원명: ${config?.hospital_name || "정보 없음"}
- 전문 분야: ${config?.specialty || "정보 없음"}

## 참고 자료
${context}

## 응답 가이드라인
1. 반드시 참고 자료에 기반하여 답변하세요.
2. 확실하지 않은 정보는 "담당자에게 확인 후 안내드리겠습니다"라고 말하세요.
3. 의료적 조언은 직접 제공하지 말고, 상담 예약을 권유하세요.
4. 친절하고 전문적인 톤을 유지하세요.
5. 가격 정보는 정확한 경우에만 안내하세요.`;
}

function getDefaultSystemPrompt(): string {
  return `당신은 의료기관의 고객 상담을 돕는 AI 어시스턴트입니다.

주요 역할:
- 환자의 문의에 친절하고 정확하게 답변
- 시술/수술 정보 안내
- 예약 및 방문 안내
- 비용 문의 응대

주의사항:
- 의료적 진단이나 처방을 하지 않습니다
- 개인정보 보호를 철저히 합니다
- 확실하지 않은 정보는 담당자 연결을 안내합니다`;
}

/**
 * Calculate confidence score based on retrieved documents and response
 */
function calculateConfidence(
  documents: RetrievedDocument[],
  response: string,
  query: string
): number {
  // Base confidence from document relevance
  const avgSimilarity =
    documents.length > 0
      ? documents.reduce((sum, d) => sum + d.similarity, 0) / documents.length
      : 0;

  // Penalty for uncertainty phrases
  const uncertaintyPhrases = [
    "확실하지 않",
    "정확히 모르",
    "담당자에게 확인",
    "확인이 필요",
    "잘 모르겠",
  ];
  const hasUncertainty = uncertaintyPhrases.some((phrase) =>
    response.includes(phrase)
  );

  // Penalty for no context
  const noContextPenalty = documents.length === 0 ? 0.3 : 0;

  // Calculate final confidence
  let confidence = avgSimilarity * 0.6 + 0.4; // Base 40% + up to 60% from similarity
  if (hasUncertainty) confidence -= 0.15;
  confidence -= noContextPenalty;

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Generate response using GPT-4
 */
async function generateWithGPT(
  query: string,
  context: string,
  tenantConfig: Tenant["ai_config"],
  options: GenerateOptions
): Promise<Omit<LLMResponse, "confidence">> {
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(tenantConfig, context);
  const model = options.model === "gpt-4-turbo" ? "gpt-4-turbo" : "gpt-4";

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1000,
  });

  return {
    content: response.choices[0].message.content || "",
    model: options.model || "gpt-4",
    tokensUsed: response.usage?.total_tokens || 0,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate response using Claude
 */
async function generateWithClaude(
  query: string,
  context: string,
  tenantConfig: Tenant["ai_config"],
  options: GenerateOptions
): Promise<Omit<LLMResponse, "confidence">> {
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(tenantConfig, context);
  const model =
    options.model === "claude-3-opus"
      ? "claude-3-opus-20240229"
      : "claude-3-sonnet-20240229";

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: query }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    content,
    model: options.model || "claude-3-sonnet",
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Main LLM service
 */
export const llmService = {
  /**
   * Generate response with RAG context
   */
  async generate(
    query: string,
    documents: RetrievedDocument[],
    options: GenerateOptions = {}
  ): Promise<LLMResponse> {
    const context = buildContext(documents);
    const model = options.model || "gpt-4";

    let response: Omit<LLMResponse, "confidence">;

    if (model.startsWith("claude")) {
      response = await generateWithClaude(
        query,
        context,
        options.tenantConfig || {},
        options
      );
    } else {
      response = await generateWithGPT(
        query,
        context,
        options.tenantConfig || {},
        options
      );
    }

    const confidence = calculateConfidence(documents, response.content, query);

    return {
      ...response,
      confidence,
    };
  },

  /**
   * Select best model based on query complexity
   */
  selectModel(query: string, documentCount: number): LLMModel {
    const isComplex =
      query.length > 200 ||
      documentCount > 5 ||
      /의료|수술|합병증|부작용/.test(query);

    // Use Claude for complex medical queries
    if (isComplex) {
      return "claude-3-sonnet";
    }

    // Use GPT-4 for general queries
    return "gpt-4";
  },

  /**
   * Generate AI suggestion for agent
   */
  async generateSuggestion(
    query: string,
    documents: RetrievedDocument[],
    conversationHistory: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    const context = buildContext(documents);

    const historyText = conversationHistory
      .slice(-6) // Last 3 exchanges
      .map((m) => `${m.role === "user" ? "고객" : "상담사"}: ${m.content}`)
      .join("\n");

    const prompt = `다음 대화 맥락과 고객의 마지막 메시지를 보고, 상담사가 사용할 수 있는 답변을 제안해주세요.

## 대화 기록
${historyText}

## 고객 메시지
${query}

## 참고 자료
${context}

상담사가 바로 사용할 수 있는 자연스러운 답변을 한국어로 작성해주세요:`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "";
  },
};
