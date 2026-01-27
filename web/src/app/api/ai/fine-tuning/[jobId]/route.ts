import { NextRequest, NextResponse } from "next/server";
import { fineTuningService } from "@/services/ai";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET /api/ai/fine-tuning/[jobId] - 학습 작업 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = await fineTuningService.checkFineTuningStatus(jobId);

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Fine-tuning job status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/fine-tuning/[jobId] - 학습 작업 취소
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // OpenAI API로 직접 취소
    const cancelled = await openai.fineTuning.jobs.cancel(jobId);

    return NextResponse.json({
      success: true,
      job: cancelled
    });
  } catch (error) {
    console.error("Fine-tuning job cancel error:", error);
    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}
