import { NextRequest, NextResponse } from "next/server";
import {
  KNOWLEDGE_TEMPLATES,
  TEMPLATE_FILENAMES,
  convertToCSV,
} from "@/data/knowledge-templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/template
 * 진료과별 지식베이스 템플릿 CSV 다운로드
 * Query params:
 *   - specialty: ophthalmology | dentistry | plastic_surgery | dermatology | general
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get("specialty");

    if (!specialty) {
      return NextResponse.json(
        { error: "specialty 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    const templates = KNOWLEDGE_TEMPLATES[specialty];
    const filename = TEMPLATE_FILENAMES[specialty];

    if (!templates || !filename) {
      return NextResponse.json(
        { error: "지원하지 않는 진료과입니다" },
        { status: 400 }
      );
    }

    // CSV 생성
    const csvContent = convertToCSV(templates);

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/knowledge/template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
      );
  }
}
