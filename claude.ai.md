# CS 자동화 플랫폼 - LLM/AI 기능 관리 문서

> **최종 감사일**: 2026-01-28
> **목적**: LLM 관련 7개 핵심 기능의 구현 상태를 추적하고 관리하는 전용 문서

---

## 전체 현황 요약

| # | 기능 | 서비스 코드 | 통합 상태 | 종합 상태 |
|---|------|-----------|----------|----------|
| 1 | DeepL 자동 번역 | ✅ 100% | ✅ 100% | **완료** |
| 2 | AI 어시스턴트 RAG | ✅ 100% | ✅ 100% | **완료** |
| 3 | 리마인드 AI | ✅ 100% | ✅ 100% | **완료** |
| 4 | 이미지 인식 | ✅ 100% | ✅ 100% | **완료** |
| 5 | 음성 인식 | ✅ 100% | ✅ 100% | **완료** |
| 6 | 예약 자동 CRM 액션 | ✅ 100% | ✅ 100% | **완료** |
| 7 | 자동 태그 시스템 | ✅ 100% | ✅ 100% | **완료** |

---

## 1. 자동 번역 (DeepL API)

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **번역 서비스**: `web/src/services/translation.ts`
- **LINE 웹훅**: `web/src/app/api/webhooks/line/route.ts`
- **Meta 웹훅**: `web/src/app/api/webhooks/meta/route.ts`
- **RAG 파이프라인**: `web/src/services/ai/rag-pipeline.ts`
- **담당자 발신 API**: `web/src/app/api/messages/route.ts` ✅ NEW

### 동작 흐름

```
[고객 메시지 수신]
  ├─ 언어 감지 (Unicode 패턴): translation.ts:40-59
  ├─ 고객→한국어 번역 (DeepL): webhook → translationService.translateForCS("to_agent")
  ├─ 번역 캐싱 (Upstash Redis MD5 키): translation.ts:62-68, 148-164
  └─ DB 저장: messages 테이블 (original_language, translated_content)

[AI 자동 응답]
  ├─ RAG 응답 생성 (한국어)
  ├─ 한국어→고객언어 번역 (DeepL): rag-pipeline.ts:244-256
  └─ LINE/Meta 채널로 발송

[담당자 수동 답변] ✅ 구현 완료
  ├─ 담당자가 한국어로 입력
  ├─ POST /api/messages → DeepL 번역 호출 ✅
  ├─ translationService.translateForCS("to_customer") ✅
  └─ QStash 큐로 채널 발송 ✅
```

### ✅ 완료된 부분
- DeepL API 클라이언트 (Free/Pro 자동 감지): `translation.ts:71-133`
- 번역 캐싱 (Upstash Redis, MD5 키, TTL): `translation.ts:138-167`
- 언어 감지 (한국어, 일본어, 중국어, 태국어, 아랍어, 러시아어): `translation.ts:40-59`
- 수신 메시지 자동 번역 (고객→한국어): LINE/Meta 웹훅에서 호출
- AI 응답 자동 번역 (한국어→고객 언어): RAG 파이프라인에서 호출
- `translateForCS()` 양방향 번역: `translation.ts:232-271`
- 14개 언어 지원: KO, EN, JA, ZH, ZH-TW, VI, TH, ID, DE, FR, ES, PT, RU, AR
- **`POST /api/messages` 엔드포인트**: 담당자 발신 메시지 + 자동 번역 ✅
- **대화 내 고객 언어 자동 감지 → DeepL 번역 적용** ✅

---

## 2. AI 어시스턴트 RAG 파이프라인

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **RAG 파이프라인**: `web/src/services/ai/rag-pipeline.ts`
- **문서 검색 (Retriever)**: `web/src/services/ai/retriever.ts`
- **LLM 라우터**: `web/src/services/ai/llm.ts`
- **임베딩 서비스**: `web/src/services/ai/embeddings.ts`
- **Upstash Vector**: `web/src/services/upstash-vector.ts`

### RAG 데이터 소스

| DB / 소스 | 구현 상태 | 파일 위치 | 설명 |
|-----------|----------|----------|------|
| **병원별 벡터 DB** (pgvector) | ✅ | `retriever.ts:45-53` | `knowledge_documents` 테이블, VECTOR(1536) |
| **풀텍스트 검색** (PostgreSQL FTS) | ✅ | `retriever.ts:126-140` | `knowledge_documents` tsvector |
| **Upstash Vector** (대안) | ✅ | `upstash-vector.ts` | 고속 벡터 검색, 테넌트 네임스페이스 격리 |
| **대화 히스토리** | ✅ | `rag-pipeline.ts:18` | `conversationHistory` 파라미터로 전달 |
| **에스컬레이션 피드백** | ✅ | Progressive Learning Loop | 에스컬레이션 → 지식 자동 추출 |
| **AI 응답 로그** | ✅ | `rag-pipeline.ts:298-316` | `ai_response_logs` 테이블 |

### 하이브리드 검색 (RRF 알고리즘)

```
Query → [Vector Search (pgvector)] + [Full-text Search (PostgreSQL)]
            │                              │
            └──── RRF Merge ───────────────┘
                      │
              Ranked Documents (Top 5)
```
- **Vector Search**: `match_documents` RPC, cosine similarity
- **Full-text Search**: PostgreSQL FTS, BM25 랭킹
- **RRF (Reciprocal Rank Fusion)**: `retriever.ts:163-201`
- **Threshold**: 0.65 (최소 유사도)

### LLM 라우팅

| 조건 | 모델 | 이유 |
|------|------|------|
| 단순 FAQ | GPT-4 | 빠름, 저비용 |
| 복잡한 의료 상담 | Claude | 정확도, 긴 컨텍스트 |
| 멀티턴 대화 | Claude | 대화 맥락 유지 |
| 테넌트 설정 우선 | 설정값 | `ai_config.model` |

### 에스컬레이션 조건 (3단계)

1. **긴급 키워드**: 응급, 출혈, 소송 등 → 즉시 에스컬레이션
2. **신뢰도 미달**: < 75% (기본) → 에스컬레이션
3. **민감 주제**: 가격 협상, 환불, 부작용 등 → 에스컬레이션

### 신뢰도 계산

```
Retrieval (0.20) + Generation (0.25) + Factuality (0.30) + Domain (0.15) + Consistency (0.10)
= Overall Confidence Score
```

---

## 3. 리마인드 AI (미응답 자동 알림)

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **크론 API 라우트**: `web/src/app/api/jobs/check-no-response/route.ts` ✅ NEW
- **트리거 타입**: `web/src/services/automation/types.ts`
- **규칙 엔진**: `web/src/services/automation/rule-engine.ts`
- **Slack 알림**: `web/src/services/slack-notification.ts`

### 동작 흐름

```
[Vercel Cron / QStash 스케줄러] (5분 간격)
  │
  ▼
GET /api/jobs/check-no-response
  │
  ├─ conversations 테이블 쿼리:
  │   status IN ('active', 'waiting') AND
  │   last_message_at < NOW() - threshold (기본 60분)
  │
  ├─ 각 대화에 대해:
  │   ├─ 마지막 메시지가 인바운드(고객 발신)인지 확인
  │   ├─ 기존 에스컬레이션 중복 체크
  │   ├─ 에스컬레이션 생성 (reason: "미응답 알림")
  │   ├─ 대화 상태 → 'escalated' 변경
  │   ├─ 고객 태그에 "미응답" 추가
  │   ├─ Slack 알림 발송 (Block Kit UI)
  │   └─ 자동화 규칙 트리거 (no_response)
  │
  └─ 처리 결과 JSON 응답
```

### ✅ 구현된 기능
- **Vercel Cron 지원**: GET 핸들러, `Authorization: Bearer CRON_SECRET` 인증
- **QStash 지원**: POST 핸들러, 서명 검증
- **설정 가능한 임계값**: `NO_RESPONSE_THRESHOLD_MINUTES` 환경변수 (기본 60분)
- **중복 방지**: 이미 에스컬레이션된 대화 건너뜀
- **Slack 알림**: 미응답 전용 알림 (대기 시간 표시)
- **자동화 규칙 연동**: `no_response` 트리거 발행
- **고객 태그 자동 추가**: "미응답" 태그

---

## 4. 이미지 인식 (GPT-4 Vision)

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **이미지 분석 서비스**: `web/src/services/ai/image-analysis.ts` (~398 lines)
- **LINE 웹훅**: `web/src/app/api/webhooks/line/route.ts` (Step 5.5) ✅ 연결 완료
- **Meta 웹훅**: `web/src/app/api/webhooks/meta/route.ts` (Step 5.5) ✅ 연결 완료

### ✅ 완성된 서비스 (`image-analysis.ts`)
- GPT-4V API 호출 (`model: "gpt-4o"`): Lines 58-115
- 단일 이미지 분석: `analyzeImage()`
- 시술 전후 비교 분석: `analyzeBeforeAfter()` (다중 이미지)
- 문서 OCR: `analyzeDocument()` (영수증, 신분증, 의료기록)
- 의료 이미지 전문 분석: `analyzeMedicalImage()`
- 다국어 분석 결과 반환

### ✅ 웹훅 연결 완료

```typescript
// LINE/Meta 웹훅 Step 5.5 (메시지 저장 후, AI 처리 전)
if (message.contentType === "image" && message.mediaUrl) {
  const analysis = await analyzeImage(message.mediaUrl, {
    tenantId,
    context: messageText,
    language: originalLanguage === "KO" ? "ko" : originalLanguage?.toLowerCase(),
  });
  // 이미지 설명을 RAG 텍스트로 사용
  messageText = analysis.suggestedResponse || analysis.description;
  // 분석 결과를 메시지 metadata에 저장
  // image_analysis: { category, tags, medical_relevance, confidence }
}
```

---

## 5. 음성 인식 (OpenAI Whisper)

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **음성 처리 서비스**: `web/src/services/ai/voice-processing.ts` (~296 lines)
- **LINE 웹훅**: `web/src/app/api/webhooks/line/route.ts` (Step 5.5) ✅ 연결 완료
- **Meta 웹훅**: `web/src/app/api/webhooks/meta/route.ts` (Step 5.5) ✅ 연결 완료

### ✅ 완성된 서비스 (`voice-processing.ts`)
- Whisper API 호출 (`model: "whisper-1"`): Lines 39-102
- 음성→텍스트 변환: `transcribeAudio()`
- 타임스탬프 세그먼트 지원
- 언어 자동 감지
- RAG 연결 함수: `processVoiceMessageForRAG()` (Lines 159-208)

### ✅ 웹훅 연결 완료

```typescript
// LINE/Meta 웹훅 Step 5.5
if (message.contentType === "audio" && message.mediaUrl) {
  const transcription = await transcribeVoiceFromUrl(message.mediaUrl, {
    language: originalLanguage?.toLowerCase(),
  });
  // 텍스트 변환 결과를 RAG에 전달
  messageText = transcription.text;
  // 변환 결과를 메시지 metadata에 저장
  // voice_transcription: { duration, confidence, language, segments }

  // 한국어가 아닌 경우 번역도 수행
  if (transcription.language !== "ko") {
    const translation = await translationService.translateForCS(
      transcription.text, "to_agent"
    );
    // DB에 번역 저장
  }
}
```

---

## 6. 예약정보 자동 CRM 액션

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **CRM 서비스**: `web/src/services/crm.ts`
- **CRM 동기화**: `web/src/services/crm-sync.ts`
- **자동화 타입**: `web/src/services/automation/types.ts`
- **규칙 엔진**: `web/src/services/automation/rule-engine.ts` ✅ 핸들러 추가 완료

### ✅ 구현 완료

**규칙 엔진 switch 케이스 (rule-engine.ts)**:
```typescript
private async executeAction(action, context) {
  switch (action.type) {
    case "send_message": ...
    case "send_notification": ...
    case "update_conversation_status": ...
    case "add_customer_tag": ...           // ✅
    case "update_consultation_tag": ...    // ✅
    case "create_escalation": ...          // ✅
    case "send_satisfaction_survey": ...   // ✅
    case "delay": ...                      // ✅
    case "trigger_webhook": ...            // ✅
    case "create_crm_booking": ...         // ✅ NEW
    case "update_crm_customer": ...        // ✅ NEW
    case "add_crm_note": ...              // ✅ NEW
  }
}
```

### 구현된 CRM 액션 핸들러

#### `create_crm_booking`
- `crm_customer_id`로 고객 조회
- `crmService.createBooking()` 호출
- 예약 타입, 날짜, 메모 전달

#### `update_crm_customer`
- `crm_customer_id`로 고객 조회
- `crmService.updateCustomer()` 호출
- 자유 형식 필드 업데이트

#### `add_crm_note`
- `crm_customer_id`로 고객 조회
- `crmService.addNote()` 호출
- CRM API 실패 시 로컬 `internal_notes` 테이블에 폴백 저장

---

## 7. 자동 태그 시스템

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **규칙 엔진**: `web/src/services/automation/rule-engine.ts`
  - `executeAddCustomerTag()`: Lines 601-618
  - `executeUpdateConsultationTag()`: Lines 623-638
- **자동화 타입**: `web/src/services/automation/types.ts`

### 지원되는 태그 유형

#### 고객 태그 (`add_customer_tag`)
- 자유 형식: 어떤 문자열이든 태그로 추가 가능
- 배열 형태: `customers.tags TEXT[]` 컬럼
- 중복 방지: 이미 있는 태그는 추가하지 않음

#### 상담 태그 (`update_consultation_tag`)
- **가망** (prospect): 관심 표현
- **잠재** (potential): 적극적 문의
- **1차예약** (first_booking): 상담 예약 완료
- **확정예약** (confirmed): 시술 예약 확정
- **시술완료** (completed): 시술/방문 완료
- **취소** (cancelled): 예약 취소

#### 자동화 트리거 조합 예시
```
[message_received] + [message.content contains "예약"] → add_tag("예약문의")
[booking_confirmed] → update_consultation_tag("confirmed")
[no_response] → add_tag("미응답") + 에스컬레이션 ✅ (리마인드 AI 연동)
[visit_completed] → update_consultation_tag("completed")
[escalation_created] → add_tag("에스컬레이션")
```

---

## 외부 API 키 현황

| API | 상태 | 환경변수 |
|-----|------|---------|
| OpenAI (GPT-4, Whisper, Embeddings, Vision) | ✅ 설정됨 | `OPENAI_API_KEY` |
| Anthropic (Claude) | ✅ 설정됨 | `ANTHROPIC_API_KEY` |
| DeepL (번역) | ✅ 설정됨 | `DEEPL_API_KEY` |
| Upstash Redis (캐싱) | ✅ 설정됨 | `UPSTASH_REDIS_REST_URL/TOKEN` |
| Upstash Vector (벡터검색) | ✅ 설정됨 | `UPSTASH_VECTOR_REST_URL/TOKEN` |
| Facebook Messenger | ✅ 설정됨 | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FB_WEBHOOK_VERIFY_TOKEN` |
| Instagram DM | ✅ 설정됨 | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `IG_WEBHOOK_VERIFY_TOKEN` |
| WhatsApp Business | ✅ 설정됨 | `WHATSAPP_VERIFY_TOKEN`, `NEXT_PUBLIC_WA_CONFIG_ID` |
| Meta OAuth | ✅ 설정됨 | `META_OAUTH_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN` |
| LINE Messaging API | ✅ 설정됨 | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ID` |
| Slack Notifications | ✅ 설정됨 | `SLACK_BOT_TOKEN` |
| Sentry 에러 모니터링 | ✅ 설정됨 | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` |

---

## 메신저 채널 연동 설정

### Webhook URL (Vercel 프로덕션)

| 채널 | Webhook URL | Verify Token |
|------|------------|-------------|
| LINE | `https://csflow.vercel.app/api/webhooks/line` | (LINE Channel Secret으로 서명 검증) |
| Facebook Messenger | `https://csflow.vercel.app/api/webhooks/meta` | `hi` |
| Instagram DM | `https://csflow.vercel.app/api/webhooks/meta` | `impakers-best` |
| WhatsApp Business | `https://csflow.vercel.app/api/webhooks/meta` | `hello` |
| KakaoTalk | `https://csflow.vercel.app/api/webhooks/kakao` | (향후 설정) |
| WeChat | `https://csflow.vercel.app/api/webhooks/wechat` | (향후 설정) |

### Meta 통합 Webhook 구조

```
모든 Meta 플랫폼 (FB, IG, WhatsApp) → /api/webhooks/meta
  ├─ GET: Webhook 구독 검증 (hub.verify_token으로 검증)
  │   └─ FB_WEBHOOK_VERIFY_TOKEN / IG_WEBHOOK_VERIFY_TOKEN / WHATSAPP_VERIFY_TOKEN 중 하나와 매칭
  │
  └─ POST: 메시지 수신 처리
      ├─ x-hub-signature-256 헤더로 서명 검증 (FACEBOOK_APP_SECRET 또는 INSTAGRAM_APP_SECRET)
      ├─ payload.object로 플랫폼 감지:
      │   ├─ "page" → Facebook Messenger
      │   ├─ "instagram" → Instagram DM
      │   └─ "whatsapp_business_account" → WhatsApp Business
      └─ 각 어댑터의 parseWebhook()으로 메시지 파싱 → processInboundMessage() 공통 처리
```

### 채널 연동 테스트 방법

#### 1단계: Meta Developer App 설정
각 플랫폼별 Meta App Dashboard에서:
1. **Products** > **Webhooks** 추가
2. **Callback URL**: `https://csflow.vercel.app/api/webhooks/meta`
3. **Verify Token**: 각 플랫폼에 맞는 토큰 입력
4. **구독 필드** 선택:
   - Facebook: `messages`, `messaging_postbacks`
   - Instagram: `messages`, `messaging_postbacks`
   - WhatsApp: `messages`

#### 2단계: 각 채널 테스트

**Facebook Messenger 테스트:**
1. Facebook App Dashboard > Messenger > 설정
2. Webhook URL/Verify Token 등록 후 Subscribe
3. 연결된 Facebook Page에 메시지 보내기
4. Vercel 로그에서 webhook 수신 확인

**Instagram DM 테스트:**
1. Instagram App Dashboard > Instagram > 설정
2. Webhook URL/Verify Token 등록 후 Subscribe
3. Instagram 비즈니스 계정으로 DM 보내기
4. Vercel 로그에서 webhook 수신 확인

**WhatsApp Business 테스트:**
1. Meta Business Suite > WhatsApp > 설정
2. Webhook URL/Verify Token 등록
3. WhatsApp Business 테스트 번호로 메시지 보내기
4. Vercel 로그에서 webhook 수신 확인

**LINE 테스트:**
1. LINE Developers Console > Messaging API 채널
2. Webhook URL: `https://csflow.vercel.app/api/webhooks/line`
3. Webhook 활성화
4. LINE 앱에서 봇에 메시지 보내기 (@246kdolz)
5. Vercel 로그에서 webhook 수신 확인

#### 3단계: Vercel 로그 확인
```bash
# Vercel CLI로 실시간 로그 모니터링
npx vercel logs csflow.vercel.app --follow

# 또는 Vercel Dashboard > Deployments > Functions 탭에서 확인
```

#### 4단계: Supabase에서 데이터 확인
1. https://supabase.com/dashboard > SQL Editor
2. 쿼리 실행:
```sql
-- 수신된 메시지 확인
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;

-- 생성된 대화 확인
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 10;

-- 고객 정보 확인
SELECT * FROM customers ORDER BY created_at DESC LIMIT 10;
```

---

## Vercel 배포 설정

### 프로덕션 환경
- **URL**: https://csflow.vercel.app
- **프로젝트**: csflow (prj_RdfmNnACP9EuB2cQexo7XLZWok58)
- **팀**: afformationceo-4012s-projects
- **GitHub**: afformationceo-debug/csflow
- **Root Directory**: web
- **Framework**: nextjs

### 환경변수 설정 완료 (Vercel Dashboard + .env.local)
- 총 33개 환경변수 설정됨 (AI/번역/캐싱/메신저/모니터링)
- Meta 플랫폼 10개 변수 추가 (2026-01-28)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-27 | 최초 감사 및 문서 작성 - 7개 LLM 기능 전체 점검 |
| 2026-01-27 | 기능 1 완료: POST /api/messages 엔드포인트 + DeepL 발신 번역 연결 |
| 2026-01-27 | 기능 3 완료: /api/jobs/check-no-response 크론 API + Slack 알림 |
| 2026-01-27 | 기능 4+5 완료: LINE/Meta 웹훅에 이미지(GPT-4V)/음성(Whisper) 처리 연결 |
| 2026-01-27 | 기능 6 완료: rule-engine.ts에 CRM 액션 핸들러 3개 추가 |
| 2026-01-27 | 7/7 LLM 기능 모두 구현 완료 |
| 2026-01-27 | Vercel 배포 404 오류 수정: vercel.json 생성 + TypeScript 빌드 에러 수정 |
| 2026-01-28 | 7/7 LLM 기능 재검증 - 전체 PASS 확인 |
| 2026-01-28 | Meta 플랫폼 환경변수 설정 (FB/IG/WA App ID, Secret, Verify Token) |
| 2026-01-28 | Meta 웹훅 핸들러 개선: 플랫폼별 개별 Verify Token 및 App Secret 지원 |
| 2026-01-28 | Vercel 프로덕션 환경변수 10개 추가 등록 |
| 2026-01-28 | 메신저 연동 테스트 가이드 작성 |
