#!/usr/bin/env tsx
/**
 * CSV 마이그레이션 스크립트
 *
 * 사용법:
 * 1. 거래처 CSV: npm run migrate:csv -- --type tenants --file tenants.csv
 * 2. 지식베이스 CSV: npm run migrate:csv -- --type knowledge --file knowledge.csv
 *
 * CSV 형식:
 *
 * tenants.csv:
 * name,name_en,specialty,default_language,system_prompt
 * "힐링안과","Healing Eye Clinic","ophthalmology","ja","[프롬프트]"
 *
 * knowledge.csv:
 * tenant_name,title,content,category,tags
 * "힐링안과","라식 수술 안내","라식 수술은...","시술안내","라식,수술,안과"
 */

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

// 환경변수 체크
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Supabase 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("❌ OpenAI API 키가 설정되지 않았습니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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

/**
 * OpenAI 임베딩 생성
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("임베딩 생성 실패:", error);
    throw error;
  }
}

interface TenantRecord {
  name: string;
  name_en?: string;
  specialty?: string;
  default_language?: string;
  system_prompt?: string;
  model?: string;
  confidence_threshold?: string;
  escalation_keywords?: string;
}

interface KnowledgeRecord {
  tenant_name: string;
  title: string;
  content: string;
  category?: string;
  tags?: string;
}

/**
 * 거래처 CSV 마이그레이션
 */
async function migrateTenants(csvPath: string): Promise<void> {
  console.log("📊 거래처 CSV 읽기:", csvPath);

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as TenantRecord[];

  console.log(`✅ ${records.length}개 거래처 발견`);

  let successCount = 0;
  let errorCount = 0;

  for (const record of records) {
    try {
      const tenantData = {
        name: record.name,
        name_en: record.name_en || null,
        specialty: record.specialty || null,
        default_language: record.default_language || "ko",
        ai_config: {
          system_prompt: record.system_prompt || null,
          model: record.model || "gpt-4",
          confidence_threshold: parseFloat(record.confidence_threshold || "0.75"),
          escalation_keywords: record.escalation_keywords
            ? record.escalation_keywords.split(",").map((k: string) => k.trim())
            : [],
        },
        settings: {},
      };

      const { data, error } = await supabase
        .from("tenants")
        .insert(tenantData)
        .select()
        .single();

      if (error) {
        console.error(`❌ [${record.name}] 저장 실패:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ [${record.name}] 저장 완료 (ID: ${data.id})`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`❌ [${record.name}] 처리 중 오류:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n📊 거래처 마이그레이션 완료:`);
  console.log(`  - 성공: ${successCount}개`);
  console.log(`  - 실패: ${errorCount}개`);
}

/**
 * 지식베이스 CSV 마이그레이션 (벡터 임베딩 포함)
 */
async function migrateKnowledge(csvPath: string): Promise<void> {
  console.log("📊 지식베이스 CSV 읽기:", csvPath);

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as KnowledgeRecord[];

  console.log(`✅ ${records.length}개 지식 문서 발견`);

  // 거래처명 → ID 매핑
  const { data: tenants } = await supabase.from("tenants").select("id, name");
  const tenantMap = new Map<string, string>();
  (tenants || []).forEach((t: any) => {
    tenantMap.set(t.name, t.id);
  });

  let successCount = 0;
  let errorCount = 0;
  let embeddingCount = 0;

  for (const record of records) {
    try {
      const tenantId = tenantMap.get(record.tenant_name);

      if (!tenantId) {
        console.error(`❌ [${record.title}] 거래처 "${record.tenant_name}"를 찾을 수 없습니다.`);
        errorCount++;
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

      const { data: doc, error: docError } = await supabase
        .from("knowledge_documents")
        .insert(docData)
        .select()
        .single();

      if (docError) {
        console.error(`❌ [${record.title}] 문서 저장 실패:`, docError.message);
        errorCount++;
        continue;
      }

      console.log(`✅ [${record.title}] 문서 저장 완료 (ID: ${doc.id})`);
      successCount++;

      // 2. 텍스트 청킹
      const chunks = chunkText(record.content, 500);
      console.log(`   📄 ${chunks.length}개 청크 생성`);

      // 3. 각 청크에 대해 임베딩 생성 및 저장
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];

        try {
          // 임베딩 생성
          const embedding = await generateEmbedding(chunkText);

          // knowledge_chunks 테이블에 저장
          const { error: chunkError } = await supabase.from("knowledge_chunks").insert({
            document_id: doc.id,
            chunk_index: i,
            chunk_text: chunkText,
            embedding: JSON.stringify(embedding), // pgvector VECTOR 타입으로 자동 변환
          });

          if (chunkError) {
            console.error(`   ❌ 청크 ${i + 1} 저장 실패:`, chunkError.message);
          } else {
            embeddingCount++;
          }

          // Rate limiting: 100ms 대기
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (embeddingError: any) {
          console.error(`   ❌ 청크 ${i + 1} 임베딩 실패:`, embeddingError.message);
        }
      }

      console.log(`   ✅ ${embeddingCount}개 임베딩 완료\n`);
    } catch (err: any) {
      console.error(`❌ [${record.title}] 처리 중 오류:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n📊 지식베이스 마이그레이션 완료:`);
  console.log(`  - 문서 성공: ${successCount}개`);
  console.log(`  - 문서 실패: ${errorCount}개`);
  console.log(`  - 임베딩 생성: ${embeddingCount}개`);
}

/**
 * 메인 실행
 */
async function main() {
  const args = process.argv.slice(2);

  let type = "tenants";
  let file = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type") {
      type = args[i + 1];
      i++;
    } else if (args[i] === "--file") {
      file = args[i + 1];
      i++;
    }
  }

  if (!file) {
    console.error("❌ --file 옵션이 필요합니다.");
    console.log("\n사용법:");
    console.log("  npm run migrate:csv -- --type tenants --file tenants.csv");
    console.log("  npm run migrate:csv -- --type knowledge --file knowledge.csv");
    process.exit(1);
  }

  const csvPath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${csvPath}`);
    process.exit(1);
  }

  console.log("🚀 CSV 마이그레이션 시작\n");
  console.log(`  - 타입: ${type}`);
  console.log(`  - 파일: ${csvPath}\n`);

  if (type === "tenants") {
    await migrateTenants(csvPath);
  } else if (type === "knowledge") {
    await migrateKnowledge(csvPath);
  } else {
    console.error(`❌ 알 수 없는 타입: ${type}`);
    console.log("  지원되는 타입: tenants, knowledge");
    process.exit(1);
  }

  console.log("\n✅ 마이그레이션 완료!");
}

main().catch((error) => {
  console.error("❌ 치명적 오류:", error);
  process.exit(1);
});
