const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('❌ 환경변수가 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

// 텍스트 청킹 함수
function chunkText(text, maxLength = 500) {
  const chunks = [];
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

async function migrateKnowledge() {
  const csvPath = './scripts/example-knowledge.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 총 ${records.length}개 지식 레코드 발견`);

  // 거래처명 → ID 매핑
  const { data: tenants } = await supabase.from("tenants").select("id, name");
  const tenantMap = new Map();
  (tenants || []).forEach((t) => {
    tenantMap.set(t.name, t.id);
  });

  console.log(`🏥 ${tenantMap.size}개 거래처 로드됨`);

  let successCount = 0;
  let errorCount = 0;
  let embeddingCount = 0;
  const errors = [];

  for (const record of records) {
    try {
      const tenantId = tenantMap.get(record.tenant_name);

      if (!tenantId) {
        errorCount++;
        errors.push(`${record.title}: 거래처 "${record.tenant_name}"를 찾을 수 없습니다`);
        console.error(`❌ ${record.title}: 거래처 "${record.tenant_name}" 없음`);
        continue;
      }

      // 1. 문서 저장
      const docData = {
        tenant_id: tenantId,
        title: record.title,
        content: record.content,
        category: record.category || null,
        tags: record.tags ? record.tags.split(",").map((t) => t.trim()) : [],
        is_active: true,
      };

      const { data: doc, error: docError } = await supabase
        .from("knowledge_documents")
        .insert(docData)
        .select()
        .single();

      if (docError) {
        errorCount++;
        errors.push(`${record.title}: ${docError.message}`);
        console.error(`❌ ${record.title}: ${docError.message}`);
        continue;
      }

      successCount++;
      console.log(`✅ ${record.title} 문서 저장 성공`);

      // 2. 텍스트 청킹
      const chunks = chunkText(record.content, 500);
      console.log(`   📝 ${chunks.length}개 청크 생성`);

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
          const { error: chunkError } = await supabase.from("knowledge_chunks").insert({
            document_id: doc.id,
            chunk_index: i,
            chunk_text: chunkText,
            embedding: JSON.stringify(embedding),
          });

          if (!chunkError) {
            embeddingCount++;
            console.log(`   ✅ 청크 ${i + 1}/${chunks.length} 임베딩 저장`);
          } else {
            console.error(`   ❌ 청크 ${i + 1} 저장 실패: ${chunkError.message}`);
          }

          // Rate limiting: 100ms 대기
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (embeddingError) {
          errors.push(`${record.title} 청크 ${i + 1}: 임베딩 실패`);
          console.error(`   ❌ 청크 ${i + 1} 임베딩 실패`);
        }
      }
    } catch (err) {
      errorCount++;
      errors.push(`${record.title}: ${err.message}`);
      console.error(`❌ ${record.title}: ${err.message}`);
    }
  }

  console.log('\n📈 마이그레이션 결과:');
  console.log(`✅ 문서 성공: ${successCount}`);
  console.log(`❌ 문서 실패: ${errorCount}`);
  console.log(`🔮 임베딩 생성: ${embeddingCount}`);
  if (errors.length > 0) {
    console.log('\n에러 목록:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

migrateKnowledge().catch(console.error);
