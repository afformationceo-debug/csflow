/**
 * Fine-tuning Pipeline Service
 * 의료 도메인 특화 모델 학습을 위한 데이터 수집 및 관리
 */

import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

// Types
export interface TrainingExample {
  id: string;
  tenantId: string;
  conversationId: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  category: string;
  quality_score: number;
  is_validated: boolean;
  created_at: string;
}

export interface FineTuningJob {
  id: string;
  tenantId: string;
  openai_job_id?: string;
  model_base: string;
  model_suffix: string;
  status: "preparing" | "pending" | "running" | "succeeded" | "failed" | "cancelled";
  training_file_id?: string;
  validation_file_id?: string;
  trained_tokens?: number;
  error_message?: string;
  result_model?: string;
  created_at: string;
  finished_at?: string;
}

export interface TrainingDataStats {
  totalExamples: number;
  validatedExamples: number;
  byCategory: Record<string, number>;
  byQualityScore: Record<number, number>;
  avgQualityScore: number;
}

class FineTuningService {
  private openai: OpenAI | null = null;

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * 에스컬레이션에서 학습 데이터 수집
   */
  async collectTrainingData(
    tenantId: string,
    options: {
      minQualityScore?: number;
      categories?: string[];
      limit?: number;
    } = {}
  ): Promise<TrainingExample[]> {
    const supabase = await createServiceClient();
    const { minQualityScore = 4, categories, limit = 1000 } = options;

    // 해결된 에스컬레이션에서 대화 수집
    let query = supabase
      .from("escalations")
      .select(`
        id,
        conversation_id,
        reason,
        resolution_notes,
        conversations (
          id,
          messages (
            id,
            sender_type,
            content,
            created_at
          )
        ),
        learning_data (
          id,
          quality_score,
          category,
          is_processed
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "resolved")
      .not("resolution_notes", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(limit);

    const { data: escalations, error } = await query;

    if (error) {
      throw new Error(`Failed to collect training data: ${error.message}`);
    }

    const trainingExamples: TrainingExample[] = [];

    for (const escalation of escalations || []) {
      const conversation = escalation.conversations;
      const learningData = escalation.learning_data?.[0];

      if (!conversation?.messages?.length) continue;

      // 품질 점수 필터
      if (learningData?.quality_score && learningData.quality_score < minQualityScore) {
        continue;
      }

      // 카테고리 필터
      if (categories && learningData?.category && !categories.includes(learningData.category)) {
        continue;
      }

      // 메시지를 OpenAI 형식으로 변환
      const messages: TrainingExample["messages"] = [
        {
          role: "system",
          content: `당신은 ${tenantId} 병원의 의료 상담 AI 어시스턴트입니다.
환자의 질문에 정확하고 친절하게 답변하세요.
의료 정보는 일반적인 안내만 제공하고, 정확한 진단이나 처방은 의사 상담을 권유하세요.`,
        },
      ];

      // 메시지 순서대로 정렬
      const sortedMessages = [...conversation.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      for (const msg of sortedMessages) {
        if (msg.sender_type === "customer") {
          messages.push({ role: "user", content: msg.content || "" });
        } else if (msg.sender_type === "agent" || msg.sender_type === "ai") {
          messages.push({ role: "assistant", content: msg.content || "" });
        }
      }

      // 최소 1개의 user와 assistant 메시지가 있어야 함
      const hasUser = messages.some((m) => m.role === "user");
      const hasAssistant = messages.some((m) => m.role === "assistant");

      if (hasUser && hasAssistant) {
        trainingExamples.push({
          id: escalation.id,
          tenantId,
          conversationId: escalation.conversation_id,
          messages,
          category: learningData?.category || "general",
          quality_score: learningData?.quality_score || 3,
          is_validated: learningData?.is_processed || false,
          created_at: new Date().toISOString(),
        });
      }
    }

    return trainingExamples;
  }

  /**
   * 학습 데이터 통계 조회
   */
  async getTrainingDataStats(tenantId: string): Promise<TrainingDataStats> {
    const supabase = await createServiceClient();

    const { data: learningData, error } = await supabase
      .from("learning_data")
      .select("id, category, quality_score, is_processed")
      .eq("is_processed", false);

    if (error) {
      throw new Error(`Failed to get training stats: ${error.message}`);
    }

    const stats: TrainingDataStats = {
      totalExamples: learningData?.length || 0,
      validatedExamples: 0,
      byCategory: {},
      byQualityScore: {},
      avgQualityScore: 0,
    };

    let totalScore = 0;

    for (const item of learningData || []) {
      // 카테고리별 집계
      const category = item.category || "uncategorized";
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // 품질 점수별 집계
      const score = item.quality_score || 0;
      stats.byQualityScore[score] = (stats.byQualityScore[score] || 0) + 1;
      totalScore += score;
    }

    stats.avgQualityScore = stats.totalExamples > 0 ? totalScore / stats.totalExamples : 0;

    return stats;
  }

  /**
   * 학습 데이터 검증 및 승인
   */
  async validateTrainingExample(
    exampleId: string,
    options: {
      is_validated: boolean;
      quality_score?: number;
      category?: string;
      corrected_response?: string;
    }
  ): Promise<void> {
    const supabase = await createServiceClient();

    const updateData: Record<string, unknown> = {
      is_processed: options.is_validated,
    };

    if (options.quality_score !== undefined) {
      updateData.quality_score = options.quality_score;
    }

    if (options.category) {
      updateData.category = options.category;
    }

    if (options.corrected_response) {
      updateData.answer = options.corrected_response;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("learning_data")
      .update(updateData)
      .eq("escalation_id", exampleId);

    if (error) {
      throw new Error(`Failed to validate training example: ${error.message}`);
    }
  }

  /**
   * JSONL 파일 생성 (OpenAI Fine-tuning 형식)
   */
  async generateTrainingFile(
    tenantId: string,
    options: {
      minQualityScore?: number;
      validatedOnly?: boolean;
    } = {}
  ): Promise<{ content: string; count: number }> {
    const examples = await this.collectTrainingData(tenantId, {
      minQualityScore: options.minQualityScore || 4,
    });

    const filteredExamples = options.validatedOnly
      ? examples.filter((e) => e.is_validated)
      : examples;

    const jsonlLines = filteredExamples.map((example) => {
      return JSON.stringify({ messages: example.messages });
    });

    return {
      content: jsonlLines.join("\n"),
      count: jsonlLines.length,
    };
  }

  /**
   * Fine-tuning 작업 시작
   */
  async startFineTuning(
    tenantId: string,
    options: {
      baseModel?: string;
      suffix?: string;
      validationSplit?: number;
    } = {}
  ): Promise<FineTuningJob> {
    const openai = this.getOpenAI();
    const supabase = await createServiceClient();
    const { baseModel = "gpt-4o-mini-2024-07-18", suffix, validationSplit = 0.1 } = options;

    // 학습 데이터 생성
    const { content, count } = await this.generateTrainingFile(tenantId, {
      minQualityScore: 4,
      validatedOnly: true,
    });

    if (count < 10) {
      throw new Error(`Not enough training examples. Minimum 10 required, got ${count}`);
    }

    // JSONL 파일을 Blob으로 변환
    const trainingBlob = new Blob([content], { type: "application/jsonl" });
    const trainingFile = new File([trainingBlob], "training.jsonl");

    // OpenAI에 파일 업로드
    const uploadedFile = await openai.files.create({
      file: trainingFile,
      purpose: "fine-tune",
    });

    // Fine-tuning 작업 생성
    const fineTuneJob = await openai.fineTuning.jobs.create({
      training_file: uploadedFile.id,
      model: baseModel,
      suffix: suffix || `${tenantId}-medical`,
    });

    // DB에 작업 기록
    const job: FineTuningJob = {
      id: crypto.randomUUID(),
      tenantId,
      openai_job_id: fineTuneJob.id,
      model_base: baseModel,
      model_suffix: suffix || `${tenantId}-medical`,
      status: "pending",
      training_file_id: uploadedFile.id,
      created_at: new Date().toISOString(),
    };

    // 실제 DB 저장 (fine_tuning_jobs 테이블이 있다면)
    // await supabase.from("fine_tuning_jobs").insert(job);

    return job;
  }

  /**
   * Fine-tuning 작업 상태 확인
   */
  async checkFineTuningStatus(jobId: string): Promise<FineTuningJob | null> {
    const openai = this.getOpenAI();

    try {
      const job = await openai.fineTuning.jobs.retrieve(jobId);

      return {
        id: job.id,
        tenantId: "",
        openai_job_id: job.id,
        model_base: job.model,
        model_suffix: job.fine_tuned_model?.split(":").pop() || "",
        status: job.status as FineTuningJob["status"],
        training_file_id: job.training_file,
        validation_file_id: job.validation_file || undefined,
        trained_tokens: job.trained_tokens || undefined,
        error_message: job.error?.message,
        result_model: job.fine_tuned_model || undefined,
        created_at: new Date(job.created_at * 1000).toISOString(),
        finished_at: job.finished_at
          ? new Date(job.finished_at * 1000).toISOString()
          : undefined,
      };
    } catch (error) {
      console.error("Failed to check fine-tuning status:", error);
      return null;
    }
  }

  /**
   * Fine-tuned 모델로 테스트
   */
  async testFineTunedModel(
    modelId: string,
    testQuery: string,
    systemPrompt?: string
  ): Promise<{
    response: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  }> {
    const openai = this.getOpenAI();

    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "system",
          content:
            systemPrompt ||
            "당신은 친절한 의료 상담 AI입니다. 환자의 질문에 정확하고 이해하기 쉽게 답변하세요.",
        },
        { role: "user", content: testQuery },
      ],
      max_tokens: 500,
    });

    return {
      response: completion.choices[0]?.message?.content || "",
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
      },
    };
  }

  /**
   * A/B 테스트 설정
   */
  async setupABTest(
    tenantId: string,
    options: {
      baseModel: string;
      fineTunedModel: string;
      trafficSplit: number; // 0-1, fine-tuned 모델로 가는 비율
      testDurationHours: number;
    }
  ): Promise<{
    testId: string;
    config: {
      baseModel: string;
      fineTunedModel: string;
      trafficSplit: number;
      startTime: string;
      endTime: string;
    };
  }> {
    const testId = crypto.randomUUID();
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + options.testDurationHours * 60 * 60 * 1000);

    const config = {
      baseModel: options.baseModel,
      fineTunedModel: options.fineTunedModel,
      trafficSplit: options.trafficSplit,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    // 실제 구현에서는 Redis 또는 DB에 저장
    // await redis.set(`ab_test:${tenantId}:${testId}`, JSON.stringify(config));

    return { testId, config };
  }
}

export const fineTuningService = new FineTuningService();
