import { NextRequest, NextResponse } from "next/server";
import { competitorAnalysisService } from "@/services/competitor-analysis";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/competitor-analysis - 경쟁사 목록 및 분석 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const category = searchParams.get("category");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // 경쟁사 목록 조회
    const { data: competitors, error } = await supabase
      .from("competitors")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq(category ? "category" : "id", category || undefined)
      .order("name");

    if (error) {
      throw error;
    }

    return NextResponse.json({ competitors: competitors || [] });
  } catch (error) {
    console.error("Competitor fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitors" },
      { status: 500 }
    );
  }
}

// POST /api/competitor-analysis - 경쟁사 분석 실행
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, procedure, ourPrice } = body;

    if (!tenantId || !procedure || !ourPrice) {
      return NextResponse.json(
        { error: "tenantId, procedure, and ourPrice are required" },
        { status: 400 }
      );
    }

    // 가격 비교 분석
    const comparison = await competitorAnalysisService.comparePrices(
      tenantId,
      procedure,
      ourPrice
    );

    // AI 인사이트 생성
    const insights = await competitorAnalysisService.generateInsights([comparison]);

    return NextResponse.json({
      success: true,
      comparison,
      insights,
    });
  } catch (error) {
    console.error("Competitor analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze competitors" },
      { status: 500 }
    );
  }
}
