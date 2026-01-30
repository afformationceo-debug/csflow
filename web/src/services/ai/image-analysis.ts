/**
 * Image Analysis Service
 * Uses GPT-4 Vision for image analysis and medical image consultation
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

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

export interface ImageAnalysisResult {
  description: string;
  category: ImageCategory;
  tags: string[];
  medicalRelevance?: MedicalImageAnalysis;
  suggestedResponse?: string;
  confidence: number;
  detectedLanguage?: string;
}

export type ImageCategory =
  | "medical_before_after"
  | "medical_document"
  | "medical_symptom"
  | "general_inquiry"
  | "receipt_document"
  | "id_document"
  | "other";

export interface MedicalImageAnalysis {
  type:
    | "before_after"
    | "symptom_photo"
    | "medical_record"
    | "x_ray"
    | "scan"
    | "other";
  bodyPart?: string;
  procedure?: string;
  observations: string[];
  recommendations: string[];
  requiresExpertReview: boolean;
}

export interface ImageAnalysisOptions {
  tenantId?: string;
  context?: string; // Previous conversation context
  language?: string; // Response language
  analyzeForMedical?: boolean;
  maxTokens?: number;
}

/**
 * Analyze image using GPT-4 Vision
 */
export async function analyzeImage(
  imageUrl: string,
  options: ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult> {
  const {
    context,
    language = "ko",
    analyzeForMedical = true,
    maxTokens = 1000,
  } = options;

  const systemPrompt = buildSystemPrompt(language, analyzeForMedical);
  const userPrompt = buildUserPrompt(context, analyzeForMedical);

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from GPT-4 Vision");
    }

    const analysis = JSON.parse(content) as ImageAnalysisResult;
    return {
      ...analysis,
      confidence: calculateConfidence(response),
    };
  } catch (error) {
    console.error("Image analysis error:", error);
    throw new Error(`Failed to analyze image: ${error}`);
  }
}

/**
 * Analyze image from base64 data
 */
export async function analyzeImageBase64(
  base64Data: string,
  mimeType: string = "image/jpeg",
  options: ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult> {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return analyzeImage(dataUrl, options);
}

/**
 * Analyze multiple images (e.g., before/after comparison)
 */
export async function analyzeMultipleImages(
  imageUrls: string[],
  options: ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult> {
  const {
    context,
    language = "ko",
    analyzeForMedical = true,
    maxTokens = 1500,
  } = options;

  const systemPrompt = buildSystemPrompt(language, analyzeForMedical);
  const userPrompt = `
${context ? `이전 대화 맥락: ${context}\n\n` : ""}
다음 ${imageUrls.length}개의 이미지를 분석해주세요. 전후 비교 사진인 경우 변화를 설명해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "description": "이미지 종합 설명",
  "category": "카테고리",
  "tags": ["태그1", "태그2"],
  "medicalRelevance": {
    "type": "before_after 또는 다른 유형",
    "bodyPart": "신체 부위",
    "procedure": "관련 시술/수술",
    "observations": ["관찰 사항"],
    "recommendations": ["권장 사항"],
    "requiresExpertReview": true/false
  },
  "suggestedResponse": "고객에게 제안할 응답"
}`;

  const imageContents: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: userPrompt },
    ...imageUrls.map(
      (url) =>
        ({
          type: "image_url",
          image_url: { url, detail: "high" },
        }) as OpenAI.Chat.Completions.ChatCompletionContentPart
    ),
  ];

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: imageContents },
      ],
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from GPT-4 Vision");
    }

    const analysis = JSON.parse(content) as ImageAnalysisResult;
    return {
      ...analysis,
      confidence: calculateConfidence(response),
    };
  } catch (error) {
    console.error("Multiple image analysis error:", error);
    throw new Error(`Failed to analyze images: ${error}`);
  }
}

/**
 * Process image message and store analysis
 */
export async function processImageForConversation(
  conversationId: string,
  imageUrl: string,
  options: ImageAnalysisOptions = {}
): Promise<{
  analysis: ImageAnalysisResult;
  messageId: string;
}> {
  const supabase = await createServiceClient();

  // Analyze the image
  const analysis = await analyzeImage(imageUrl, options);

  // Store the analysis as a message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: message, error } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "customer",
      content_type: "image",
      content: analysis.description,
      media_url: imageUrl,
      metadata: {
        image_analysis: {
          category: analysis.category,
          tags: analysis.tags,
          medical_relevance: analysis.medicalRelevance,
          confidence: analysis.confidence,
        },
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store image analysis: ${error.message}`);
  }

  return {
    analysis,
    messageId: message.id,
  };
}

/**
 * Analyze document image (receipt, ID, medical document)
 */
export async function analyzeDocument(
  imageUrl: string,
  documentType: "receipt" | "id" | "medical_record" | "general",
  language: string = "ko"
): Promise<{
  extractedText: string;
  structuredData: Record<string, string>;
  documentType: string;
  confidence: number;
}> {
  const prompts: Record<string, string> = {
    receipt: `이 영수증/청구서를 분석해주세요. 날짜, 금액, 항목을 추출해주세요.`,
    id: `이 신분증을 분석해주세요. 이름, 생년월일 등 기본 정보만 추출해주세요. (민감정보 보호)`,
    medical_record: `이 의료 기록/서류를 분석해주세요. 진단명, 날짜, 병원명 등을 추출해주세요.`,
    general: `이 문서를 분석하고 주요 정보를 추출해주세요.`,
  };

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `당신은 문서 분석 전문가입니다. ${language === "ko" ? "한국어" : "English"}로 응답해주세요. JSON 형식으로만 응답하세요.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${prompts[documentType]}

JSON 형식으로 응답:
{
  "extractedText": "문서의 전체 텍스트",
  "structuredData": {
    "key1": "value1",
    "key2": "value2"
  },
  "documentType": "문서 유형"
}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from GPT-4 Vision");
    }

    const result = JSON.parse(content);
    return {
      ...result,
      confidence: calculateConfidence(response),
    };
  } catch (error) {
    console.error("Document analysis error:", error);
    throw new Error(`Failed to analyze document: ${error}`);
  }
}

// Helper functions

function buildSystemPrompt(language: string, analyzeForMedical: boolean): string {
  const langName = language === "ko" ? "한국어" : language === "ja" ? "일본어" : "영어";

  if (analyzeForMedical) {
    return `당신은 의료 관광 CS 플랫폼의 이미지 분석 어시스턴트입니다.
${langName}로 응답해주세요.

역할:
- 고객이 보낸 이미지를 분석하고 적절한 정보를 제공
- 의료 관련 이미지(시술 전후 사진, 증상 사진 등)를 전문적으로 분석
- 민감한 의료 정보에 대해서는 전문가 상담을 권장

주의사항:
- 직접적인 의료 진단이나 처방을 하지 않음
- 개인정보가 포함된 이미지는 민감하게 처리
- 심각한 증상이 의심되면 즉시 전문가 상담 권장

응답은 반드시 JSON 형식으로 해주세요.`;
  }

  return `당신은 CS 플랫폼의 이미지 분석 어시스턴트입니다. ${langName}로 응답해주세요.
응답은 반드시 JSON 형식으로 해주세요.`;
}

function buildUserPrompt(context?: string, analyzeForMedical?: boolean): string {
  const medicalInstructions = analyzeForMedical
    ? `
의료 관련 이미지인 경우:
- 신체 부위 식별
- 관련 시술/수술 추정
- 관찰 사항 나열
- 전문가 상담 필요 여부 판단`
    : "";

  return `
${context ? `이전 대화 맥락: ${context}\n\n` : ""}
이 이미지를 분석해주세요.
${medicalInstructions}

다음 JSON 형식으로 응답해주세요:
{
  "description": "이미지에 대한 상세 설명",
  "category": "medical_before_after | medical_document | medical_symptom | general_inquiry | receipt_document | id_document | other",
  "tags": ["관련 태그 배열"],
  "medicalRelevance": {
    "type": "before_after | symptom_photo | medical_record | x_ray | scan | other",
    "bodyPart": "관련 신체 부위 (해당시)",
    "procedure": "관련 시술명 (해당시)",
    "observations": ["관찰 사항 배열"],
    "recommendations": ["권장 사항 배열"],
    "requiresExpertReview": true/false
  },
  "suggestedResponse": "고객에게 제안할 응답 메시지"
}`;
}

function calculateConfidence(
  response: OpenAI.Chat.Completions.ChatCompletion
): number {
  // GPT-4 Vision doesn't provide logprobs, so we estimate based on finish reason
  const finishReason = response.choices[0]?.finish_reason;
  if (finishReason === "stop") return 0.9;
  if (finishReason === "length") return 0.7;
  return 0.5;
}

export const imageAnalysisService = {
  analyzeImage,
  analyzeImageBase64,
  analyzeMultipleImages,
  processImageForConversation,
  analyzeDocument,
};
