import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

interface KnowledgeCSVRecord {
  tenant_name: string;
  title: string;
  content: string;
  category: string;
  tags: string;
}

/**
 * POST /api/knowledge/migrate
 * CSV 파일 업로드 → DB 저장 + 벡터 임베딩 자동 생성
 *
 * Body (multipart/form-data):
 *   - file: CSV 파일
 *   - type: "tenants" | "knowledge"
 *
 * 또는 Body (application/json):
 *   - csvContent: CSV 텍스트 내용
 *   - type: "tenants" | "knowledge"
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let csvContent: string;
    let type: "tenants" | "knowledge";

    // JSON 형식으로 CSV 텍스트 전송된 경우
    if (contentType.includes("application/json")) {
      const body = await request.json();
      csvContent = body.csvContent;
      type = body.type;
    }
    // FormData로 파일 업로드된 경우
    else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      type = (formData.get("type") as "tenants" | "knowledge") || "knowledge";

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      csvContent = await file.text();
    } else {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    if (!csvContent || !type) {
      return NextResponse.json({ error: "csvContent and type are required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // 거래처 마이그레이션
    if (type === "tenants") {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as TenantCSVRecord[];

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

          const { error } = await (supabase as any)
            .from("tenants")
            .insert(tenantData);

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
        type: "tenants",
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // 지식베이스 마이그레이션 (벡터 임베딩 자동 생성)
    if (type === "knowledge") {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as KnowledgeCSVRecord[];

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
            content: record.content,
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

          // 2. 텍스트 청킹 (500자 기준)
          const chunks = chunkText(record.content, 500);

          // 3. 각 청크에 대해 임베딩 생성 및 저장
          for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];

            try {
              // 임베딩 생성 (OpenAI)
              const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunkText,
                dimensions: 1536,
              });

              const embedding = response.data[0].embedding;

              // knowledge_chunks 테이블에 저장
              const { error: chunkError } = await (supabase as any).from("knowledge_chunks").insert({
                document_id: doc.id,
                chunk_index: i,
                chunk_text: chunkText,
                embedding: JSON.stringify(embedding), // pgvector로 자동 변환
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
        } catch (err: any) {
          errorCount++;
          errors.push(`${record.title}: ${err.message}`);
        }
      }

      return NextResponse.json({
        success: true,
        type: "knowledge",
        successCount,
        errorCount,
        embeddingCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/knowledge/migrate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
