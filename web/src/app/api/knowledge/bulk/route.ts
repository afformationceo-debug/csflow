import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

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

interface KnowledgeCSVRecord {
  tenant_name: string;
  title: string;
  content: string;
  category: string;
  tags: string;
}

/**
 * GET /api/knowledge/bulk
 * 지식베이스 CSV 템플릿 다운로드
 * Query params:
 *   - tenantId: 거래처 ID (선택, 없으면 모든 거래처의 문서)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    const supabase = await createServiceClient();

    let query = (supabase as any)
      .from("knowledge_documents")
      .select("tenant_id, tenants(name), title, content, category, tags");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: documents, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // CSV 생성
    const rows = [
      ["tenant_name", "title", "content", "category", "tags"], // 헤더
    ];

    (documents || []).forEach((doc: any) => {
      rows.push([
        doc.tenants?.name || "",
        doc.title || "",
        doc.content || "",
        doc.category || "",
        (doc.tags || []).join(","),
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
        "Content-Disposition": `attachment; filename="knowledge-${tenantId || "all"}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/knowledge/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/knowledge/bulk
 * 지식베이스 CSV 일괄 업로드
 * Body (multipart/form-data):
 *   - file: CSV 파일
 *   - mode: "replace" | "append" (기본: append)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mode = (formData.get("mode") as string) || "append";

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
    }) as KnowledgeCSVRecord[];

    console.log(`📊 총 ${records.length}개 레코드 발견`);

    // 거래처명 → ID 매핑
    const { data: tenants } = await (supabase as any).from("tenants").select("id, name");
    const tenantMap = new Map<string, string>();
    (tenants || []).forEach((t: any) => {
      tenantMap.set(t.name, t.id);
    });

    let successCount = 0;
    let errorCount = 0;
    let embeddingCount = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const tenantId = tenantMap.get(record.tenant_name);

        if (!tenantId) {
          errorCount++;
          errors.push(`${record.title}: 거래처 "${record.tenant_name}"를 찾을 수 없습니다`);
          continue;
        }

        // 1. 문서 저장
        const docData = {
          tenant_id: tenantId,
          title: record.title,
          content: record.content || "", // 빈 content도 허용 (템플릿용)
          category: record.category || null,
          tags: record.tags ? record.tags.split(",").map((t: string) => t.trim()) : [],
          is_active: true,
        };

        const { data: doc, error: docError } = await (supabase as any)
          .from("knowledge_documents")
          .insert(docData)
          .select()
          .single();

        if (docError) {
          errorCount++;
          errors.push(`${record.title}: ${docError.message}`);
          continue;
        }

        successCount++;

        // 2. content가 있으면 임베딩 생성
        if (record.content && record.content.trim().length > 0) {
          // 텍스트 청킹 (500자 기준)
          const chunks = chunkText(record.content, 500);

          // 각 청크에 대해 임베딩 생성 및 저장
          for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];

            try {
              // 임베딩 생성 (OpenAI)
              const client = getOpenAIClient();
              const response = await client.embeddings.create({
                model: "text-embedding-3-small",
                input: chunkText,
                dimensions: 1536,
              });

              const embedding = response.data[0].embedding;

              // knowledge_chunks 테이블에 저장
              const { error: chunkError} = await (supabase as any).from("knowledge_chunks").insert({
                document_id: doc.id,
                tenant_id: tenantId,
                chunk_index: i,
                chunk_text: chunkText,
                embedding: `[${embedding.join(",")}]`, // pgvector 형식
                token_count: Math.ceil(chunkText.length / 4), // 대략적인 토큰 수
              });

              if (!chunkError) {
                embeddingCount++;
              }

              // Rate limiting: 100ms 대기
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (embeddingError: any) {
              errors.push(`${record.title} 청크 ${i + 1}: 임베딩 실패`);
            }
          }
        }
      } catch (err: any) {
        errorCount++;
        errors.push(`${record.title}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      embeddingCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("POST /api/knowledge/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * 텍스트를 청크로 분할 (500자 기준)
 */
function chunkText(text: string, maxLength = 500): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  const sentences = text.split(/[.!?]\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
