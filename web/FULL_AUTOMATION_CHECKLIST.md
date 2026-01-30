# 풀자동화 시스템 검증 체크리스트

## 🎯 개요

**목적**: 고객 인입부터 예약 확정까지 6단계 풀자동화 시스템 검증

**테스트 환경**:
- URL: https://csflow.vercel.app
- LINE 채널: healing_usr_1 (힐링안과)
- 거래처 ID: `8d3bd24e-0d74-4dc7-aa34-3e39d5821244`
- 풀자동화 활성화: ✅ `UPDATE channel_accounts SET full_automation_enabled = true WHERE channel_type = 'line';`

---

## ✅ 사전 조건 확인

### 1. 지식베이스 데이터 확인
- [ ] https://csflow.vercel.app/knowledge 접속
- [ ] 로그인: afformation.ceo@gmail.com / afformation1!
- [ ] **75개 문서 표시** 확인
- [ ] Console 오류 없음 (`tenant_id=eq.none` 에러 없음)

**확인 방법**:
```bash
# Supabase SQL Editor에서 실행
SELECT COUNT(*) FROM knowledge_documents
WHERE tenant_id = '8d3bd24e-0d74-4dc7-aa34-3e39d5821244';
-- 기대 결과: 75
```

### 2. 풀자동화 모드 활성화 확인
```sql
SELECT
  id,
  channel_type,
  account_name,
  full_automation_enabled,
  automation_config
FROM channel_accounts
WHERE channel_type = 'line';
```

**기대 결과**:
- `full_automation_enabled`: `true` ✅
- `automation_config`: JSON 설정 객체 존재

### 3. Migration 005 실행 확인
```sql
-- booking_requests 테이블 존재 확인
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('booking_requests', 'human_notifications', 'booking_intent_logs');
-- 기대 결과: 3
```

---

## 📋 Stage 1: 고객 인입 (LINE 메시지)

### 목표
고객이 LINE 메시지를 전송하면 자동으로 고객 등록 및 대화 생성

### 사용자 액션
1. LINE 앱 열기
2. 힐링안과 LINE 계정으로 메시지 전송
3. 예시 메시지: "안녕하세요, 라식 수술 상담받고 싶습니다"

### 자동 검증 항목

#### 1.1 고객 자동 등록 (`customers` 테이블)
```sql
-- 최근 생성된 고객 확인 (LINE 채널)
SELECT
  c.id,
  c.name,
  c.language,
  c.country,
  c.created_at,
  cc.channel_user_id,
  ca.account_name
FROM customers c
JOIN customer_channels cc ON c.id = cc.customer_id
JOIN channel_accounts ca ON cc.channel_account_id = ca.id
WHERE ca.channel_type = 'line'
ORDER BY c.created_at DESC
LIMIT 5;
```

**기대 결과**:
- ✅ 신규 고객 레코드 생성
- ✅ `language`: "ko" (한국어)
- ✅ `channel_user_id`: LINE 사용자 ID
- ✅ `created_at`: 방금 시간

#### 1.2 대화 자동 생성 (`conversations` 테이블)
```sql
-- 최근 생성된 대화 확인
SELECT
  c.id,
  c.customer_id,
  c.channel_account_id,
  c.status,
  c.ai_enabled,
  c.created_at,
  cu.name as customer_name,
  ca.account_name as channel_name
FROM conversations c
JOIN customers cu ON c.customer_id = cu.id
JOIN channel_accounts ca ON c.channel_account_id = ca.id
WHERE ca.channel_type = 'line'
ORDER BY c.created_at DESC
LIMIT 5;
```

**기대 결과**:
- ✅ 신규 대화 레코드 생성
- ✅ `status`: "active"
- ✅ `ai_enabled`: `true` (AI 자동응대 활성화)
- ✅ `customer_id`: 위에서 생성된 고객 ID와 일치

#### 1.3 메시지 저장 (`messages` 테이블)
```sql
-- 최근 메시지 확인
SELECT
  m.id,
  m.conversation_id,
  m.direction,
  m.sender_type,
  m.content,
  m.original_language,
  m.created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN channel_accounts ca ON c.channel_account_id = ca.id
WHERE ca.channel_type = 'line'
ORDER BY m.created_at DESC
LIMIT 10;
```

**기대 결과**:
- ✅ 고객 메시지 저장 (`direction`: "inbound", `sender_type`: "customer")
- ✅ `content`: "안녕하세요, 라식 수술 상담받고 싶습니다"
- ✅ `original_language`: "ko"

### Stage 1 체크리스트
- [ ] customers 테이블에 신규 고객 등록 확인
- [ ] conversations 테이블에 대화 생성 확인
- [ ] messages 테이블에 고객 메시지 저장 확인
- [ ] LINE 웹훅 로그 확인 (Vercel Logs 또는 Supabase Logs)

---

## 📋 Stage 2: AI 자동 응대 (RAG + 예약 유도)

### 목표
고객 메시지에 대해 AI가 자동으로 응답하고, 예약 의도를 감지하여 예약 양식 전송

### 자동 검증 항목

#### 2.1 질문 분류
**코드 위치**: `/web/src/services/booking/rag-booking-integration.ts`

고객 메시지 분류 (자동):
- **가격 문의**: "비용", "얼마", "price" 등
- **시술 정보**: "라식", "라섹", "스마일라식", "백내장" 등
- **위치 정보**: "어디", "주소", "찾아가는 길" 등
- **고민 상담**: "통증", "부작용", "무서워요", "걱정" 등
- **통역 요청**: "일본어", "영어", "통역" 등

#### 2.2 RAG 기반 답변 생성
```sql
-- AI 응답 로그 확인
SELECT
  id,
  conversation_id,
  query,
  response_text,
  confidence_score,
  model_used,
  retrieved_doc_count,
  created_at
FROM ai_response_logs
ORDER BY created_at DESC
LIMIT 10;
```

**기대 결과**:
- ✅ `query`: "안녕하세요, 라식 수술 상담받고 싶습니다"
- ✅ `response_text`: 라식 수술 정보 + 예약 유도 멘트
- ✅ `confidence_score`: 0.7 ~ 1.0
- ✅ `model_used`: "gpt-4" 또는 "claude-3-sonnet"
- ✅ `retrieved_doc_count`: 3 ~ 5 (검색된 지식베이스 문서 수)

#### 2.3 지속적인 예약 유도 프롬프트
**코드 위치**: `/web/src/services/booking/rag-booking-integration.ts` (Lines 100-150)

AI 응답에 포함되어야 할 요소:
- ✅ 시술 정보 설명
- ✅ 고객 공감 멘트 ("걱정되시죠?", "궁금하시군요" 등)
- ✅ 예약 유도 멘트 ("상담 예약을 도와드릴까요?", "언제 방문 가능하신가요?" 등)
- ✅ 친근하고 따뜻한 톤

#### 2.4 예약 의도 감지
**코드 위치**: `/web/src/services/booking/intent-detection.ts`

```sql
-- 예약 의도 감지 로그 확인
SELECT
  id,
  message_id,
  customer_id,
  intent_type,
  confidence,
  extracted_entities,
  created_at
FROM booking_intent_logs
ORDER BY created_at DESC
LIMIT 10;
```

**의도 분류**:
- `booking_inquiry`: "예약 가능한가요?" (정보성 질문)
- `booking_request`: "다음 주 월요일에 예약하고 싶어요" (구체적 요청)
- `booking_modification`: "예약 시간 변경하고 싶어요"
- `booking_cancellation`: "예약 취소할게요"

**기대 결과** (고객이 "예약하고 싶어요" 라고 말했을 때):
- ✅ `intent_type`: "booking_inquiry" 또는 "booking_request"
- ✅ `confidence`: 0.7 ~ 1.0
- ✅ `extracted_entities`: JSON 객체
  ```json
  {
    "date": null,
    "time": null,
    "treatment": "라식",
    "special_requests": []
  }
  ```

#### 2.5 예약 양식 전송
**신뢰도 기반 액션** (`rag-booking-integration.ts` Lines 200-250):

| 신뢰도 | 액션 | 예시 |
|--------|------|------|
| >0.9 | 즉시 예약 요청 생성 | "다음 주 월요일 오전 10시에 라식 예약해주세요" |
| 0.7-0.89 | **예약 양식 전송** | "예약하고 싶어요" |
| 0.5-0.69 | 추가 정보 요청 | "예약" |
| <0.5 | 일반 응답 + 예약 유도 | "안녕하세요" |

**예약 양식 예시** (LINE Quick Reply):
```
📅 예약 정보를 알려주세요

1️⃣ 희망 날짜: (예: 2026-02-10)
2️⃣ 희망 시간: (예: 오전 10시)
3️⃣ 시술 종류: (예: 라식)
4️⃣ 특별 요청사항: (선택사항)

위 정보를 채팅으로 보내주시면 예약 신청을 도와드리겠습니다! 😊
```

#### 2.6 LINE 앱에서 AI 응답 수신 확인
**사용자 확인 사항**:
- [ ] LINE 앱에 AI 응답 메시지 수신
- [ ] 라식 수술 정보 포함
- [ ] 예약 유도 멘트 포함
- [ ] (예약 의도 감지 시) 예약 양식 메시지 수신

### Stage 2 체크리스트
- [ ] ai_response_logs 테이블에 AI 응답 로그 확인
- [ ] booking_intent_logs 테이블에 의도 감지 로그 확인 (예약 관련 메시지 시)
- [ ] LINE 앱에서 AI 응답 수신 확인
- [ ] 응답 품질 확인 (관련성, 톤, 예약 유도)
- [ ] (예약 의도 감지 시) 예약 양식 전송 확인

---

## 📋 Stage 3: 예약 정보 수집

### 목표
고객이 예약 양식에 응답하면 예약 신청 로그 생성

### 사용자 액션
고객이 다음과 같이 응답:
```
1️⃣ 2026-02-15
2️⃣ 오전 10시
3️⃣ 라식
4️⃣ 일본어 통역 필요
```

### 자동 검증 항목

#### 3.1 양식 응답 파싱
**코드 위치**: `/web/src/services/booking/intent-detection.ts` (Lines 250-300)

파싱 결과:
```typescript
{
  date: "2026-02-15",
  time: "10:00",
  treatment: "라식",
  special_requests: ["일본어 통역 필요"]
}
```

#### 3.2 예약 신청 로그 생성
```sql
-- 예약 요청 확인
SELECT
  br.id,
  br.customer_id,
  br.tenant_id,
  br.requested_date,
  br.requested_time,
  br.treatment,
  br.special_requests,
  br.status,
  br.created_at,
  c.name as customer_name
FROM booking_requests br
JOIN customers c ON br.customer_id = c.id
ORDER BY br.created_at DESC
LIMIT 10;
```

**기대 결과**:
- ✅ 신규 예약 요청 생성
- ✅ `requested_date`: "2026-02-15"
- ✅ `requested_time`: "10:00:00"
- ✅ `treatment`: "라식"
- ✅ `special_requests`: ["일본어 통역 필요"]
- ✅ `status`: **"pending_human_approval"** (휴먼 승인 대기)
- ✅ `customer_id`, `tenant_id` 정확히 설정

### Stage 3 체크리스트
- [ ] 고객이 예약 양식에 응답 전송
- [ ] booking_requests 테이블에 신규 레코드 생성 확인
- [ ] status가 "pending_human_approval"인지 확인
- [ ] 예약 정보가 정확히 파싱되었는지 확인

---

## 📋 Stage 4: 휴먼 알림 (Slack)

### 목표
병원 담당자에게 즉시 Slack 알림 발송 (액션 버튼 포함)

### 자동 검증 항목

#### 4.1 Slack 알림 전송
**코드 위치**: `/web/src/services/booking/human-notification.ts`

```sql
-- 휴먼 알림 로그 확인
SELECT
  hn.id,
  hn.booking_request_id,
  hn.notification_channel,
  hn.sent_at,
  hn.delivery_status,
  hn.human_response,
  br.customer_id,
  br.treatment
FROM human_notifications hn
JOIN booking_requests br ON hn.booking_request_id = br.id
ORDER BY hn.sent_at DESC
LIMIT 10;
```

**기대 결과**:
- ✅ 신규 알림 레코드 생성
- ✅ `notification_channel`: "slack"
- ✅ `delivery_status`: "sent" 또는 "delivered"
- ✅ `sent_at`: 방금 시간

#### 4.2 Slack 앱에서 알림 확인
**Slack 메시지 형식** (Block Kit):
```
🔔 새로운 예약 요청

고객명: 김환자
LINE ID: healing_usr_1
희망 날짜: 2026-02-15
희망 시간: 오전 10시
시술: 라식
언어: 한국어
특이사항: 일본어 통역 필요

[예약 가능] [조율 필요] [거절]
```

**사용자 확인 사항**:
- [ ] Slack 앱에 알림 메시지 수신
- [ ] 예약 정보 정확히 표시
- [ ] 3개 액션 버튼 표시
- [ ] 고객 프로필 링크 작동 (선택사항)

### Stage 4 체크리스트
- [ ] human_notifications 테이블에 알림 로그 확인
- [ ] Slack 앱에서 알림 메시지 수신 확인
- [ ] 알림 내용이 booking_requests 데이터와 일치하는지 확인

---

## 📋 Stage 5: 휴먼 승인/조율

### 목표
병원 담당자가 Slack에서 액션 버튼 클릭 → 예약 상태 업데이트

### 사용자 액션 (3가지 시나리오)

#### 시나리오 A: 예약 가능 ✅
**담당자 액션**: Slack에서 [예약 가능] 버튼 클릭

**자동 처리**:
1. `booking_requests.status` → "human_approved"
2. CRM API 호출 → 실제 예약 등록
3. `booking_requests.status` → "confirmed"
4. 고객에게 확정 메시지 전송

#### 시나리오 B: 조율 필요 🔄
**담당자 액션**: Slack에서 [조율 필요] 버튼 클릭 → 대안 날짜 입력 (예: "2026-02-16 오후 2시")

**자동 처리**:
1. `booking_requests.status` → "requires_coordination"
2. AI가 고객에게 메시지 전송:
   ```
   죄송하지만 2월 15일 오전 10시는 예약이 어렵습니다.
   대신 2월 16일 오후 2시는 어떠신가요?
   다른 날짜를 원하시면 알려주세요! 😊
   ```
3. 고객 응답 대기

#### 시나리오 C: 거절 ❌
**담당자 액션**: Slack에서 [거절] 버튼 클릭 → 사유 입력 (예: "라식 시술 중단")

**자동 처리**:
1. `booking_requests.status` → "rejected"
2. AI가 고객에게 메시지 전송:
   ```
   죄송합니다. 현재 라식 시술은 제공하지 않고 있습니다.
   라섹이나 스마일라식 상담은 가능합니다. 관심 있으신가요?
   ```

### 자동 검증 항목

#### 5.1 예약 상태 업데이트
```sql
-- 예약 요청 상태 변경 확인
SELECT
  br.id,
  br.status,
  br.approved_by,
  br.approved_at,
  br.alternative_dates,
  br.rejection_reason,
  hn.human_response,
  hn.response_at
FROM booking_requests br
JOIN human_notifications hn ON hn.booking_request_id = br.id
WHERE br.id = 'YOUR_BOOKING_REQUEST_ID'
ORDER BY br.updated_at DESC;
```

**시나리오별 기대 결과**:

**A. 예약 가능 시**:
- ✅ `status`: "human_approved" → "confirmed"
- ✅ `approved_by`: 담당자 ID (선택사항)
- ✅ `approved_at`: 승인 시간
- ✅ `human_response`: "approved"

**B. 조율 필요 시**:
- ✅ `status`: "requires_coordination"
- ✅ `alternative_dates`: ["2026-02-16T14:00:00"]
- ✅ `human_response`: "needs_coordination"

**C. 거절 시**:
- ✅ `status`: "rejected"
- ✅ `rejection_reason`: "라식 시술 중단"
- ✅ `human_response`: "rejected"

#### 5.2 고객에게 메시지 전송 확인
```sql
-- AI가 고객에게 보낸 메시지 확인
SELECT
  m.id,
  m.conversation_id,
  m.sender_type,
  m.content,
  m.created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.customer_id = 'YOUR_CUSTOMER_ID'
  AND m.sender_type = 'ai'
ORDER BY m.created_at DESC
LIMIT 5;
```

**기대 결과**:
- ✅ AI 메시지 생성 (`sender_type`: "ai")
- ✅ 시나리오별 적절한 내용:
  - A: 확정 안내 메시지
  - B: 대안 날짜 제시 메시지
  - C: 거절 사유 + 다른 옵션 제시

### Stage 5 체크리스트
- [ ] Slack에서 액션 버튼 클릭
- [ ] booking_requests 테이블에서 status 변경 확인
- [ ] human_notifications 테이블에서 human_response 기록 확인
- [ ] LINE 앱에서 AI 응답 메시지 수신 확인
- [ ] 메시지 내용이 시나리오에 맞는지 확인

---

## 📋 Stage 6: CRM 연동 완료

### 목표
휴먼 승인 후 CRM에 실제 예약 등록 + 고객에게 확정 메시지 전송

### 사용자 액션
**시나리오 A (예약 가능)** 진행 시 자동 실행

### 자동 검증 항목

#### 6.1 CRM 예약 등록
**코드 위치**: `/web/src/services/booking/booking-request.ts` (`confirmBookingToCRM` 함수)

```sql
-- 예약 요청의 CRM 매핑 확인
SELECT
  br.id,
  br.status,
  br.crm_booking_id,
  br.confirmed_at,
  br.customer_id,
  br.treatment,
  br.requested_date,
  br.requested_time
FROM booking_requests br
WHERE br.status = 'confirmed'
ORDER BY br.confirmed_at DESC
LIMIT 10;
```

**기대 결과**:
- ✅ `status`: "confirmed"
- ✅ `crm_booking_id`: CRM에서 생성된 예약 ID (예: "CRM_BOOKING_12345")
- ✅ `confirmed_at`: CRM 등록 완료 시간

#### 6.2 CRM API 호출 로그 (선택사항)
만약 CRM 연동 로그 테이블이 있다면:
```sql
SELECT
  id,
  booking_request_id,
  crm_booking_id,
  api_response,
  created_at
FROM crm_sync_logs
ORDER BY created_at DESC
LIMIT 10;
```

#### 6.3 고객 확정 메시지 전송
```sql
-- 고객에게 전송된 확정 메시지 확인
SELECT
  m.id,
  m.conversation_id,
  m.sender_type,
  m.content,
  m.created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN booking_requests br ON c.customer_id = br.customer_id
WHERE br.status = 'confirmed'
  AND m.sender_type = 'ai'
  AND m.content LIKE '%확정%'
ORDER BY m.created_at DESC
LIMIT 5;
```

**확정 메시지 예시**:
```
✅ 예약이 확정되었습니다!

📅 날짜: 2026년 2월 15일 (토)
🕐 시간: 오전 10:00
🏥 장소: 힐링안과 강남점
📍 주소: 서울시 강남구 테헤란로 123
👨‍⚕️ 담당의: 김의사
📞 문의: 02-1234-5678

예약 변경/취소는 하루 전까지 가능합니다.
궁금하신 점이 있으시면 언제든지 말씀해주세요! 😊
```

#### 6.4 LINE 앱에서 확정 메시지 확인
**사용자 확인 사항**:
- [ ] LINE 앱에 예약 확정 메시지 수신
- [ ] 날짜, 시간, 장소, 주소, 담당의 정보 포함
- [ ] 병원 연락처 포함
- [ ] 변경/취소 안내 포함

### Stage 6 체크리스트
- [ ] booking_requests.status가 "confirmed"로 변경되었는지 확인
- [ ] booking_requests.crm_booking_id가 설정되었는지 확인
- [ ] CRM 대시보드에서 실제 예약이 생성되었는지 확인 (수동)
- [ ] LINE 앱에서 확정 메시지 수신 확인
- [ ] 확정 메시지에 모든 필수 정보가 포함되었는지 확인

---

## 📊 전체 플로우 검증 SQL

### 한 번에 전체 흐름 확인
```sql
-- 1. 고객 정보
SELECT 'CUSTOMER' as type, id, name, language, created_at
FROM customers
WHERE id = 'YOUR_CUSTOMER_ID';

-- 2. 대화 정보
SELECT 'CONVERSATION' as type, id, status, ai_enabled, created_at
FROM conversations
WHERE customer_id = 'YOUR_CUSTOMER_ID';

-- 3. 메시지 흐름 (고객 → AI → 고객)
SELECT 'MESSAGE' as type, sender_type, content, created_at
FROM messages
WHERE conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY created_at;

-- 4. 예약 의도 감지
SELECT 'INTENT' as type, intent_type, confidence, extracted_entities, created_at
FROM booking_intent_logs
WHERE customer_id = 'YOUR_CUSTOMER_ID'
ORDER BY created_at DESC;

-- 5. 예약 요청
SELECT 'BOOKING_REQUEST' as type, status, requested_date, treatment, created_at
FROM booking_requests
WHERE customer_id = 'YOUR_CUSTOMER_ID'
ORDER BY created_at DESC;

-- 6. 휴먼 알림
SELECT 'NOTIFICATION' as type, notification_channel, delivery_status, human_response, sent_at
FROM human_notifications
WHERE booking_request_id = 'YOUR_BOOKING_REQUEST_ID';

-- 7. AI 응답 로그
SELECT 'AI_RESPONSE' as type, query, confidence_score, model_used, created_at
FROM ai_response_logs
WHERE conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY created_at DESC;
```

---

## 🚨 문제 해결 가이드

### 문제 1: 고객/대화가 생성되지 않음
**증상**: LINE 메시지 전송했지만 DB에 아무것도 없음

**확인 사항**:
1. LINE webhook이 Vercel에 전달되었는지 확인
   ```bash
   # Vercel Logs 확인
   vercel logs --follow
   ```
2. LINE Channel Access Token이 유효한지 확인
3. Supabase RLS 정책 확인
   ```sql
   SELECT * FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('customers', 'conversations');
   ```

### 문제 2: AI 응답이 전송되지 않음
**증상**: 고객 메시지는 저장되었지만 AI 응답 없음

**확인 사항**:
1. `full_automation_enabled`가 true인지 확인
2. OpenAI/Claude API 키가 유효한지 확인
3. 지식베이스에 문서가 있는지 확인 (75개)
4. ai_response_logs에 에러 로그가 있는지 확인

### 문제 3: 예약 요청이 생성되지 않음
**증상**: AI 응답은 있지만 booking_requests에 레코드 없음

**확인 사항**:
1. 예약 의도 신뢰도가 0.7 이상인지 확인 (booking_intent_logs)
2. Migration 005가 실행되었는지 확인
3. 양식 응답이 올바르게 파싱되었는지 확인

### 문제 4: Slack 알림이 전송되지 않음
**증상**: booking_requests는 생성되었지만 Slack 메시지 없음

**확인 사항**:
1. Slack Webhook URL이 환경변수에 설정되었는지 확인
2. human_notifications.delivery_status 확인
3. Slack 채널 권한 확인

### 문제 5: CRM 등록 실패
**증상**: 휴먼 승인했지만 CRM에 예약 없음

**확인 사항**:
1. CRM API 키가 유효한지 확인
2. CRM API 응답 로그 확인
3. 서킷 브레이커가 열려있는지 확인

---

## ✅ 최종 체크리스트

### 지식베이스 준비
- [ ] 75개 문서 확인
- [ ] Console 오류 없음

### Stage 1: 고객 인입
- [ ] customers 테이블 레코드 생성
- [ ] conversations 테이블 레코드 생성
- [ ] messages 테이블 고객 메시지 저장

### Stage 2: AI 자동 응대
- [ ] ai_response_logs 생성
- [ ] booking_intent_logs 생성 (예약 관련 메시지 시)
- [ ] LINE 앱 AI 응답 수신
- [ ] 예약 양식 전송 (의도 감지 시)

### Stage 3: 예약 정보 수집
- [ ] booking_requests 테이블 레코드 생성
- [ ] status = "pending_human_approval"

### Stage 4: 휴먼 알림
- [ ] human_notifications 테이블 레코드 생성
- [ ] Slack 앱 알림 메시지 수신

### Stage 5: 휴먼 승인
- [ ] booking_requests.status 업데이트
- [ ] human_notifications.human_response 기록
- [ ] 고객에게 AI 메시지 전송

### Stage 6: CRM 연동
- [ ] booking_requests.status = "confirmed"
- [ ] crm_booking_id 설정
- [ ] CRM 대시보드 예약 확인
- [ ] 고객 확정 메시지 전송

---

## 📝 테스트 시나리오 예시

### 시나리오 1: 간단한 예약 요청
```
고객: 안녕하세요
AI: 안녕하세요! 힐링안과입니다. 무엇을 도와드릴까요?

고객: 라식 수술 받고 싶은데 예약 가능한가요?
AI: 네, 라식 수술 상담 예약을 도와드리겠습니다!
    아래 정보를 알려주시면 예약을 진행해드릴게요.
    [예약 양식 전송]

고객:
1️⃣ 2026-02-20
2️⃣ 오후 3시
3️⃣ 라식
4️⃣ 없음

AI: 예약 신청이 접수되었습니다! 담당자 확인 후 곧 연락드리겠습니다.
[Slack 알림 발송]

[담당자가 Slack에서 [예약 가능] 클릭]

AI: ✅ 예약이 확정되었습니다!
    📅 2026년 2월 20일 오후 3시
    🏥 힐링안과 강남점
    ...
```

### 시나리오 2: 조율이 필요한 경우
```
고객: 내일 아침 일찍 가능한가요?
AI: [예약 양식 전송]

고객: [양식 응답]

AI: 예약 신청이 접수되었습니다!
[Slack 알림 발송]

[담당자가 [조율 필요] → "2026-02-21 오전 11시" 입력]

AI: 죄송하지만 내일 아침은 어렵습니다.
    대신 2월 21일 오전 11시는 가능한데, 괜찮으신가요?

고객: 네, 괜찮아요!

AI: 감사합니다! 그럼 2월 21일 오전 11시로 확정해드리겠습니다.
[CRM 등록 → 확정 메시지 전송]
```

---

이 체크리스트를 사용하여 각 단계를 순차적으로 검증하면 풀자동화 시스템이 정상 작동하는지 확인할 수 있습니다.
