import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SPECIALTY_FILENAMES: Record<string, string> = {
  ophthalmology: "지식베이스_안과_템플릿.csv",
  dentistry: "지식베이스_치과_템플릿.csv",
  plastic_surgery: "지식베이스_성형외과_템플릿.csv",
  dermatology: "지식베이스_피부과_템플릿.csv",
  general: "지식베이스_일반_템플릿.csv",
};

/**
 * GET /api/knowledge/template
 * 진료과별 지식베이스 템플릿 CSV 다운로드 (실제 Supabase 데이터 기반)
 * Query params:
 *   - specialty: ophthalmology | dentistry | plastic_surgery | dermatology | general
 *   - tenant_id: (optional) 특정 거래처의 지식베이스만 추출
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get("specialty");
    const tenantId = searchParams.get("tenant_id");

    if (!specialty) {
      return NextResponse.json(
        { error: "specialty 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    const filename = SPECIALTY_FILENAMES[specialty];

    if (!filename) {
      return NextResponse.json(
        { error: "지원하지 않는 진료과입니다" },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 지식베이스 문서 조회
    let query = supabase
      .from("knowledge_documents")
      .select("category, title, content")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });

    // tenant_id가 제공되면 해당 거래처만
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: "해당 조건의 지식베이스 문서가 없습니다" },
        { status: 404 }
      );
    }

    // CSV 생성
    const csvContent = convertToCSV(documents);

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/knowledge/template error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Convert knowledge documents to CSV format
 */
function convertToCSV(documents: Array<{ category: string | null; title: string; content: string }>): string {
  const headers = ["카테고리", "질문", "답변"];
  const rows = documents.map((doc) => [
    `"${(doc.category || "일반").replace(/"/g, '""')}"`,
    `"${doc.title.replace(/"/g, '""')}"`,
    `"${doc.content.replace(/"/g, '""')}"`,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
