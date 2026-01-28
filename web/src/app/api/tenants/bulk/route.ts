import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parse } from "csv-parse/sync";

export const dynamic = "force-dynamic";

interface TenantCSVRecord {
  name: string;
  name_en: string;
  specialty: string;
  default_language: string;
  system_prompt: string;
  model: string;
  confidence_threshold: string;
  escalation_keywords: string;
}

/**
 * GET /api/tenants/bulk
 * 거래처 CSV 템플릿 다운로드
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    const { data: tenants, error } = await (supabase as any)
      .from("tenants")
      .select("name, name_en, specialty, ai_config")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // CSV 생성
    const rows = [
      [
        "name",
        "name_en",
        "specialty",
        "default_language",
        "system_prompt",
        "model",
        "confidence_threshold",
        "escalation_keywords",
      ], // 헤더
    ];

    (tenants || []).forEach((tenant: any) => {
      const aiConfig = tenant.ai_config || {};
      rows.push([
        tenant.name || "",
        tenant.name_en || "",
        tenant.specialty || "",
        aiConfig.default_language || "ko",
        aiConfig.system_prompt || "",
        aiConfig.model || "gpt-4",
        String(aiConfig.confidence_threshold || "0.75"),
        (aiConfig.escalation_keywords || []).join(","),
      ]);
    });

    const csvContent = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tenants-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/tenants/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/tenants/bulk
 * 거래처 CSV 일괄 업로드
 * Body (multipart/form-data):
 *   - file: CSV 파일
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const csvContent = await file.text();
    const supabase = await createServiceClient();

    // CSV 파싱
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as TenantCSVRecord[];

    console.log(`📊 총 ${records.length}개 레코드 발견`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const tenantData = {
          name: record.name,
          name_en: record.name_en || record.name,
          specialty: record.specialty || null,
          ai_config: {
            enabled: true,
            system_prompt: record.system_prompt || "",
            model: record.model || "gpt-4",
            confidence_threshold: parseFloat(record.confidence_threshold || "0.75"),
            escalation_keywords: record.escalation_keywords
              ? record.escalation_keywords.split(",").map((k: string) => k.trim())
              : [],
            default_language: record.default_language || "ko",
          },
          settings: {},
        };

        const { error } = await (supabase as any).from("tenants").insert(tenantData);

        if (error) {
          errorCount++;
          errors.push(`${record.name}: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (err: any) {
        errorCount++;
        errors.push(`${record.name}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("POST /api/tenants/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
