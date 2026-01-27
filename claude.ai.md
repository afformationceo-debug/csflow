# CS 자동화 플랫폼 - LLM/AI 기능 관리 문서

> **최종 감사일**: 2026-01-27
> **목적**: LLM 관련 7개 핵심 기능의 구현 상태를 추적하고 관리하는 전용 문서

---

## 전체 현황 요약

| # | 기능 | 서비스 코드 | 통합 상태 | 종합 상태 |
|---|------|-----------|----------|----------|
| 1 | DeepL 자동 번역 | ✅ 100% | ⚠️ 75% | **부분 완료** |
| 2 | AI 어시스턴트 RAG | ✅ 100% | ✅ 100% | **완료** |
| 3 | 리마인드 AI | ❌ 타입만 | ❌ 스케줄러 없음 | **미구현** |
| 4 | 이미지 인식 | ✅ 100% | ❌ 웹훅 미연결 | **연결 필요** |
| 5 | 음성 인식 | ✅ 100% | ❌ 웹훅 미연결 | **연결 필요** |
| 6 | 예약 자동 CRM 액션 | ⚠️ 서비스 존재 | ❌ 핸들러 누락 | **부분 완료** |
| 7 | 자동 태그 시스템 | ✅ 100% | ✅ 100% | **완료** |

---

## 1. 자동 번역 (DeepL API)

### 구현 상태: ⚠️ 부분 완료 (75%)

### 파일 위치
- **번역 서비스**: `web/src/services/translation.ts`
- **LINE 웹훅**: `web/src/app/api/webhooks/line/route.ts` (Lines 117-128)
- **Meta 웹훅**: `web/src/app/api/webhooks/meta/route.ts`
- **RAG 파이프라인**: `web/src/services/ai/rag-pipeline.ts` (Lines 189-198, 244-256)

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

[담당자 수동 답변] ← ❌ 미구현
  ├─ 담당자가 한국어로 입력
  ├─ DeepL로 고객 언어 번역 ← 연결 안됨
  └─ 채널 발송 ← POST /api/messages 엔드포인트 없음
```

### ✅ 완료된 부분
- DeepL API 클라이언트 (Free/Pro 자동 감지): `translation.ts:71-133`
- 번역 캐싱 (Upstash Redis, MD5 키, TTL): `translation.ts:138-167`
- 언어 감지 (한국어, 일본어, 중국어, 태국어, 아랍어, 러시아어): `translation.ts:40-59`
- 수신 메시지 자동 번역 (고객→한국어): LINE/Meta 웹훅에서 호출
- AI 응답 자동 번역 (한국어→고객 언어): RAG 파이프라인에서 호출
- `translateForCS()` 양방향 번역: `translation.ts:232-271`
- 14개 언어 지원: KO, EN, JA, ZH, ZH-TW, VI, TH, ID, DE, FR, ES, PT, RU, AR

### ❌ 미완료 부분
1. **담당자 수동 답변 번역 미연결**: 인박스 UI에서 담당자가 한국어로 입력 후 전송 시 DeepL 번역이 적용되지 않음
2. **`POST /api/messages` 엔드포인트 없음**: 담당자가 직접 메시지를 보내는 API가 없음
3. **인박스 UI → 번역 서비스 연결 없음**: UI에 번역 토글은 있으나 발신 시 실제 번역 호출 없음

### 필요한 작업
- [ ] `POST /api/messages` 라우트 생성 (담당자 발신 메시지)
- [ ] 발신 시 `translationService.translateForCS("to_customer")` 호출 연결
- [ ] 인박스 UI 전송 버튼에서 API 호출 연결

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

- **GPT-4 호출**: `llm.ts:166-174` (OpenAI SDK)
- **Claude 호출**: `llm.ts:202-207` (Anthropic SDK)
- **모델 선택**: `llm.ts:264-277` (`selectModel()`)

### AI 토글 기능 ✅

```typescript
// 테넌트 레벨: rag-pipeline.ts:162-173
if (!aiConfig?.enabled) {
  return { shouldEscalate: true, escalationReason: "AI 자동응대 비활성화됨" };
}

// 대화 레벨: line/route.ts:156-166
const aiEnabled = conversation.ai_enabled && aiConfig?.enabled;
if (!aiEnabled) { /* 담당자 대기 모드 */ }
```

- **테넌트 레벨 토글**: `tenants.ai_config.enabled` (전체 거래처 ON/OFF)
- **대화 레벨 토글**: `conversations.ai_enabled` (개별 대화 ON/OFF)
- **AI 끄면**: 자동 에스컬레이션 → 담당자 직접 응대 (기능 1번 번역으로)

### 에스컬레이션 조건 (3단계)

1. **긴급 키워드**: 응급, 출혈, 소송 등 → 즉시 에스컬레이션 (`rag-pipeline.ts:51-57`)
2. **신뢰도 미달**: < 75% (기본) → 에스컬레이션 (`rag-pipeline.ts:87-109`)
3. **민감 주제**: 가격 협상, 환불, 부작용 등 → 에스컬레이션 (`rag-pipeline.ts:114-133`)

### 신뢰도 계산

```
Retrieval (0.20) + Generation (0.25) + Factuality (0.30) + Domain (0.15) + Consistency (0.10)
= Overall Confidence Score
```

---

## 3. 리마인드 AI (미응답 자동 알림)

### 구현 상태: ❌ 미구현 (타입만 정의됨)

### 파일 위치
- **트리거 타입**: `web/src/services/automation/types.ts:18-20`
- **규칙 엔진**: `web/src/services/automation/rule-engine.ts`

### 현재 상태

```typescript
// types.ts에 타입만 정의됨
export type AutomationTrigger =
  | "no_response_24h"   // 24시간 미응답 (정의만)
  | "no_response_48h"   // 48시간 미응답 (정의만)
  | "customer_idle_7d"; // 7일 비활성 (정의만)
```

### ❌ 없는 것들
1. **스케줄러/크론 없음**: 주기적으로 미응답 대화를 체크하는 작업이 없음
2. **API 라우트 없음**: `/api/jobs/check-no-response/route.ts` 없음
3. **QStash 크론 설정 없음**: 주기적 실행을 위한 작업 큐 미설정

### 필요한 작업 (1시간 미응답 기준)
- [ ] `/api/jobs/check-no-response/route.ts` 생성
  - conversations 테이블에서 `status = 'active'` AND `last_message_at < NOW() - 1h` 조회
  - 매칭되는 대화에 리마인드 메시지 생성
  - 에스컬레이션 생성 또는 담당자 알림
- [ ] QStash 크론 설정 (5분 간격 실행 권장)
- [ ] Vercel Cron 또는 QStash 스케줄러로 주기 실행
- [ ] 리마인드 메시지 템플릿 (다국어)
- [ ] 설정 UI (리마인드 시간 조정: 1시간/2시간/24시간 등)

---

## 4. 이미지 인식 (GPT-4 Vision)

### 구현 상태: ⚠️ 서비스 완성, 웹훅 미연결

### 파일 위치
- **이미지 분석 서비스**: `web/src/services/ai/image-analysis.ts` (~398 lines)
- **LINE 웹훅**: `web/src/app/api/webhooks/line/route.ts` (연결 안됨)
- **Meta 웹훅**: `web/src/app/api/webhooks/meta/route.ts` (연결 안됨)

### ✅ 완성된 서비스 (`image-analysis.ts`)
- GPT-4V API 호출 (`model: "gpt-4o"`): Lines 58-115
- 단일 이미지 분석: `analyzeImage()`
- 시술 전후 비교 분석: `analyzeBeforeAfter()` (다중 이미지)
- 문서 OCR: `analyzeDocument()` (영수증, 신분증, 의료기록)
- 의료 이미지 전문 분석: `analyzeMedicalImage()`
- 다국어 분석 결과 반환

### ❌ 웹훅 연결 안됨

현재 LINE 웹훅 (`line/route.ts:131-144`)에서 메시지를 저장할 때 `contentType`은 기록하지만, 이미지/음성 타입에 대한 분기 처리가 없음:

```typescript
// 현재 코드 (line/route.ts)
const savedMessage = await serverMessageService.createInboundMessage({
  contentType: message.contentType, // 'image'로 저장은 됨
  mediaUrl: message.mediaUrl,       // URL도 저장됨
  // 하지만 이미지 분석 호출이 없음!
});
```

### 필요한 작업
- [ ] LINE 웹훅에 이미지 메시지 분기 추가:
  ```
  if (message.contentType === 'image' && message.mediaUrl) {
    const analysis = await imageAnalysisService.analyzeImage(message.mediaUrl);
    // 분석 결과를 RAG 파이프라인에 텍스트로 전달
  }
  ```
- [ ] Meta 웹훅에도 동일 로직 추가
- [ ] 분석 결과를 메시지 metadata에 저장
- [ ] 인박스 UI에서 이미지 분석 결과 표시

---

## 5. 음성 인식 (OpenAI Whisper)

### 구현 상태: ⚠️ 서비스 완성, 웹훅 미연결

### 파일 위치
- **음성 처리 서비스**: `web/src/services/ai/voice-processing.ts` (~296 lines)
- **LINE 웹훅**: `web/src/app/api/webhooks/line/route.ts` (연결 안됨)
- **Meta 웹훅**: `web/src/app/api/webhooks/meta/route.ts` (연결 안됨)

### ✅ 완성된 서비스 (`voice-processing.ts`)
- Whisper API 호출 (`model: "whisper-1"`): Lines 39-102
- 음성→텍스트 변환: `transcribeAudio()`
- 타임스탬프 세그먼트 지원
- 언어 자동 감지
- RAG 연결 함수: `processVoiceMessageForRAG()` (Lines 159-208)

### ❌ 웹훅 연결 안됨

기능 4(이미지)와 동일한 문제:

```typescript
// 현재: contentType만 저장, 음성 처리 없음
// 필요: if (message.contentType === 'audio') → Whisper → RAG
```

### 필요한 작업
- [ ] LINE 웹훅에 음성 메시지 분기 추가:
  ```
  if (message.contentType === 'audio' && message.mediaUrl) {
    const transcription = await voiceProcessingService.transcribeAudio(mediaUrl);
    // 텍스트 변환 결과를 RAG 파이프라인에 전달
  }
  ```
- [ ] Meta 웹훅에도 동일 로직 추가
- [ ] 변환된 텍스트를 메시지에 첨부 저장
- [ ] 인박스 UI에서 음성 메시지 + 텍스트 변환 결과 표시

---

## 6. 예약정보 자동 CRM 액션

### 구현 상태: ⚠️ 부분 완료 (서비스 존재, 핸들러 누락)

### 파일 위치
- **CRM 서비스**: `web/src/services/crm.ts`
- **CRM 동기화**: `web/src/services/crm-sync.ts`
- **자동화 타입**: `web/src/services/automation/types.ts:96,179-184`
- **규칙 엔진**: `web/src/services/automation/rule-engine.ts:463-529`

### 현재 상태

**타입 정의됨** (`types.ts:96`):
```typescript
export type ActionType =
  | "create_crm_booking"    // ← 정의됨
  | "update_crm_customer"   // ← 정의됨
  | "add_crm_note";         // ← 정의됨
```

**설정 타입 완성** (`types.ts:179-184`):
```typescript
export interface CreateCRMBookingConfig {
  type: "create_crm_booking";
  bookingType: string;
  scheduledDate?: string;
  notes?: string;
}
```

**❌ 규칙 엔진 switch에 케이스 없음** (`rule-engine.ts:467-529`):

```typescript
private async executeAction(action, context) {
  switch (action.type) {
    case "send_message": ...
    case "send_notification": ...
    case "update_conversation_status": ...
    case "add_customer_tag": ...           // ✅ 있음
    case "update_consultation_tag": ...    // ✅ 있음
    case "create_escalation": ...          // ✅ 있음
    case "send_satisfaction_survey": ...   // ✅ 있음
    case "delay": ...                      // ✅ 있음
    case "trigger_webhook": ...            // ✅ 있음
    // ❌ "create_crm_booking" 없음!
    // ❌ "update_crm_customer" 없음!
    // ❌ "add_crm_note" 없음!
    default:
      console.warn(`Unhandled action type: ${action.type}`);
  }
}
```

### 필요한 작업
- [ ] `rule-engine.ts`에 `create_crm_booking` 케이스 추가:
  ```
  case "create_crm_booking":
    await this.executeCreateCRMBooking(action.config, context);
    break;
  ```
- [ ] `executeCreateCRMBooking()` 메서드 구현 (CRM 서비스 호출)
- [ ] `update_crm_customer`, `add_crm_note` 케이스도 추가
- [ ] 예약 메시지 감지 → 자동 CRM 엔트리 생성 로직
- [ ] 대화 내 예약 정보 파싱 (날짜, 시간, 시술 유형) - LLM 기반 추출

---

## 7. 자동 태그 시스템

### 구현 상태: ✅ 완료 (100%)

### 파일 위치
- **규칙 엔진**: `web/src/services/automation/rule-engine.ts`
  - `executeAddCustomerTag()`: Lines 601-618
  - `executeUpdateConsultationTag()`: Lines 623-638
- **자동화 타입**: `web/src/services/automation/types.ts`
  - `AddCustomerTagConfig`: Lines 164-167
  - `UpdateConsultationTagConfig`: Lines 173-177

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
[no_response_24h] → add_tag("미응답24시간")  // ← 리마인드 AI 구현 후
[visit_completed] → update_consultation_tag("completed")
[escalation_created] → add_tag("에스컬레이션")
```

### 동작 방식
```typescript
// rule-engine.ts:601-618
async executeAddCustomerTag(config: { tag: string }, context) {
  const currentTags = context.customer?.tags || [];
  if (!currentTags.includes(config.tag)) {
    await supabase
      .from("customers")
      .update({ tags: [...currentTags, config.tag] })
      .eq("id", context.customerId);
  }
}
```

---

## 구현 우선순위 (권장)

| 순서 | 기능 | 이유 | 난이도 |
|------|------|------|--------|
| 1 | **기능 1 보완**: 담당자 수동 번역 연결 | 핵심 CS 기능, API만 추가 | 낮음 |
| 2 | **기능 4+5**: 이미지/음성 웹훅 연결 | 서비스 완성됨, 연결만 필요 | 낮음 |
| 3 | **기능 6**: CRM 액션 핸들러 추가 | 규칙 엔진에 케이스 추가 | 중간 |
| 4 | **기능 3**: 리마인드 AI 크론 구현 | 새로운 API + 스케줄러 필요 | 중간 |

---

## 외부 API 키 현황

| API | 상태 | 환경변수 |
|-----|------|---------|
| OpenAI (GPT-4, Whisper, Embeddings, Vision) | ✅ 설정됨 | `OPENAI_API_KEY` |
| Anthropic (Claude) | ✅ 설정됨 | `ANTHROPIC_API_KEY` |
| DeepL (번역) | ✅ 설정됨 | `DEEPL_API_KEY` |
| Upstash Redis (캐싱) | ✅ 설정됨 | `UPSTASH_REDIS_REST_URL/TOKEN` |
| Upstash Vector (벡터검색) | ✅ 설정됨 | `UPSTASH_VECTOR_REST_URL/TOKEN` |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-27 | 최초 감사 및 문서 작성 - 7개 LLM 기능 전체 점검 |
