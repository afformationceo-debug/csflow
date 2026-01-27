import { NextRequest, NextResponse } from "next/server";
import { competitorAnalysisService } from "@/services/competitor-analysis";

// POST /api/competitor-analysis/report - 경쟁사 분석 리포트 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, procedures, ourPrices, format = "json" } = body;

    if (!tenantId || !procedures?.length || !ourPrices) {
      return NextResponse.json(
        { error: "tenantId, procedures, and ourPrices are required" },
        { status: 400 }
      );
    }

    // 전체 리포트 생성
    const report = await competitorAnalysisService.generateReport(
      tenantId,
      procedures,
      ourPrices
    );

    if (format === "csv") {
      // CSV 형식으로 변환
      const competitorNames = report.competitors.map(c => c.name);
      const headers = ["Procedure", ...competitorNames, "Our Min", "Our Max", "Market Avg", "Position"];
      const rows = report.priceComparisons.map((comp) => [
        comp.procedure,
        ...comp.competitorPrices.map(cp => `${cp.min}-${cp.max} ${cp.currency}`),
        comp.ourPrice.min,
        comp.ourPrice.max,
        comp.marketAverage,
        comp.ourPosition,
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="competitor-report-${tenantId}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
