const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateTenants() {
  const csvPath = './scripts/tenants-migration.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 총 ${records.length}개 레코드 발견`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

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
            ? record.escalation_keywords.split(",").map(k => k.trim())
            : [],
          default_language: record.default_language || "ko",
        },
        settings: {},
      };

      const { error } = await supabase
        .from("tenants")
        .insert(tenantData);

      if (error) {
        errorCount++;
        errors.push(`${record.name}: ${error.message}`);
        console.error(`❌ ${record.name}: ${error.message}`);
      } else {
        successCount++;
        console.log(`✅ ${record.name} 성공`);
      }
    } catch (err) {
      errorCount++;
      errors.push(`${record.name}: ${err.message}`);
      console.error(`❌ ${record.name}: ${err.message}`);
    }
  }

  console.log('\n📈 마이그레이션 결과:');
  console.log(`✅ 성공: ${successCount}`);
  console.log(`❌ 실패: ${errorCount}`);
  if (errors.length > 0) {
    console.log('\n에러 목록:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

migrateTenants().catch(console.error);
