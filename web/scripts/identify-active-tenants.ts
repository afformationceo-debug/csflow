import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function identifyActiveTenants() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n=== 활성 거래처 식별 (채널 보유 여부) ===\n");

  // Get all tenants with channel count
  const { data: tenants, error } = await (supabase as any)
    .from("tenants")
    .select("id, name, specialty, settings, channel_accounts(id, channel_type, account_name, is_active)")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching tenants:", error);
    return;
  }

  if (!tenants) {
    console.error("No tenants found");
    return;
  }

  const activeChannelTenants: any[] = [];
  const noChannelTenants: any[] = [];

  tenants.forEach((t: any) => {
    const channelCount = t.channel_accounts?.length || 0;
    if (channelCount > 0) {
      activeChannelTenants.push({ ...t, channelCount });
    } else {
      noChannelTenants.push(t);
    }
  });

  console.log(`총 거래처: ${tenants.length}개`);
  console.log(`활성 거래처 (채널 보유): ${activeChannelTenants.length}개`);
  console.log(`비활성 거래처 (채널 없음): ${noChannelTenants.length}개\n`);

  console.log("=".repeat(80));
  console.log("활성 거래처 (채널 보유)");
  console.log("=".repeat(80));

  activeChannelTenants.forEach((t) => {
    console.log(`\n${t.name} (${t.specialty || "N/A"})`);
    console.log(`  ID: ${t.id}`);
    console.log(`  채널 수: ${t.channelCount}개`);
    t.channel_accounts.forEach((ch: any) => {
      console.log(`    - ${ch.channel_type}: ${ch.account_name} (${ch.is_active ? "활성" : "비활성"})`);
    });
  });

  console.log("\n\n" + "=".repeat(80));
  console.log("비활성 거래처 (채널 없음) - 삭제 대상");
  console.log("=".repeat(80));

  // Group duplicates
  const grouped: Record<string, any[]> = {};
  noChannelTenants.forEach((t: any) => {
    if (!grouped[t.name]) grouped[t.name] = [];
    grouped[t.name].push(t);
  });

  Object.entries(grouped).forEach(([name, list]) => {
    if (list.length > 1) {
      console.log(`\n🔴 ${name} (${list.length}개 중복):`);
      list.forEach((t) => {
        console.log(`   - ID: ${t.id} (specialty: ${t.specialty || "N/A"})`);
      });
    } else {
      const t = list[0];
      console.log(`\n${name}`);
      console.log(`  ID: ${t.id} (specialty: ${t.specialty || "N/A"})`);
    }
  });

  console.log("\n\n=== 제안 사항 ===\n");
  console.log("1. 비활성 거래처 (채널 없음) 삭제:");
  console.log(`   총 ${noChannelTenants.length}개 레코드 삭제 가능`);
  console.log("\n2. 활성 거래처에 국가 정보 추가:");
  console.log(`   총 ${activeChannelTenants.length}개 거래처에 국가/위치 메타데이터 추가 필요`);
  console.log("\n3. 삭제 스크립트 생성 (아래 ID들):");
  const deleteIds = noChannelTenants.map((t) => `  "${t.id}",`).join("\n");
  console.log("\nconst idsToDelete = [");
  console.log(deleteIds);
  console.log("];");
}

identifyActiveTenants().catch(console.error);
