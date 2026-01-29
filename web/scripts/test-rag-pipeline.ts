/**
 * RAG Pipeline End-to-End Test Script
 *
 * Tests the complete RAG flow:
 * 1. Knowledge base query (should auto-respond)
 * 2. Missing knowledge (should escalate with KB recommendation)
 * 3. Tenant info query (should escalate with tenant DB recommendation)
 * 4. Escalation reduction (after KB update, same question should auto-respond)
 *
 * Usage:
 *   npx tsx scripts/test-rag-pipeline.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local file
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { ragPipeline } from "../src/services/ai/rag-pipeline";
import serverKnowledgeService from "../src/services/ai/knowledge-base";
import { createClient } from "@supabase/supabase-js";

interface TestResult {
  scenario: string;
  query: string;
  shouldEscalate: boolean;
  confidence: number;
  recommendedAction?: "knowledge_base" | "tenant_info";
  missingInfo?: string[];
  response?: string;
  passed: boolean;
  reason?: string;
}

async function testRAGPipeline() {
  console.log("\n🧪 ═══════════════════════════════════════════════════════════");
  console.log("📊 RAG Pipeline End-to-End Test");
  console.log("═══════════════════════════════════════════════════════════\n");

  const results: TestResult[] = [];

  // Create Supabase client directly (not using Next.js request context)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables");
    console.error("   NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
    console.error("   SUPABASE_SERVICE_ROLE_KEY:", !!supabaseKey);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get test tenant (first one in DB)
  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("*")
    .limit(1);

  if (!tenants || tenants.length === 0) {
    console.error("❌ No tenants found in database. Please create a tenant first.");
    return;
  }

  const testTenant = tenants[0];
  console.log(`✅ Using test tenant: ${testTenant.name} (${testTenant.id})\n`);

  // ──────────────────────────────────────────────────────────────────
  // Test 1: Knowledge Base Query (should auto-respond)
  // ──────────────────────────────────────────────────────────────────
  console.log("🧪 Test 1: Knowledge Base Query (FAQ)");
  console.log("─────────────────────────────────────");

  const test1Query = "라식 수술 가격이 얼마인가요?";
  console.log(`📝 Query: "${test1Query}"\n`);

  try {
    const result1 = await ragPipeline.process({
      query: test1Query,
      tenantId: testTenant.id,
      conversationId: "test-conversation-1",
      customerLanguage: "KO",
    });

    const test1Result: TestResult = {
      scenario: "Test 1: Knowledge Base Query",
      query: test1Query,
      shouldEscalate: result1.shouldEscalate,
      confidence: result1.confidence,
      response: result1.response?.slice(0, 100) + "...",
      passed: !result1.shouldEscalate && result1.confidence >= 0.65,
      reason: !result1.shouldEscalate
        ? `AI responded with confidence ${(result1.confidence * 100).toFixed(1)}%`
        : `Escalated with reason: ${result1.escalationReason}`,
    };

    results.push(test1Result);
    console.log(`${test1Result.passed ? "✅ PASS" : "❌ FAIL"}: ${test1Result.reason}\n`);
    if (result1.response) {
      console.log(`💬 AI Response: ${result1.response.slice(0, 200)}...\n`);
    }
  } catch (error: any) {
    console.error(`❌ Test 1 Error: ${error.message}\n`);
    results.push({
      scenario: "Test 1: Knowledge Base Query",
      query: test1Query,
      shouldEscalate: false,
      confidence: 0,
      passed: false,
      reason: `Error: ${error.message}`,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Test 2: Missing Knowledge (should escalate with KB recommendation)
  // ──────────────────────────────────────────────────────────────────
  console.log("🧪 Test 2: Missing Knowledge (should escalate)");
  console.log("─────────────────────────────────────────────");

  const test2Query = "스마일라식 회복 기간은 얼마나 걸리나요?";
  console.log(`📝 Query: "${test2Query}"\n`);

  try {
    const result2 = await ragPipeline.process({
      query: test2Query,
      tenantId: testTenant.id,
      conversationId: "test-conversation-2",
      customerLanguage: "KO",
    });

    const test2Result: TestResult = {
      scenario: "Test 2: Missing Knowledge",
      query: test2Query,
      shouldEscalate: result2.shouldEscalate,
      confidence: result2.confidence,
      recommendedAction: result2.recommendedAction,
      missingInfo: result2.missingInfo,
      passed: result2.shouldEscalate && result2.recommendedAction === "knowledge_base",
      reason: result2.shouldEscalate
        ? `Escalated correctly. Recommended: ${result2.recommendedAction}, Missing: ${result2.missingInfo?.join(", ")}`
        : `Should have escalated but didn't (confidence: ${(result2.confidence * 100).toFixed(1)}%)`,
    };

    results.push(test2Result);
    console.log(`${test2Result.passed ? "✅ PASS" : "❌ FAIL"}: ${test2Result.reason}\n`);
  } catch (error: any) {
    console.error(`❌ Test 2 Error: ${error.message}\n`);
    results.push({
      scenario: "Test 2: Missing Knowledge",
      query: test2Query,
      shouldEscalate: false,
      confidence: 0,
      passed: false,
      reason: `Error: ${error.message}`,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Test 3: Tenant Info Query (should escalate with tenant_info recommendation)
  // ──────────────────────────────────────────────────────────────────
  console.log("🧪 Test 3: Tenant Info Query (operational info)");
  console.log("──────────────────────────────────────────────");

  const test3Query = "영업 시간이 언제인가요?";
  console.log(`📝 Query: "${test3Query}"\n`);

  try {
    const result3 = await ragPipeline.process({
      query: test3Query,
      tenantId: testTenant.id,
      conversationId: "test-conversation-3",
      customerLanguage: "KO",
    });

    const test3Result: TestResult = {
      scenario: "Test 3: Tenant Info Query",
      query: test3Query,
      shouldEscalate: result3.shouldEscalate,
      confidence: result3.confidence,
      recommendedAction: result3.recommendedAction,
      missingInfo: result3.missingInfo,
      passed: result3.shouldEscalate && result3.recommendedAction === "tenant_info",
      reason: result3.shouldEscalate
        ? `Escalated correctly. Recommended: ${result3.recommendedAction}, Missing: ${result3.missingInfo?.join(", ")}`
        : `Should have escalated but didn't (confidence: ${(result3.confidence * 100).toFixed(1)}%)`,
    };

    results.push(test3Result);
    console.log(`${test3Result.passed ? "✅ PASS" : "❌ FAIL"}: ${test3Result.reason}\n`);
  } catch (error: any) {
    console.error(`❌ Test 3 Error: ${error.message}\n`);
    results.push({
      scenario: "Test 3: Tenant Info Query",
      query: test3Query,
      shouldEscalate: false,
      confidence: 0,
      passed: false,
      reason: `Error: ${error.message}`,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Test 4: Escalation Reduction (add KB document, then re-test)
  // ──────────────────────────────────────────────────────────────────
  console.log("🧪 Test 4: Escalation Reduction (after KB update)");
  console.log("────────────────────────────────────────────────");
  console.log("📝 Step 1: Adding knowledge document to DB...\n");

  try {
    // Add knowledge document for test 2 query
    const newDoc = await serverKnowledgeService.createDocument({
      tenantId: testTenant.id,
      title: "스마일라식 회복 기간 안내",
      content: `스마일라식 수술 후 회복 기간은 일반적으로 다음과 같습니다:

- 수술 당일: 약간의 눈물, 이물감, 시력 흐림 현상이 있을 수 있습니다.
- 1-2일: 대부분의 불편감이 사라지며, 일상생활 복귀가 가능합니다.
- 1주일: 시력이 안정화되기 시작합니다. 운전 등 일상 활동 가능.
- 1개월: 대부분의 환자가 최종 시력에 도달합니다.
- 3개월: 완전한 회복 및 안정화 단계입니다.

주의사항:
- 수술 후 1주일간 눈에 물이 들어가지 않도록 주의
- 렌즈 착용 금지 (의사 지시에 따라)
- 정기 검진 필수 (1일, 1주일, 1개월, 3개월)`,
      category: "FAQ",
      tags: ["스마일라식", "회복기간", "수술후관리"],
      sourceType: "manual",
      sourceId: "test_script_escalation_reduction",
    });

    console.log(`✅ Document created: ${newDoc.id}`);
    console.log(`📊 Generating embeddings...\n`);

    // Generate embeddings
    await serverKnowledgeService.regenerateEmbeddings(newDoc.id, newDoc.content);
    console.log(`✅ Embeddings generated successfully\n`);

    // Wait for embeddings to be indexed (2 seconds)
    console.log(`⏳ Waiting for index update (2s)...\n`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Re-test with same query
    console.log(`📝 Step 2: Re-testing with same query: "${test2Query}"\n`);

    const result4 = await ragPipeline.process({
      query: test2Query,
      tenantId: testTenant.id,
      conversationId: "test-conversation-4",
      customerLanguage: "KO",
    });

    const test4Result: TestResult = {
      scenario: "Test 4: Escalation Reduction",
      query: test2Query,
      shouldEscalate: result4.shouldEscalate,
      confidence: result4.confidence,
      response: result4.response?.slice(0, 100) + "...",
      passed: !result4.shouldEscalate && result4.confidence >= 0.65,
      reason: !result4.shouldEscalate
        ? `✅ Escalation reduced! AI now responds with confidence ${(result4.confidence * 100).toFixed(1)}%`
        : `❌ Still escalating despite KB update (confidence: ${(result4.confidence * 100).toFixed(1)}%)`,
    };

    results.push(test4Result);
    console.log(`${test4Result.passed ? "✅ PASS" : "❌ FAIL"}: ${test4Result.reason}\n`);
    if (result4.response) {
      console.log(`💬 AI Response: ${result4.response.slice(0, 200)}...\n`);
    }
  } catch (error: any) {
    console.error(`❌ Test 4 Error: ${error.message}\n`);
    results.push({
      scenario: "Test 4: Escalation Reduction",
      query: test2Query,
      shouldEscalate: false,
      confidence: 0,
      passed: false,
      reason: `Error: ${error.message}`,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Final Summary
  // ──────────────────────────────────────────────────────────────────
  console.log("\n📊 ═══════════════════════════════════════════════════════════");
  console.log("🏁 Test Summary");
  console.log("═══════════════════════════════════════════════════════════\n");

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.scenario}`);
    console.log(`   Query: "${result.query}"`);
    console.log(`   Status: ${result.passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   Reason: ${result.reason}`);
    console.log("");
  });

  console.log(`\n🎯 Final Score: ${passedCount}/${totalCount} tests passed`);
  console.log(`📈 Success Rate: ${((passedCount / totalCount) * 100).toFixed(1)}%\n`);

  if (passedCount === totalCount) {
    console.log("🎉 All tests passed! RAG pipeline is working correctly.\n");
  } else {
    console.log(`⚠️  ${totalCount - passedCount} test(s) failed. Please review the results above.\n`);
  }

  process.exit(passedCount === totalCount ? 0 : 1);
}

// Run tests
testRAGPipeline().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
