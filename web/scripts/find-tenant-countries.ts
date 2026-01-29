import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function findTenantCountries() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n=== 중복 거래처 국가 정보 추적 ===\n");

  // Get all tenants
  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("*")
    .order("name", { ascending: true });

  if (!tenants) {
    console.error("No tenants found");
    return;
  }

  // Find duplicates
  const grouped: Record<string, any[]> = {};
  tenants.forEach((t: any) => {
    if (!grouped[t.name]) grouped[t.name] = [];
    grouped[t.name].push(t);
  });

  const duplicates = Object.entries(grouped).filter(([_, list]) => list.length > 1);

  console.log(`총 ${duplicates.length}개 중복 거래처 발견\n`);

  for (const [name, tenantList] of duplicates) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`거래처: ${name} (${tenantList.length}개)`);
    console.log("=".repeat(80));

    for (const tenant of tenantList) {
      console.log(`\nTenant ID: ${tenant.id}`);
      console.log(`Name: ${tenant.name}`);
      console.log(`Specialty: ${tenant.specialty || "N/A"}`);

      // Check metadata
      const metadata = tenant.metadata || {};
      console.log(`\nMetadata:`);
      console.log(`  Country: ${metadata.country || "❌ 없음"}`);
      console.log(`  Location: ${metadata.location || "없음"}`);
      console.log(`  Address: ${metadata.address || "없음"}`);
      console.log(`  Operating Hours: ${metadata.operating_hours || "없음"}`);

      // Check channel accounts for this tenant
      const { data: channels } = await (supabase as any)
        .from("channel_accounts")
        .select("*")
        .eq("tenant_id", tenant.id);

      if (channels && channels.length > 0) {
        console.log(`\n연결된 채널 (${channels.length}개):`);
        channels.forEach((ch: any) => {
          console.log(`  - ${ch.channel_type}: ${ch.account_name}`);
          const chMetadata = ch.metadata || {};
          if (chMetadata.country) {
            console.log(`    Country: ${chMetadata.country}`);
          }
          if (chMetadata.language) {
            console.log(`    Language: ${chMetadata.language}`);
          }
        });
      } else {
        console.log("\n연결된 채널: ❌ 없음");
      }

      // Check customers for this tenant
      const { data: customers } = await (supabase as any)
        .from("customers")
        .select("id, country, language")
        .eq("tenant_id", tenant.id)
        .limit(5);

      if (customers && customers.length > 0) {
        console.log(`\n고객 샘플 (총 ${customers.length}명 이상):`);
        const countries = new Set(customers.map((c: any) => c.country).filter(Boolean));
        const languages = new Set(customers.map((c: any) => c.language).filter(Boolean));

        if (countries.size > 0) {
          console.log(`  주요 국가: ${Array.from(countries).join(", ")}`);
        }
        if (languages.size > 0) {
          console.log(`  주요 언어: ${Array.from(languages).join(", ")}`);
        }
      } else {
        console.log("\n고객: ❌ 없음");
      }

      console.log("\n" + "-".repeat(80));
    }
  }

  console.log("\n\n=== 국가 정보 업데이트 제안 ===\n");
  console.log("다음 정보를 바탕으로 각 중복 거래처의 국가를 수동으로 식별해야 합니다:");
  console.log("1. 연결된 채널의 메타데이터");
  console.log("2. 고객의 주요 국가/언어");
  console.log("3. 거래처 specialty 정보");
  console.log("\n식별 후 아래 형식으로 업데이트할 수 있습니다:");
  console.log("\nconst updates = [");
  console.log('  { id: "tenant-id-1", country: "Korea", location: "Seoul" },');
  console.log('  { id: "tenant-id-2", country: "Japan", location: "Tokyo" },');
  console.log("];");
}

findTenantCountries().catch(console.error);
