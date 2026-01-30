import { NextRequest, NextResponse } from "next/server";
import { fineTuningService } from "@/services/ai";
import OpenAI from "openai";

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

// Force dynamic rendering (opt out of static optimization)
export const dynamic = 'force-dynamic';

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
    const client = getOpenAIClient();
    const cancelled = await client.fineTuning.jobs.cancel(jobId);

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
