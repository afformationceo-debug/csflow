import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function checkTenants() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n=== 1. 거래처 목록 (국가별) ===\n");

  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("*")
    .order("name", { ascending: true });

  if (tenants) {
    const grouped: Record<string, any[]> = {};
    tenants.forEach((t: any) => {
      if (!grouped[t.name]) grouped[t.name] = [];
      grouped[t.name].push(t);
    });

    Object.keys(grouped).forEach((name) => {
      const list = grouped[name];
      if (list.length > 1) {
        console.log(`🔴 ${name} (${list.length}개 중복):`);
        list.forEach((t) => {
          const country = t.metadata?.country || t.metadata?.location || "국가 정보 없음";
          console.log(`   - ${t.id.substring(0, 8)}... (국가: ${country})`);
        });
      } else {
        const t = list[0];
        const country = t.metadata?.country || t.metadata?.location || "국가 정보 없음";
        console.log(`${name} (국가: ${country})`);
      }
    });
  }

  console.log("\n=== 2. 거래처 프롬프트 확인 ===\n");

  if (tenants) {
    for (const tenant of tenants) {
      const aiConfig = tenant.ai_config || {};
      const systemPrompt = aiConfig.system_prompt || "";
      const country = tenant.metadata?.country || tenant.metadata?.location || "국가 정보 없음";

      console.log(`\n거래처: ${tenant.name} (${country})`);
      console.log(`ID: ${tenant.id}`);
      console.log(`AI 활성화: ${aiConfig.enabled ? "✅" : "❌"}`);
      console.log(`모델: ${aiConfig.model || "gpt-4"}`);
      console.log(`신뢰도 임계값: ${(aiConfig.confidence_threshold || 0.75) * 100}%`);

      if (systemPrompt) {
        console.log(`\n시스템 프롬프트 (${systemPrompt.length}자):`);
        console.log(`"${systemPrompt.substring(0, 200)}..."`);

        // Check for key elements
        const hasEmpathy = /공감|이해|걱정|우려/.test(systemPrompt);
        const hasBooking = /예약|상담|방문/.test(systemPrompt);
        const hasSpecific = systemPrompt.length > 100;

        console.log(`\n프롬프트 품질 체크:`);
        console.log(`  - 구체적 (100자 이상): ${hasSpecific ? "✅" : "❌"}`);
        console.log(`  - 고객 공감 포함: ${hasEmpathy ? "✅" : "❌"}`);
        console.log(`  - 예약 유도 포함: ${hasBooking ? "✅" : "❌"}`);
      } else {
        console.log("\n⚠️ 시스템 프롬프트 없음 (기본 프롬프트 사용)");
      }

      console.log("─".repeat(80));
    }
  }
}

checkTenants().catch(console.error);
