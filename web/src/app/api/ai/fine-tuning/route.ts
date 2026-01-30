import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fineTuningService } from "@/services/ai/fine-tuning";

// Force dynamic rendering (opt out of static optimization)
export const dynamic = 'force-dynamic';

// GET /api/ai/fine-tuning - 학습 작업 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");

    const { data: jobs, error } = await supabase
      .from("fine_tuning_jobs")
      .select("*")
      .eq(tenantId ? "tenant_id" : "id", tenantId || undefined)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error) {
    console.error("Fine-tuning jobs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fine-tuning jobs" },
      { status: 500 }
    );
  }
}

// POST /api/ai/fine-tuning - 새 학습 작업 시작
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, minQuality = 4, maxSamples = 500 } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // 1. 학습 데이터 수집
    const trainingData = await fineTuningService.collectTrainingData(
      tenantId,
      {
        minQualityScore: minQuality,
        limit: maxSamples
      }
    );

    if (trainingData.length < 10) {
      return NextResponse.json(
        {
          error: "Insufficient training data",
          message: `Need at least 10 samples, found ${trainingData.length}`,
        },
        { status: 400 }
      );
    }

    // 2. Fine-tuning 작업 시작
    const job = await fineTuningService.startFineTuning(tenantId);

    return NextResponse.json({
      success: true,
      job,
      dataCount: trainingData.length,
    });
  } catch (error) {
    console.error("Fine-tuning start error:", error);
    return NextResponse.json(
      { error: "Failed to start fine-tuning" },
      { status: 500 }
    );
  }
}
