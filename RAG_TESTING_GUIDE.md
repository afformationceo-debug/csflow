# RAG 벡터 검색 테스트 가이드

## 1. 개요

이 문서는 CS 자동화 플랫폼에서 사용하는 RAG (Retrieval-Augmented Generation) 벡터 검색 시스템의 테스트 방법을 설명합니다.

## 2. RAG 시스템 구조

```
CSV 업로드 → 문서 저장 (knowledge_documents) → 텍스트 청킹 → OpenAI 임베딩 생성 → 벡터 저장 (knowledge_chunks)
                ↓
LLM RAG 쿼리 → 벡터 검색 (pgvector) → 관련 문서 검색 → LLM 컨텍스트 제공 → AI 응답 생성
```

## 3. Supabase SQL Editor를 통한 직접 테스트

### 3.1 데이터베이스 접속

1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택: `bfxtgqhollfkzawuzfwo`
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 3.2 테스트 쿼리 모음

#### Step 1: 거래처(Tenant) 데이터 확인

```sql
-- 등록된 거래처 목록 확인
SELECT
  id,
  name,
  name_en,
  specialty,
  created_at
FROM tenants
ORDER BY created_at DESC;
```

**예상 결과**: CSV 업로드한 거래처들이 표시되어야 함 (힐링안과, 청담봄온의원, 서울성형외과 등)

#### Step 2: 지식베이스 문서 확인

```sql
-- 등록된 지식베이스 문서 확인
SELECT
  kd.id,
  kd.title,
  kd.category,
  kd.tags,
  kd.created_at,
  t.name as tenant_name,
  LENGTH(kd.content) as content_length
FROM knowledge_documents kd
LEFT JOIN tenants t ON kd.tenant_id = t.id
ORDER BY kd.created_at DESC
LIMIT 20;
```

**예상 결과**: CSV 업로드한 지식 문서들이 표시되어야 함 (각 거래처별 50+ 문서)

#### Step 3: 임베딩 벡터 확인

```sql
-- 생성된 임베딩 청크 확인
SELECT
  kc.id,
  kc.document_id,
  kc.chunk_index,
  LEFT(kc.chunk_text, 50) || '...' as chunk_preview,
  kc.token_count,
  kc.created_at,
  t.name as tenant_name,
  array_length(string_to_array(kc.embedding::text, ','), 1) as embedding_dimension
FROM knowledge_chunks kc
LEFT JOIN tenants t ON kc.tenant_id = t.id
ORDER BY kc.created_at DESC
LIMIT 20;
```

**예상 결과**:
- 각 문서가 500자 단위로 청킹되어 저장됨
- `embedding_dimension`이 1536이어야 함 (OpenAI text-embedding-3-small)
- `tenant_id`가 올바르게 설정되어 있어야 함

#### Step 4: 벡터 검색 함수 테스트

```sql
-- 특정 거래처의 문서에서 "라식 수술 비용" 관련 검색
-- 먼저 임베딩을 생성해야 하므로, 실제 테스트는 API를 통해 진행

-- 대신 풀텍스트 검색으로 유사 기능 테스트:
SELECT
  kd.title,
  kd.category,
  kd.content,
  t.name as tenant_name,
  ts_rank(to_tsvector('simple', kd.content), to_tsquery('simple', '라식 | 수술 | 비용')) as relevance
FROM knowledge_documents kd
LEFT JOIN tenants t ON kd.tenant_id = t.id
WHERE to_tsvector('simple', kd.content) @@ to_tsquery('simple', '라식 | 수술 | 비용')
ORDER BY relevance DESC
LIMIT 10;
```

#### Step 5: pgvector 확장 및 인덱스 확인

```sql
-- pgvector 확장이 활성화되어 있는지 확인
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 벡터 인덱스 확인
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'knowledge_chunks' AND indexname LIKE '%embedding%';
```

**예상 결과**:
- `vector` 확장이 설치되어 있어야 함
- `knowledge_chunks_embedding_idx` 인덱스가 생성되어 있어야 함 (IVFFlat)

### 3.3 RPC 함수를 통한 벡터 검색 (고급)

```sql
-- match_documents RPC 함수를 통한 벡터 검색 테스트
-- 주의: 실제 임베딩 벡터가 필요하므로, OpenAI API를 통해 생성한 벡터를 사용해야 함

-- 함수 정의 확인
SELECT
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'match_documents';
```

## 4. API 엔드포인트를 통한 E2E 테스트

### 4.1 지식베이스 CSV 업로드 테스트

```bash
# 1. CSV 템플릿 다운로드
curl -o knowledge_template.csv \
  "https://csflow.vercel.app/api/knowledge/bulk?tenantId={tenant_id}"

# 2. CSV 업로드 (임베딩 자동 생성)
curl -X POST \
  -F "file=@/path/to/knowledge.csv" \
  "https://csflow.vercel.app/api/knowledge/bulk"

# 예상 응답:
# {
#   "success": true,
#   "successCount": 50,
#   "errorCount": 0,
#   "embeddingCount": 120
# }
```

### 4.2 RAG 쿼리 테스트 (AI 응답 생성)

RAG 시스템은 실제 고객 문의가 들어왔을 때 자동으로 작동합니다:

1. **LINE 웹훅 테스트** (실제 채널 연동 시):
   ```bash
   # LINE 메시지 발송 → AI 자동 응답 확인
   # POST /api/webhooks/line
   ```

2. **내부 RAG API 테스트** (개발용):
   ```typescript
   // web/src/services/ai/rag-pipeline.ts 참고
   import { ragPipeline } from '@/services/ai/rag-pipeline';

   const result = await ragPipeline.generate({
     query: "라식 수술 비용이 얼마인가요?",
     tenantId: "tenant-uuid",
     language: "ko",
     conversationHistory: []
   });

   console.log(result);
   // {
   //   response: "라식 수술 비용은 양안 기준 150만원~200만원입니다...",
   //   confidence: 0.92,
   //   sources: [...],
   //   shouldEscalate: false
   // }
   ```

## 5. 프론트엔드 UI를 통한 테스트

### 5.1 지식베이스 페이지에서 CSV 업로드

1. https://csflow.vercel.app/knowledge 접속
2. **거래처 필터** 선택 (예: 힐링안과)
3. **CSV 다운로드** 버튼 클릭 → 현재 데이터 확인
4. **CSV 업로드** 버튼 클릭
5. `template-ophthalmology.csv` 파일 선택
6. 업로드 버튼 클릭
7. 성공 토스트 확인: "✅ 지식베이스 업로드 완료\n문서: 52개\n임베딩: 120개"
8. 페이지 새로고침 후 문서 목록에 표시되는지 확인

### 5.2 거래처 페이지에서 CSV 업로드

1. https://csflow.vercel.app/tenants 접속
2. **CSV 다운로드** 버튼 클릭 → 현재 데이터 확인
3. **CSV 업로드** 버튼 클릭
4. `template-tenants.csv` 파일 선택
5. 업로드 버튼 클릭
6. 성공 토스트 확인: "✅ 거래처 업로드 완료\n성공: 10개"
7. 페이지 새로고침 후 거래처 카드에 표시되는지 확인

### 5.3 통합 인박스에서 AI 자동 응답 확인

1. https://csflow.vercel.app/inbox 접속
2. 고객 대화 선택
3. **AI ON/OFF 토글** 확인 (AI 자동응대 활성화 상태)
4. 고객 문의 메시지 확인 (예: "라식 수술 비용이 얼마인가요?")
5. AI 자동 응답 확인:
   - 보라색 "AI BOT" 라벨 표시
   - 신뢰도 점수 표시 (예: 92%)
   - 응답 내용이 지식베이스 문서와 일치하는지 확인

## 6. 벡터 검색 품질 검증 체크리스트

### ✅ 데이터 저장 확인
- [ ] 거래처 CSV 업로드 → `tenants` 테이블 저장
- [ ] 지식베이스 CSV 업로드 → `knowledge_documents` 테이블 저장
- [ ] 문서 청킹 → `knowledge_chunks` 테이블 저장
- [ ] 임베딩 벡터 생성 → `embedding` 필드에 1536차원 벡터 저장
- [ ] `tenant_id`로 올바르게 격리됨

### ✅ 벡터 검색 작동 확인
- [ ] pgvector 확장 활성화
- [ ] IVFFlat 인덱스 생성됨
- [ ] `match_documents()` RPC 함수 생성됨
- [ ] 유사도 검색이 정상적으로 작동함

### ✅ RAG 파이프라인 확인
- [ ] 고객 문의 → 임베딩 생성
- [ ] 벡터 검색 → 관련 문서 k개 반환
- [ ] Full-text 검색과 Hybrid Search (RRF) 결합
- [ ] LLM에 컨텍스트 제공 → 응답 생성
- [ ] 신뢰도 계산 → 에스컬레이션 판단
- [ ] AI 응답 로깅 (`ai_response_logs`)

### ✅ UI 반영 확인
- [ ] 지식베이스 페이지에서 업로드한 문서 표시
- [ ] 거래처별 필터링 작동
- [ ] 문서 검색 기능 작동
- [ ] 거래처 페이지에서 업로드한 거래처 표시
- [ ] 거래처 카드에서 통계 표시
- [ ] AI 설정 다이얼로그에서 모델/임계값 수정 가능

## 7. 문제 해결 가이드

### 문제 1: 임베딩이 생성되지 않음
**증상**: `knowledge_chunks` 테이블이 비어있음

**해결**:
1. OpenAI API 키 확인: `.env.local`의 `OPENAI_API_KEY`
2. API 할당량 확인: https://platform.openai.com/usage
3. 서버 로그 확인: `npm run dev` 콘솔에서 에러 메시지 확인
4. Rate Limiting: 100ms 간격으로 API 호출 중인지 확인

### 문제 2: 벡터 검색 결과가 부정확함
**증상**: AI 응답이 관련 없는 내용을 생성함

**해결**:
1. 지식베이스 문서의 품질 확인 (명확하고 구체적인 내용인지)
2. 청킹 크기 조정 (현재 500자, 필요시 조정)
3. 벡터 검색 k 값 조정 (현재 10개, RAG 파이프라인에서 조정 가능)
4. Hybrid Search 가중치 조정 (벡터 vs 풀텍스트)

### 문제 3: 신뢰도가 낮음
**증상**: AI 응답이 항상 에스컬레이션됨

**해결**:
1. 거래처별 신뢰도 임계값 조정 (거래처 관리 → AI 설정)
2. 시스템 프롬프트 개선 (거래처별 맞춤 지침)
3. 지식베이스 문서 추가/개선

## 8. 테스트 시나리오 예시

### 시나리오 1: 안과 거래처 RAG 테스트

1. **준비**:
   - `template-ophthalmology.csv` 업로드 (52개 문서)
   - 거래처: 힐링안과 선택

2. **테스트 문의**:
   - "라식 수술 비용이 얼마인가요?"
   - "라섹과 스마일라식의 차이는?"
   - "수술 후 회복기간은?"

3. **예상 결과**:
   - 신뢰도 85% 이상
   - 지식베이스 문서 기반 정확한 답변
   - 가격 정보, 시술 차이, 회복기간 정보 포함

### 시나리오 2: 거래처별 격리 테스트

1. **테스트**:
   - 힐링안과 대화에서 "치아 임플란트 비용은?" 문의

2. **예상 결과**:
   - 안과 지식베이스만 검색됨
   - 치과 정보가 포함되지 않음
   - "죄송합니다, 해당 정보는 저희 병원에서 제공하지 않는 시술입니다" 응답

## 9. 성능 모니터링

### 9.1 벡터 검색 성능 확인

```sql
-- 평균 검색 시간 측정
EXPLAIN ANALYZE
SELECT kc.chunk_text, kc.embedding <=> '[임베딩 벡터]' as distance
FROM knowledge_chunks kc
WHERE kc.tenant_id = '거래처-UUID'
ORDER BY kc.embedding <=> '[임베딩 벡터]'
LIMIT 10;
```

### 9.2 임베딩 생성 통계

```sql
-- 거래처별 문서 및 청크 통계
SELECT
  t.name as tenant_name,
  COUNT(DISTINCT kd.id) as document_count,
  COUNT(kc.id) as chunk_count,
  AVG(kc.token_count) as avg_tokens_per_chunk
FROM tenants t
LEFT JOIN knowledge_documents kd ON kd.tenant_id = t.id
LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
GROUP BY t.id, t.name
ORDER BY document_count DESC;
```

## 10. 결론

이 가이드를 따라 RAG 벡터 검색 시스템이 올바르게 작동하는지 검증할 수 있습니다. 문제 발생 시 위의 문제 해결 가이드를 참고하세요.

**중요**: 실제 프로덕션 환경에서는 정기적으로 AI 응답 로그를 검토하고, 에스컬레이션된 케이스를 학습 데이터로 활용하여 지속적으로 시스템을 개선해야 합니다.
