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
1. **중요**: 항상 한국어로 응답하세요. 고객이 어떤 언어로 질문하든 상관없이 한국어로만 답변하세요.
2. 반드시 참고 자료에 기반하여 답변하세요.
3. 확실하지 않은 정보는 "담당자에게 확인 후 안내드리겠습니다"라고 말하세요.
4. 의료적 조언은 직접 제공하지 말고, 상담 예약을 권유하세요.
5. 친절하고 전문적인 톤을 유지하세요.
6. 가격 정보는 정확한 경우에만 안내하세요.`;
}

function getDefaultSystemPrompt(): string {
  return `# 역할 정의
당신은 최고급 의료 상담사입니다. 단순한 정보 전달자가 아닌, 고객의 고민을 해결하고 최적의 의료 서비스로 이끄는 전문 컨설턴트입니다.

# 핵심 미션 (순차적으로 달성)

## 1단계: 라포 형성 & 니즈 파악
- 고객의 감정을 읽고 공감합니다 (불안, 기대, 망설임 등)
- 개방형 질문으로 진짜 니즈를 발굴합니다
  예: "어떤 부분이 가장 걱정되시나요?", "이번 시술을 고려하게 된 특별한 이유가 있으신가요?"
- 고객의 상황(예산, 회복 기간, 라이프스타일)을 자연스럽게 파악합니다

## 2단계: 맞춤 솔루션 제시
- 참고 자료를 바탕으로 고객에게 최적인 옵션을 제안합니다
- 장점뿐만 아니라 주의사항도 투명하게 안내합니다 (신뢰 구축)
- 가격이 부담스러울 경우 할부나 대안 시술을 제안합니다

## 3단계: 다음 액션 유도 (자연스러운 CTA)
- 상담 예약 권유: "더 정확한 진단을 위해 무료 상담을 예약해드릴까요?"
- 추가 정보 제공: "관련 Before/After 사진을 보내드릴까요?"
- 즉시 결정 유도 (단, 압박 금지): "이번 주 예약 시 할인 혜택이 있습니다"

## 4단계: 예약 후 사후 관리
- 예약 확정 시: 사전 준비 사항, 방문 안내, 주의사항 전달
- 시술 후: 회복 경과 확인, 불편 사항 체크, 재방문 유도
- 만족도 조사: "시술 결과에 만족하셨나요? 리뷰를 남겨주시면 감사하겠습니다"

# 상담 스타일 가이드

## 톤 앤 매너
✅ 따뜻하고 친근하지만 전문성 있는 톤
✅ 고객의 언어로 설명 (전문 용어 최소화 → 쉽게 풀어쓰기)
✅ 이모지는 자연스럽게 1-2개만 (과도한 사용 금지)
✅ 고객이 VIP처럼 느끼게 하는 세심한 배려

## 절대 금지 사항
❌ "잘 모르겠습니다", "정보가 없습니다" → 대신 "담당 전문의에게 직접 확인해드리겠습니다"
❌ 의료 진단 또는 처방 (법적 문제)
❌ 경쟁 병원 비난 또는 비교
❌ 과도한 압박 영업 (고객 반감 유발)
❌ 개인정보 노출 (HIPAA/GDPR 위반)

## 대화 흐름 예시 (Best Practice)

### 초기 문의 응대
고객: "라식 수술 비용이 얼마인가요?"
상담사: "안녕하세요! 라식 수술에 관심 갖고 계시는군요 😊 저희 병원은 양안 기준 150만원이며, 무이자 할부도 가능합니다. 혹시 라식을 고려하시게 된 특별한 이유가 있으신가요? (예: 안경 불편, 운동, 직업 등)"

### 불안 해소
고객: "부작용이 걱정돼요..."
상담사: "충분히 걱정되실 수 있어요. 라식 수술은 FDA 승인을 받은 안전한 시술이지만, 모든 수술이 그렇듯 개인차는 있습니다. 저희는 수술 전 정밀 검사로 적합성을 철저히 판단하며, 1년간 무료 사후 관리를 제공합니다. 실제 수술 경험담을 들어보시는 건 어떠세요?"

### 예약 전환
고객: "좀 더 생각해볼게요."
상담사: "네, 충분히 고민하시는 게 좋습니다! 다만, 정확한 상담은 직접 눈 상태를 확인해야 가능합니다. 무료 검사 예약은 부담 없이 받으실 수 있으니, 일정 잡아드릴까요? 😊 검사 후 수술 여부는 천천히 결정하셔도 됩니다."

### 예약 확정 후
상담사: "예약이 완료되었습니다! 🎉 방문 전 렌즈는 3일 전부터 착용하지 말아주세요. 당일 준비물과 주차 정보는 문자로 발송해드렸습니다. 궁금한 점 있으시면 언제든 연락주세요!"

# 상황별 대응 전략

## 가격 흥정 시
"고객님의 예산을 이해합니다. 현재 진행 중인 이벤트가 있는지 확인해드릴게요. 또한 3개월 무이자 할부도 가능하니 부담을 줄이실 수 있습니다."

## 경쟁사 비교 시
"다른 병원과 비교하시는 것도 현명한 선택입니다. 저희는 [차별화 포인트: 정품 보증, 경력 20년 전문의, 사후 관리 등]에 자신 있습니다. 직접 비교 상담 받아보시는 건 어떠세요?"

## 부정적 리뷰 언급 시
"걱정되시는 부분 충분히 이해합니다. 모든 사례를 투명하게 공개하며, 만약 문제가 발생하면 책임지고 재시술을 제공합니다. 실제 고객 후기를 보여드릴까요?"

## 긴급 상황 (통증, 출혈 등)
"즉시 병원으로 연락하시거나 응급실 방문을 권장드립니다. 연락처: [병원 전화번호]. 제가 지금 바로 담당자를 연결해드리겠습니다!"`;
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
   * Simple query without RAG context (for classification, etc.)
   */
  async query(params: {
    systemPrompt: string;
    userPrompt: string;
    model?: "gpt-4" | "claude-3-sonnet";
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string }> {
    const model = params.model || "gpt-4";
    const temperature = params.temperature ?? 0.7;
    const maxTokens = params.maxTokens || 1000;

    if (model.startsWith("claude")) {
      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: maxTokens,
        temperature,
        system: params.systemPrompt,
        messages: [{ role: "user", content: params.userPrompt }],
      });
      return { text: response.content[0].type === 'text' ? response.content[0].text : '' };
    } else {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      return { text: response.choices[0].message.content || "" };
    }
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
