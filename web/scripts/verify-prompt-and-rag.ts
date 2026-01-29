import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function verifyPromptAndRAG() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n" + "=".repeat(80));
  console.log("LLM 프롬프트 및 RAG 구조 검증");
  console.log("=".repeat(80) + "\n");

  // 1. 프롬프트 저장 위치 및 품질 확인
  console.log("📋 1. 프롬프트 저장 위치 및 구조\n");
  console.log("저장 위치: tenants.ai_config (JSONB)");
  console.log("구조:");
  console.log(`{
  "enabled": boolean,
  "model": "gpt-4" | "claude",
  "confidence_threshold": 0.75,
  "system_prompt": string  // ← 거래처별 맞춤 프롬프트
}`);

  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("id, name, specialty, ai_config")
    .order("name", { ascending: true });

  if (!tenants || tenants.length === 0) {
    console.log("\n❌ 거래처가 없습니다.\n");
    return;
  }

  console.log(`\n총 거래처: ${tenants.length}개\n`);

  // 2. 각 거래처 프롬프트 품질 체크
  console.log("=".repeat(80));
  console.log("📊 2. 거래처별 프롬프트 품질 분석");
  console.log("=".repeat(80) + "\n");

  for (const tenant of tenants) {
    const aiConfig = tenant.ai_config || {};
    const systemPrompt = aiConfig.system_prompt || "";

    console.log(`\n거래처: ${tenant.name} (${tenant.specialty || "N/A"})`);
    console.log(`─`.repeat(80));

    if (!systemPrompt) {
      console.log("❌ 시스템 프롬프트 없음 (LLM이 기본 프롬프트 사용)\n");
      continue;
    }

    console.log(`프롬프트 길이: ${systemPrompt.length}자`);

    // 품질 기준 체크
    const checks = {
      "구체적 (300자 이상)": systemPrompt.length >= 300,
      "역할 명시": /역할|상담사|AI/.test(systemPrompt),
      "공감 표현": /공감|이해|걱정|우려|마음/.test(systemPrompt),
      "예약 유도": /예약|상담|방문/.test(systemPrompt),
      "업무 정의": /업무|담당|처리/.test(systemPrompt),
      "응대 스타일": /스타일|어조|톤|친절|전문/.test(systemPrompt),
      "의료 전문성": /시술|치료|수술|진료/.test(systemPrompt),
    };

    console.log("\n품질 체크:");
    Object.entries(checks).forEach(([key, passed]) => {
      console.log(`  ${passed ? "✅" : "❌"} ${key}`);
    });

    const score = Object.values(checks).filter(Boolean).length;
    const maxScore = Object.keys(checks).length;
    const percentage = ((score / maxScore) * 100).toFixed(0);

    console.log(`\n종합 점수: ${score}/${maxScore} (${percentage}%)`);

    if (score < maxScore * 0.7) {
      console.log("⚠️  프롬프트 개선 필요 (70% 미만)");
    } else if (score === maxScore) {
      console.log("🎉 우수한 프롬프트 품질");
    }

    console.log(`\n프롬프트 내용 (처음 200자):`);
    console.log(`"${systemPrompt.substring(0, 200)}..."`);
  }

  // 3. RAG 구조 확인
  console.log("\n\n" + "=".repeat(80));
  console.log("🔍 3. RAG 구조 검증");
  console.log("=".repeat(80) + "\n");

  console.log("RAG 파이프라인 파일: /src/services/ai/rag-pipeline.ts");
  console.log("\nRAG 처리 순서:");
  console.log("1️⃣  Query Processing");
  console.log("   - 언어 감지 (language detection)");
  console.log("   - 번역 (DeepL: 외국어 → 한국어)");
  console.log("\n2️⃣  Document Retrieval (Hybrid Search)");
  console.log("   - Vector Search: pgvector (Cosine Similarity)");
  console.log("   - Full-text Search: PostgreSQL tsvector");
  console.log("   - Hybrid Merge: RRF (Reciprocal Rank Fusion)");
  console.log("   - 거래처별 격리: tenant_id 필터링");
  console.log("\n3️⃣  Context Augmentation");
  console.log("   - Retrieved Documents (지식베이스)");
  console.log("   - System Prompt (거래처별 맞춤 프롬프트) ← 여기서 사용!");
  console.log("   - Conversation History (대화 기록)");
  console.log("   - Customer Profile (고객 정보)");
  console.log("\n4️⃣  LLM Generation");
  console.log("   - Model Selection: GPT-4 / Claude (복잡도 기반)");
  console.log("   - Prompt Injection: System Prompt 주입");
  console.log("   - Response Generation");
  console.log("\n5️⃣  Confidence Check & Escalation");
  console.log("   - Confidence Score 계산 (0-1)");
  console.log("   - Threshold 비교 (default: 0.75)");
  console.log("   - Escalation 생성 (신뢰도 미달 시)");

  // 4. 지식베이스 확인
  console.log("\n\n" + "=".repeat(80));
  console.log("📚 4. 지식베이스 현황");
  console.log("=".repeat(80) + "\n");

  for (const tenant of tenants) {
    const { data: docs, count } = await (supabase as any)
      .from("knowledge_documents")
      .select("id, title, category", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .eq("is_active", true);

    console.log(`\n${tenant.name}:`);
    if (!docs || docs.length === 0) {
      console.log("  ❌ 지식베이스 문서 없음");
    } else {
      console.log(`  ✅ ${count}개 문서`);
      const categories = new Set(docs.map((d: any) => d.category).filter(Boolean));
      if (categories.size > 0) {
        console.log(`  카테고리: ${Array.from(categories).join(", ")}`);
      }
    }
  }

  // 5. LLM 사용 확인 (ai_response_logs)
  console.log("\n\n" + "=".repeat(80));
  console.log("🤖 5. LLM 실제 사용 내역");
  console.log("=".repeat(80) + "\n");

  const { data: logs } = await (supabase as any)
    .from("ai_response_logs")
    .select("id, model, confidence, escalated, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!logs || logs.length === 0) {
    console.log("❌ AI 응답 로그 없음 (아직 사용되지 않음)\n");
  } else {
    console.log(`최근 AI 응답 ${logs.length}개:\n`);
    logs.forEach((log: any, i: number) => {
      const date = new Date(log.created_at).toLocaleString("ko-KR");
      const confidencePercent = (log.confidence * 100).toFixed(1);
      console.log(
        `${i + 1}. [${date}] ${log.model} (신뢰도: ${confidencePercent}%) ${
          log.escalated ? "⚠️ 에스컬레이션" : "✅ 자동응대"
        }`
      );
    });
  }

  console.log("\n\n" + "=".repeat(80));
  console.log("✅ 검증 완료");
  console.log("=".repeat(80) + "\n");

  console.log("권장 사항:");
  console.log("1. 모든 거래처에 고품질 프롬프트 설정 (70% 이상 점수)");
  console.log("2. 각 거래처별 지식베이스 문서 추가 (최소 10개 이상)");
  console.log("3. RAG 파이프라인 테스트 (실제 고객 메시지로)");
  console.log("4. 에스컬레이션 비율 모니터링 (목표: 15% 이하)\n");
}

verifyPromptAndRAG().catch(console.error);
