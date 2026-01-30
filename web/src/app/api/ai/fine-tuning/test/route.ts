import { NextRequest, NextResponse } from "next/server";
import { fineTuningService } from "@/services/ai";

// Force dynamic rendering (opt out of static optimization)
export const dynamic = 'force-dynamic';

// POST /api/ai/fine-tuning/test - Fine-tuned 모델 테스트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, testQuery, systemPrompt } = body;

    if (!modelId || !testQuery) {
      return NextResponse.json(
        { error: "modelId and testQuery are required" },
        { status: 400 }
      );
    }

    // 모델 테스트 실행
    const result = await fineTuningService.testFineTunedModel(
      modelId,
      testQuery,
      systemPrompt
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Fine-tuning test error:", error);
    return NextResponse.json(
      { error: "Failed to test fine-tuned model" },
      { status: 500 }
    );
  }
}
