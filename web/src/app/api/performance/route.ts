import { NextRequest, NextResponse } from "next/server";
import { performanceService } from "@/services/performance-optimization";

// GET /api/performance - 성능 메트릭 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    const period = searchParams.get("period") || "1h";

    // 대시보드 데이터 조회
    const dashboard = await performanceService.getPerformanceDashboard();

    // 최적화 권장사항 생성
    const recommendations = await performanceService.getOptimizationRecommendations();

    return NextResponse.json({
      dashboard,
      recommendations,
      endpoint: endpoint || "all",
      period,
    });
  } catch (error) {
    console.error("Performance metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance metrics" },
      { status: 500 }
    );
  }
}

// POST /api/performance/optimize - 최적화 작업 실행
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    let result;

    switch (action) {
      case "clear-cache":
        // 캐시 삭제 (패턴 기반)
        if (params?.pattern) {
          const count = await performanceService.cacheDeletePattern(params.pattern);
          result = { deleted: count };
        } else {
          result = { error: "pattern is required" };
        }
        break;
      case "analyze-queries":
        result = await performanceService.analyzeSlowQueries();
        break;
      case "get-recommendations":
        result = await performanceService.getOptimizationRecommendations();
        break;
      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
    });
  } catch (error) {
    console.error("Optimization error:", error);
    return NextResponse.json(
      { error: "Failed to execute optimization" },
      { status: 500 }
    );
  }
}
