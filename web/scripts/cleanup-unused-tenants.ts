import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

async function cleanupUnusedTenants() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n=== 비활성 거래처 삭제 (채널 없는 레코드) ===\n");

  const idsToDelete = [
    "63f40e53-87f3-4427-a492-51213d4cfb1e",
    "912ebd98-d85b-47e0-a878-f373561c227d",
    "21b49224-8a9a-4022-889d-a06a360b166a",
    "2540d8bc-b7ad-4b20-aa26-d96fb8a24bcb",
    "a04672e3-9428-41fc-8bc4-96d00cb0458e",
    "d32b5999-664d-4352-b49e-f0cda558e4f7",
    "19ea119f-ce57-42c8-8d8c-29ce1817c217",
    "35f7965d-23d3-4713-bbba-c8c4dc7a5471",
    "6a8b04d9-8e7e-4592-92d0-5c49cb50b384",
    "f3eaabd0-1957-4cb9-bdc7-b143682ff937",
    "50eddf6a-014f-49cc-a1c1-89ddb89c5d8f",
    "4e87e5bd-a6e8-4607-935c-3d8a8cc628d2",
    "bf3dda54-3602-4476-8bea-498d44ff54ad",
    "dfae2472-ddc1-4c18-ad6a-f616fa4f15e5",
    "3f19ee7c-cd39-4208-99e9-edc960e7622d",
    "98bb8e81-8f63-431b-b1ef-697319c3adfb",
    "ee7adace-34d1-405f-a839-515367a28f44",
    "c15909d0-3536-4881-acd5-8c7e3b3c49cc",
    "19f5daf9-c4a8-4ee6-aa5b-d6067cd2a46f",
    "f749eae2-2d06-428b-bf62-8122574d5475",
    "55ebfc22-b21e-43b7-8d5b-a0e5c56c26c9",
    "58ebd85d-915b-4789-a624-79495d8a4fdd",
    "e17a49de-ce79-43bd-ad20-9d7e4c7422d7",
    "a4274d32-346a-45fa-95ec-8ae03ca3b9f2",
    "f6178352-fad4-4688-8fd0-78d0fd873e72",
    "b75b36a3-f243-4279-8b34-dce7e8ab062c",
    "3e69ca2a-bba4-4ca1-b5bb-dc32e78b2412",
    "22791063-0b52-4a4a-8167-56dc57e5edfe",
    "64ffd197-22f5-4216-9f7b-c1241ef59654",
    "431b1356-7469-43fc-b744-7c4e1cf96833",
    "08ff8767-9a8e-4616-8fa9-2259299f8007",
    "41c35f95-75b7-4c2b-8e37-d673bb93270c",
    "614aa066-b9f3-47e7-a7a9-09ce2faba300",
    "a66360b8-160f-4614-91ce-780803afe6c9",
    "f115c312-a117-4ee2-bf0d-9ec7122c8541",
    "e52239dc-4fc0-4a4e-8010-b55a30c85dac",
    "ec24951d-53f5-459f-b0cb-cbe5eb46cf54",
    "c1471b51-89ae-424e-8daa-dd882c747aa4",
    "3d5af1b4-fc3a-4a22-b4a6-b7eea104874a",
    "2edc5aee-0f9f-43df-835a-8f2322f49f20",
    "68f26450-e55a-448b-8224-dfecfc0ed348",
    "f89e3fa1-f930-43b2-8668-88963a48345f",
    "996fd76e-73d2-405a-8755-656ec14626ee",
    "f731ad88-9d7b-45c9-87f1-e084eab9d535",
    "75f60723-5ba4-4105-8644-25234cd9c4a5",
    "42358a8a-b315-4009-9956-0fffb06c3852",
  ];

  console.log(`삭제 대상: ${idsToDelete.length}개 거래처\n`);

  // Confirm before delete
  console.log("⚠️  경고: 이 작업은 되돌릴 수 없습니다!");
  console.log("⚠️  CASCADE 설정으로 인해 연결된 모든 데이터도 삭제됩니다.");
  console.log("   (customers, conversations, messages 등)\n");

  // Delete in batches
  const batchSize = 10;
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    console.log(`배치 ${Math.floor(i / batchSize) + 1}: ${batch.length}개 삭제 중...`);

    const { error } = await (supabase as any)
      .from("tenants")
      .delete()
      .in("id", batch);

    if (error) {
      console.error(`  ❌ 에러:`, error.message);
      errorCount += batch.length;
    } else {
      console.log(`  ✅ ${batch.length}개 삭제 완료`);
      deletedCount += batch.length;
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${deletedCount}개`);
  console.log(`실패: ${errorCount}개`);

  // Verify remaining tenants
  const { data: remaining } = await (supabase as any)
    .from("tenants")
    .select("id, name, specialty")
    .order("name", { ascending: true });

  console.log(`\n남은 거래처: ${remaining?.length || 0}개`);
  if (remaining && remaining.length > 0) {
    remaining.forEach((t: any) => {
      console.log(`  - ${t.name} (${t.specialty || "N/A"})`);
    });
  }
}

cleanupUnusedTenants().catch(console.error);
