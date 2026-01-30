# CS 자동화 플랫폼 Phase 2 개발 계획서

## 📋 개요

**목적**: 실제 상용화를 위한 프로덕션 환경 구축
**기간**: 4주 (2026년 2월 3일 ~ 2월 28일)
**위험도**: 중간 (기존 기능 유지하면서 점진적 개선)
**핵심 목표**: 다수 직원이 안전하게 사용할 수 있는 시스템 완성

---

## ✅ 완료된 작업 (2026-01-30)

### Phase 2.1: 인증 시스템 구축 완료

#### 1. 로그인 페이지 UI (대폭 개선 - 2차)
- **위치**: `/web/src/app/(auth)/login/page.tsx`
- **디자인 1차** (초기): 작은 카드 레이아웃
- **디자인 2차** (개선 - 사용자 피드백 반영):
  - **레이아웃**: `max-w-md` → `max-w-7xl` 2단 그리드 (압도적인 넓은 레이아웃)
  - **좌측 브랜딩 섹션** (NEW):
    - 거대한 7xl 타이틀: "CS 자동화 플랫폼"
    - 2xl 환영 메시지: "오늘 하루도 수고 많으십니다. CS자동화, 현실로 경험해보세요."
    - 3개 기능 소개 카드:
      - ⚡ AI 자동 응대 (GPT-4o + Claude 혼합 모델)
      - 🌍 실시간 번역 (8개 언어 DeepL 번역)
      - 📊 통합 관리 (6개 채널 통합 인박스)
  - **우측 로그인 폼**: 전문적인 글래스모피즘 카드, h-14 대형 입력 필드
  - **배경 강화**:
    - 3층 그라디언트 (slate-950 → indigo-950 → slate-900)
    - 그리드 패턴 오버레이 (`4rem x 4rem`)
    - 향상된 글로우 필터 (SVG feGaussianBlur)
  - **네트워크 시각화 확장**: 6개 → 8개 노드
    - 기존: GPT-4o, Claude, RAG, Vector DB, Knowledge, Chat
    - 추가: DeepL, Whisper, Vision
    - 애니메이션 연결선 (Framer Motion pathLength)
- **배포 URL**: https://csflow.vercel.app/login
- **커밋**: `feat: 로그인 페이지 디자인 대폭 개선 - 압도적이고 넓은 레이아웃` (1189d32)

#### 2. 인증 인프라
- **Root 미들웨어**: `/web/middleware.ts`
  - 모든 라우트 보호 (로그인 필수)
  - 공개 경로 예외: `/login`, `/api/webhooks`, `/api/oauth`
  - 인증된 사용자가 /login 접근 시 /dashboard로 자동 리다이렉트
- **Auth 레이아웃**: `/web/src/app/(auth)/layout.tsx`
  - 그라디언트 배경 (blue → indigo → purple)
- **Auth Context**: `/web/src/contexts/auth-context.tsx`
  - `useAuth()` 훅 제공
  - 세션 관리 및 자동 새로고침
  - `signOut()` 함수
- **로그아웃 API**: `/web/src/app/api/auth/signout/route.ts`

#### 3. Supabase 사용자 생성
- **스크립트**: `/web/scripts/create-user.ts`
- **생성된 사용자**:
  - 이메일: `afformation.ceo@gmail.com`
  - 비밀번호: `afformation1!`
  - User ID: `f1b421d2-18c6-43e3-a56e-b62a504bb8ba`
  - 이메일 확인 완료 (`email_confirm: true`)

#### 4. RLS 정책 수정 (기존 데이터 접근 권한) ✅ NEW
- **문제**: 로그인 후 기존 데이터(chatdoc ceo 대화, LINE 연결, 거래처) 전부 안 보임
- **원인 분석**:
  - RLS 정책이 `users.tenant_ids` 배열로 필터링
  - `afformation.ceo@gmail.com` 사용자가 `users` 테이블에 없거나 `tenant_ids`가 비어있음
  - `SELECT` 쿼리 시 모든 데이터가 RLS에 의해 필터링됨
- **해결책**: `/web/supabase/migrations/003_fix_user_tenant_access.sql`
  - ✅ 모든 기존 거래처 ID를 `afformation.ceo@gmail.com` 사용자에게 할당
  - ✅ `users` 테이블에 사용자 레코드 생성 (admin 역할, 모든 tenant_ids 포함)
  - ✅ 향후 새 거래처 추가 시 자동으로 admin 사용자에게 할당되는 트리거 생성
  - ✅ 기존 사용자 업데이트 및 신규 사용자 생성 로직 통합 (`DO $$ ... $$`)

#### 5. 배포 완료
- **커밋 1**: `feat: 인증 시스템 구축 완료` (3dc5905)
- **커밋 2**: `feat: 로그인 페이지 디자인 대폭 개선` (1189d32)
- **푸시**: GitHub main 브랜치
- **Vercel 자동 배포**: https://csflow.vercel.app (진행 중)

---

### 🚨 사용자 필수 실행 사항

#### 1. RLS 정책 수정 SQL 실행 (필수!)

기존 데이터(대화, LINE 연결, 거래처)를 볼 수 있도록 하려면 **반드시** 아래 SQL을 Supabase에서 실행해야 합니다.

**실행 방법**:
1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택 (bfxtgqhollfkzawuzfwo)
3. 좌측 메뉴 > **SQL Editor** 클릭
4. **New Query** 클릭
5. 아래 파일 내용 전체 복사 & 붙여넣기:
   - 파일 경로: `/web/supabase/migrations/003_fix_user_tenant_access.sql`
6. **Run** 버튼 클릭
7. 성공 메시지 확인:
   - ✅ "Created new user with X tenants" 또는 "Updated existing user with X tenants"
   - ✅ 사용자 정보 테이블 출력 (email: afformation.ceo@gmail.com, role: admin, tenant_count: X)
   - ✅ 거래처 목록 테이블 출력

**SQL 실행 후 기대 결과**:
- `afformation.ceo@gmail.com` 사용자가 `users` 테이블에 생성됨
- 역할: `admin`
- `tenant_ids`: 모든 기존 거래처 ID 배열 (예: `{uuid1, uuid2, uuid3, ...}`)
- 향후 새 거래처 추가 시 자동으로 이 사용자에게 할당됨 (트리거)

#### 2. 로그인 테스트 절차 (SQL 실행 후)
1. https://csflow.vercel.app/login 접속
2. 이메일: `afformation.ceo@gmail.com`
3. 비밀번호: `afformation1!`
4. "로그인" 버튼 클릭
5. 대시보드(/dashboard)로 자동 리다이렉트 확인
6. **모든 기존 데이터 확인**:
   - ✅ chatdoc ceo와의 대화 목록
   - ✅ LINE 채널 연결 상태
   - ✅ 등록된 거래처(병원) 목록
   - ✅ 모든 메뉴 및 기능 정상 작동

---

---

## 🎯 5대 핵심 과제

### 1. 인증 시스템 구축
- **목표**: `afformation.ceo@gmail.com` 계정만 접근 가능하도록 로그인 기능 추가
- **현재 문제**: 누구나 URL만 알면 접근 가능 (보안 취약)
- **해결 방안**: Supabase Auth 기반 이메일/비밀번호 인증

### 2. LLM/RAG 파이프라인 고도화
- **목표**: AI 응답 정확도 75% → 85% 향상
- **현재 문제**:
  - 다회차 대화 맥락 미반영 (이전 대화 기억 안 함)
  - 짧은 질문에 관련 문서 검색 실패
  - 에스컬레이션 기준 단순 (키워드 기반)
- **해결 방안**: 대화 이력 통합, 쿼리 확장, 감정 분석 기반 에스컬레이션

### 3. 고급 기능 추가
- **이미지 분석 개선**: 캐싱으로 비용 60% 절감
- **카카오 알림톡 연동**: 병원 담당자에게 예약 요청 알림
- **CRM 예약 자동화**: 가능 시간대 자동 예약, 불가 시 병원에 확인 요청

### 4. CRM 연동 강화
- **예약 가능 여부 자동 확인**: CRM API로 실시간 확인
- **자동 예약 등록**: 가능하면 즉시 예약, 불가능하면 알림톡 발송
- **알림톡 템플릿**: 예약 요청, 예약 확정, 에스컬레이션 알림

### 5. 성능 최적화 및 리팩토링
- **분석 API 속도**: 70초 → 2초 (35배 개선)
- **데이터베이스 인덱스 추가**: 느린 쿼리 최적화
- **서킷 브레이커**: CRM API 장애 시 우아한 실패 처리
- **구조화된 에러 로깅**: 프로덕션 디버깅 용이

---

## 📅 4주 개발 일정

### Week 1: 인증 시스템 (2월 3일 ~ 2월 7일)

#### Day 1-2: 기본 인증 구조
- **작업**:
  - `/web/middleware.ts` 생성 (루트 미들웨어)
  - `/web/src/app/(auth)/login/page.tsx` 로그인 페이지
  - `/web/src/app/api/auth/signout/route.ts` 로그아웃 API
- **테스트**:
  - https://csflow.vercel.app 접속 → /login으로 리다이렉트 확인
  - 잘못된 비밀번호 입력 시 에러 메시지

#### Day 3: 인증 컨텍스트
- **작업**:
  - `/web/src/contexts/auth-context.tsx` 인증 상태 프로바이더
  - `/web/src/app/layout.tsx`에 AuthProvider 추가
- **테스트**:
  - 로그인 후 새로고침 시 세션 유지
  - 로그아웃 후 /dashboard 접근 시 /login 리다이렉트

#### Day 4: Supabase 사용자 생성
- **작업**:
  - Supabase 대시보드에서 사용자 생성
  - 이메일: `afformation.ceo@gmail.com`
  - 비밀번호: `afformation1!`
- **테스트**: 실제 계정으로 로그인 성공

#### Day 5: 통합 테스트
- **검증 항목**:
  - [ ] /inbox, /dashboard 등 모든 페이지 인증 필요
  - [ ] /api/webhooks/line은 여전히 public (인증 불필요)
  - [ ] 기존 기능 (메시지 전송, 번역 등) 정상 작동
  - [ ] 빌드 에러 0개

---

### Week 2: LLM/RAG 고도화 (2월 10일 ~ 2월 14일)

#### Day 1-2: 대화 이력 통합
- **문제**:
  ```
  고객: "라식 회복 기간 알려줘"
  AI: [정상 응답]
  고객: "부작용은?"
  AI: [맥락 없이 "부작용은?" 검색 → 엉뚱한 답변]
  ```
- **해결**:
  - `/web/src/services/ai/rag-pipeline.ts` 수정
  - 최근 3개 대화를 쿼리에 포함
  - "이전 대화: ... / 현재 질문: 부작용은?" 형태로 검색

- **코드 예시**:
```typescript
// Before
const query = input.query;

// After
let augmentedQuery = input.query;
if (input.conversationHistory && input.conversationHistory.length > 0) {
  const recentMessages = input.conversationHistory.slice(-3);
  const contextSummary = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");
  augmentedQuery = `이전 대화:\n${contextSummary}\n\n현재 질문: ${input.query}`;
}
```

#### Day 3: 쿼리 확장
- **문제**: "비용?" 같은 짧은 질문은 관련 문서 못 찾음
- **해결**: LLM으로 3개 대안 표현 생성
  - "비용?" → ["가격은 얼마인가요?", "수술 비용이 궁금합니다", "라식 가격 알려주세요"]
  - 모든 변형으로 검색 후 상위 5개 문서 선택

#### Day 4: 고급 신뢰도 점수
- **현재 문제**: 문서 유사도 + 불확실 표현 여부만 체크
- **개선**:
  - 응답-문서 일치도 (LLM으로 검증)
  - 환각 감지 (문서에 없는 수치/날짜 언급 시 감점)
  - 응답 완성도 (50자 이상, "..." 미포함)

#### Day 5: 감정 기반 에스컬레이션
- **현재**: "응급", "긴급" 같은 키워드만 체크
- **개선**:
  ```typescript
  const sentiment = await analyzeSentiment(message);
  if (sentiment.score < -0.6) { // 매우 부정적
    escalate = true;
    reason = "부정적 감정 감지: " + sentiment.dominantEmotion;
  }
  ```

- **테스트 케이스**:
  - "기다리느라 너무 지쳤어요" → 감정 분석으로 에스컬레이션
  - "그냥 피곤해요" → 일반 응답

---

### Week 3: 고급 기능 (2월 17일 ~ 2월 21일)

#### Day 1-2: 카카오 알림톡 구현
- **파일**: `/web/src/services/notifications/kakao-alimtalk.ts`
- **템플릿 3종**:
  1. **예약 요청 알림** (병원 담당자용)
     ```
     [{병원명}] 예약 요청

     고객명: {고객명}
     희망 날짜: {날짜}
     시술: {시술명}
     긴급도: {긴급/일반}

     예약 가능 여부를 확인해주세요.
     [승인] [거절]
     ```

  2. **예약 확정 안내** (고객용)
     ```
     [{병원명}] 예약 확정

     {고객명}님의 예약이 확정되었습니다.

     일시: {날짜} {시간}
     시술: {시술명}
     장소: {병원 주소}

     변경/취소 시 {전화번호}로 연락주세요.
     ```

  3. **긴급 문의 알림** (담당자용)
     ```
     🚨 긴급 고객 문의

     고객: {고객명}
     채널: {LINE/카카오/WhatsApp}
     내용: {요약}
     우선순위: {긴급/높음/보통}

     즉시 확인이 필요합니다.
     {대시보드 링크}
     ```

- **API 연동**:
```typescript
await sendAlimtalk({
  to: hospital.managerPhone, // 병원 담당자 번호
  templateCode: "BOOKING_REQ_001",
  variables: {
    병원명: tenant.name,
    고객명: customer.name,
    날짜: requestedDate,
    시술명: treatment,
    긴급: isUrgent ? "긴급" : "일반",
  },
});
```

#### Day 3: 이미지 분석 개선
- **캐싱 추가**:
```typescript
const cacheKey = `image:analysis:${imageUrlHash}`;
const cached = await getCached(cacheKey);
if (cached) return cached; // 24시간 캐시

const result = await analyzeImage(imageUrl);
await setCached(cacheKey, result, 86400);
```

- **Rate Limiting**:
```typescript
const rateLimited = await rateLimit("image-analysis", 10, 60);
if (!rateLimited.success) {
  throw new Error("분당 10회 제한 초과");
}
```

- **신뢰도 개선**:
```typescript
// 응답 길이 < 50자 → 신뢰도 -0.2
// "가능성", "아마도" 등 표현 → 신뢰도 -0.15
// 의료 용어 미포함 → 신뢰도 -0.1
```

#### Day 4-5: CRM 예약 자동화
- **워크플로우**:
```
고객: "다음 주 월요일에 라식 예약하고 싶어요"
    ↓
1. CRM API로 가능 여부 확인
    ↓
2a. 가능 → 즉시 예약 생성 + 고객에게 확정 알림
2b. 불가능 → 병원에 알림톡 발송 + 대기 상태 예약 생성
    ↓
3. 병원 담당자가 알림톡에서 [승인]/[거절] 클릭
    ↓
4. 승인 시 예약 확정 + 고객에게 알림
```

- **구현 파일**: `/web/src/services/booking-automation.ts`
```typescript
export async function processBookingRequest(request: BookingRequest) {
  // 1. CRM API로 가능 여부 확인
  const availability = await crmService.checkAvailability({
    tenantId: request.tenantId,
    date: request.requestedDate,
    treatment: request.treatment,
  });

  if (availability.available) {
    // 2a. 자동 예약 생성
    const booking = await crmService.createBooking({
      customerId: request.customerId,
      date: request.requestedDate,
      status: "confirmed",
    });

    // 고객에게 확정 알림
    await sendCustomerNotification(request.customerId, {
      type: "booking_confirmed",
      bookingId: booking.id,
    });

    return { success: true, bookingId: booking.id };
  } else {
    // 2b. 병원에 알림톡
    await sendAlimtalk({
      to: tenant.managerPhone,
      templateCode: "BOOKING_REQ_001",
      variables: { ... },
    });

    // 대기 상태 예약 생성
    const booking = await crmService.createBooking({
      status: "pending_confirmation",
    });

    return { success: false, bookingId: booking.id };
  }
}
```

---

### Week 4: 성능 최적화 (2월 24일 ~ 2월 28일)

#### Day 1: 분석 API 최적화
- **현재 문제**: `/api/analytics` 응답 시간 70초
  - 이유: 거래처별로 7개 쿼리 × 100개 거래처 = 700개 순차 쿼리

- **해결**: PostgreSQL 집계 함수 사용
```sql
-- 새로운 PostgreSQL 함수 생성
CREATE OR REPLACE FUNCTION get_tenant_performance(p_period_days INT)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  total_conversations BIGINT,
  total_messages BIGINT,
  ai_messages BIGINT,
  avg_response_time NUMERIC,
  escalation_count BIGINT,
  ai_accuracy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    COUNT(DISTINCT c.id) AS total_conversations,
    COUNT(m.id) AS total_messages,
    COUNT(m.id) FILTER (WHERE m.sender_type = 'ai') AS ai_messages,
    AVG(EXTRACT(EPOCH FROM (m.created_at - c.created_at)) / 60) AS avg_response_time,
    COUNT(DISTINCT e.id) AS escalation_count,
    AVG((m.metadata->>'ai_confidence')::NUMERIC) AS ai_accuracy
  FROM tenants t
  LEFT JOIN conversations c ON c.tenant_id = t.id
    AND c.created_at >= NOW() - INTERVAL '1 day' * p_period_days
  LEFT JOIN messages m ON m.conversation_id = c.id
  LEFT JOIN escalations e ON e.conversation_id = c.id
  GROUP BY t.id, t.name;
END;
$$ LANGUAGE plpgsql;
```

- **API 코드 수정** (`/web/src/app/api/analytics/route.ts`):
```typescript
// Before: 700개 순차 쿼리
for (const tenant of tenants) {
  const convCount = await supabase.from("conversations")...
  const msgCount = await supabase.from("messages")...
  // ... 5개 더
}

// After: 단일 집계 쿼리
const { data: tenantStats } = await supabase.rpc("get_tenant_performance", {
  p_period_days: periodDays,
});
```

- **결과**: 70초 → 2초 (35배 개선)

#### Day 2: 데이터베이스 인덱스 추가
```sql
-- 메시지 조회 속도 개선 (sender_type, created_at)
CREATE INDEX idx_messages_sender_type_created
ON messages(sender_type, created_at DESC);

-- 대화 필터링 속도 개선 (tenant_id, status)
CREATE INDEX idx_conversations_tenant_status
ON conversations(tenant_id, status, created_at DESC);

-- 에스컬레이션 대시보드 속도 개선
CREATE INDEX idx_escalations_status_priority
ON escalations(status, priority, created_at DESC);

-- 고객 채널 조회 속도 개선
CREATE INDEX idx_customer_channels_customer_id
ON customer_channels(customer_id);

-- AI 신뢰도 메트릭 속도 개선
CREATE INDEX idx_messages_ai_confidence
ON messages ((metadata->>'ai_confidence')) WHERE sender_type = 'ai';
```

#### Day 3: 서킷 브레이커 구현
- **문제**: CRM API가 다운되면 모든 예약 기능 완전 중단
- **해결**: 5번 실패 시 1분간 요청 중단 → 자동 복구 시도

```typescript
class CircuitBreaker {
  private failures = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      throw new Error("CRM API 일시적으로 사용 불가");
    }

    try {
      const result = await fn();
      this.onSuccess(); // 성공 시 카운터 초기화
      return result;
    } catch (error) {
      this.onFailure(); // 실패 카운트 증가
      if (this.failures >= 5) {
        this.state = "open"; // 5번 실패 시 차단
        setTimeout(() => this.state = "half-open", 60000); // 1분 후 재시도
      }
      throw error;
    }
  }
}

// 모든 CRM 호출을 서킷 브레이커로 감싸기
export async function createBooking(data: BookingData) {
  return crmCircuitBreaker.execute(() => crmApi.createBooking(data));
}
```

#### Day 4: 구조화된 에러 시스템
- **파일**: `/web/src/lib/errors.ts`
```typescript
export enum ErrorCode {
  // 인증
  AUTH_INVALID_CREDENTIALS = "AUTH_001",
  AUTH_SESSION_EXPIRED = "AUTH_002",

  // CRM 연동
  CRM_API_UNAVAILABLE = "CRM_001",
  CRM_BOOKING_CONFLICT = "CRM_002",

  // AI/LLM
  LLM_RATE_LIMIT = "AI_001",
  LLM_TIMEOUT = "AI_002",
  RAG_NO_DOCUMENTS = "AI_003",

  // 이미지 분석
  IMAGE_INVALID_FORMAT = "IMG_001",
  IMAGE_TOO_LARGE = "IMG_002",

  // 알림
  NOTIFICATION_FAILED = "NOTIF_001",
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

// 사용 예시
throw new AppError(
  ErrorCode.CRM_BOOKING_CONFLICT,
  "요청하신 시간대는 이미 예약되었습니다",
  { requestedDate, tenantId }
);
```

- **API 응답 형식**:
```json
{
  "error": {
    "code": "CRM_002",
    "message": "요청하신 시간대는 이미 예약되었습니다",
    "context": {
      "requestedDate": "2026-02-15T10:00:00Z",
      "tenantId": "8d3bd24e-0d74-4dc7-aa34-3e39d5821244"
    }
  }
}
```

#### Day 5: 통합 테스트 및 QA
- **부하 테스트** (k6):
```javascript
// 100명 동시 사용자 시뮬레이션
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100, // 100 virtual users
  duration: '5m', // 5분간 테스트
};

export default function () {
  const res = http.get('https://csflow.vercel.app/api/analytics');
  check(res, {
    '응답 시간 < 3초': (r) => r.timings.duration < 3000,
    '상태 코드 200': (r) => r.status === 200,
  });
}
```

- **검증 체크리스트**:
  - [ ] 분석 API 응답 시간 < 3초
  - [ ] 100명 동시 접속 시 에러율 < 1%
  - [ ] 캐시 히트율 > 70%
  - [ ] CRM 서킷 브레이커 정상 작동
  - [ ] 모든 API 에러 코드 반환

---

## 📊 기대 효과

### 정량적 개선

| 지표 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| **보안** | 인증 없음 | 로그인 필수 | ✅ 100% |
| **AI 정확도** | ~75% | >85% | +13% |
| **에스컬레이션율** | ~25% | <15% | -40% |
| **분석 응답 시간** | 70초 | 2초 | 97% 단축 |
| **이미지 분석 비용** | 100% | 40% | 60% 절감 |
| **시스템 가용성** | 장애 시 중단 | 우아한 실패 | ✅ 향상 |

### 정성적 개선

✅ **직원 편의성**:
- 로그인 한 번으로 모든 기능 사용
- 느린 화면 없이 쾌적한 작업 환경
- 에러 발생 시 명확한 원인 파악

✅ **AI 응답 품질**:
- 다회차 대화도 맥락 유지
- 짧은 질문에도 정확한 답변
- 감정 분석으로 불만 고객 조기 발견

✅ **업무 자동화**:
- 예약 요청 즉시 처리 또는 알림
- 병원 담당자에게 자동 전달
- CRM 연동으로 수동 입력 불필요

✅ **시스템 안정성**:
- CRM 장애 시에도 일부 기능 사용 가능
- 명확한 에러 메시지로 빠른 대응
- 데이터 손실 위험 최소화

---

## 🔒 보안 및 안정성

### 보안 강화 항목

1. **인증 보호**:
   - 모든 대시보드 페이지 로그인 필수
   - Supabase Auth의 세션 관리 (자동 갱신)
   - Webhook은 공개 유지 (채널 연동 위해)

2. **데이터 보안**:
   - RLS (Row Level Security) 활성화 유지
   - CRM API 키는 환경변수로 관리
   - 카카오 알림톡 API 키 암호화 저장

3. **에러 처리**:
   - 민감 정보 로그 미출력
   - 사용자에게는 일반 메시지, 로그에는 상세 정보

### 안정성 보장 방안

1. **점진적 배포**:
   - Week 1 완료 후 스테이징 테스트 2일
   - Week 2-4도 각각 스테이징 검증 후 배포
   - 롤백 시나리오 준비 (`NEXT_PUBLIC_DISABLE_AUTH=true`)

2. **데이터 무결성**:
   - 데이터베이스 마이그레이션은 추가만 (삭제 없음)
   - 기존 데이터 영향 없음
   - 백업 후 작업

3. **모니터링**:
   - Sentry로 에러 추적
   - Vercel Analytics로 성능 모니터링
   - Slack으로 중요 알림 수신

---

## 📁 주요 생성/수정 파일

### 신규 파일 (17개)

| 파일 | 용도 |
|------|------|
| `/web/middleware.ts` | 루트 인증 미들웨어 |
| `/web/src/app/(auth)/layout.tsx` | 로그인 페이지 레이아웃 |
| `/web/src/app/(auth)/login/page.tsx` | 로그인 UI |
| `/web/src/app/(auth)/signup/page.tsx` | 회원가입 UI (관리자용) |
| `/web/src/app/(auth)/forgot-password/page.tsx` | 비밀번호 재설정 |
| `/web/src/app/api/auth/signout/route.ts` | 로그아웃 API |
| `/web/src/contexts/auth-context.tsx` | 인증 상태 프로바이더 |
| `/web/src/services/notifications/kakao-alimtalk.ts` | 알림톡 발송 |
| `/web/src/services/booking-automation.ts` | 예약 자동화 |
| `/web/src/lib/errors.ts` | 에러 분류 시스템 |
| `/web/supabase/migrations/003_performance_indexes.sql` | DB 인덱스 |
| `/web/supabase/migrations/004_tenant_prompts.sql` | 거래처별 프롬프트 |
| `/web/supabase/functions/get_tenant_performance.sql` | 분석 집계 함수 |

### 수정 파일 (12개)

| 파일 | 수정 내용 |
|------|----------|
| `/web/src/app/layout.tsx` | AuthProvider 추가 |
| `/web/src/services/ai/rag-pipeline.ts` | 대화 이력, 쿼리 확장 |
| `/web/src/services/ai/llm.ts` | 고급 신뢰도 점수 |
| `/web/src/services/ai/image-analysis.ts` | 캐싱, Rate Limiting |
| `/web/src/services/automation/rule-engine.ts` | 감정 기반 에스컬레이션 |
| `/web/src/services/crm.ts` | 서킷 브레이커 |
| `/web/src/app/api/analytics/route.ts` | 집계 쿼리 |
| `/web/src/app/api/escalations/route.ts` | 쿼리 최적화 |
| `/web/src/lib/upstash/redis.ts` | 캐시 헬퍼 |
| `/web/.env.local` | 카카오 알림톡 키 추가 |
| `claude.md` | Section 30 추가 (Phase 2 로그) |

---

## ✅ 검증 계획

### 1단계: 기능 검증 (각 주 금요일)

**Week 1 검증**:
```
1. https://csflow.vercel.app 접속
2. /login 리다이렉트 확인
3. afformation.ceo@gmail.com / afformation1! 입력
4. /dashboard 접근 성공
5. 로그아웃 후 재접속 시 /login 이동
6. /api/webhooks/line 여전히 public 확인
```

**Week 2 검증**:
```
1. 인박스에서 "라식 비용 알려줘" 전송
2. AI 응답 확인
3. "부작용은?" 전송 (맥락 유지 테스트)
4. AI가 라식 부작용 답변하는지 확인
5. 신뢰도 점수 80% 이상인지 확인
```

**Week 3 검증**:
```
1. 고객: "다음 주 월요일 예약하고 싶어요"
2. CRM API 호출 로그 확인
3. 가능하면 자동 예약 / 불가능하면 알림톡 확인
4. 병원 담당자 폰으로 알림톡 수신 확인
```

**Week 4 검증**:
```
1. /api/analytics 호출
2. 응답 시간 3초 이내 확인
3. k6 부하 테스트 실행 (100명 동시)
4. 에러율 1% 미만 확인
```

### 2단계: 부하 테스트 (Week 4 목요일)

```bash
# k6 부하 테스트 스크립트
k6 run --vus 100 --duration 5m loadtest.js

# 목표:
# - 평균 응답 시간 < 2초
# - 95th percentile < 3초
# - 에러율 < 1%
# - 동시 접속 100명 처리
```

### 3단계: 프로덕션 배포 (Week 4 금요일)

1. **스테이징 배포** (오전):
   - 전체 기능 통합 테스트
   - 1-2명이 실제 사용 테스트

2. **프로덕션 배포** (오후):
   - Vercel 자동 배포
   - 5분간 모니터링
   - 에러 발생 시 즉시 롤백

3. **배포 후 모니터링** (1주일):
   - Sentry 에러 로그 확인
   - Slack 알림 모니터링
   - 사용자 피드백 수집

---

## 🚨 위험 요소 및 대응

| 위험 | 발생 확률 | 영향도 | 대응 방안 |
|------|-----------|--------|-----------|
| 인증이 웹훅 차단 | 중간 | 높음 | middleware에서 /api/webhooks 제외 |
| RAG 품질 저하 | 낮음 | 높음 | 신뢰도 임계값 유지 + A/B 테스트 |
| CRM API 다운 | 중간 | 높음 | 서킷 브레이커 + 우아한 실패 |
| 카카오 승인 지연 | 높음 | 중간 | 2-3일 전 신청 + Slack으로 먼저 테스트 |
| 성능 저하 | 중간 | 높음 | 조기 부하 테스트 + DB 인덱스 |
| 기존 기능 오작동 | 낮음 | 높음 | 점진적 배포 + 롤백 준비 |

---

## 💰 예상 비용 영향

### 비용 증가 항목
- **Supabase Auth**: 무료 (MAU 50,000까지)
- **Upstash Redis 캐시**: $10/월 (10GB)
- **카카오 알림톡**: ~$0.05/건 × 예상 100건/월 = $5/월

### 비용 절감 항목
- **이미지 분석**: 60% 캐시 히트율 → $30/월 절감
- **LLM 호출**: 쿼리 확장으로 정확도↑ → 재질문 감소 → $20/월 절감

**순 절감**: 약 $35/월

---

## 📞 후속 지원

### 배포 후 1주일
- 매일 에러 로그 확인
- Slack으로 이슈 즉시 대응
- 사용자 피드백 수집

### 배포 후 1개월
- 성능 메트릭 리포트
- AI 정확도 월간 통계
- 개선 사항 제안

### 장기 모니터링
- 월간 성능 리뷰
- 새로운 채널 추가 시 지원
- 추가 기능 개발 논의

---

## 📝 사용자 요구사항 (확인됨)

✅ **CRM API 문서**: 제공 가능 → 예약 자동화 구현 가능

✅ **카카오 계정**: 승인 대기 중 (2-3일) → 승인 후 즉시 연동

✅ **사용자 규모**: 1-5명
- 단일 계정(`afformation.ceo@gmail.com`)으로 충분
- 역할 관리 불필요
- 추후 개별 계정 추가 가능

✅ **개발 우선순위**: 4주 전체 진행
- Week 1: 인증 (보안)
- Week 2: RAG (품질)
- Week 3: 기능 (자동화)
- Week 4: 성능 (속도)

✅ **기존 데이터**: 모두 단일 계정에 할당
- 대화: afformation.ceo@gmail.com 소유
- 에스컬레이션: 단일 계정으로 라우팅
- 추후 재분배 가능

---

## 🎯 성공 기준

### 기술 지표
- [ ] 인증: 100% 라우트 보호 (웹훅 제외)
- [ ] RAG 정확도: >85%
- [ ] 에스컬레이션율: <15%
- [ ] 분석 응답 시간: <2초
- [ ] 이미지 캐시 히트율: >60%
- [ ] 서킷 브레이커 가동률: <5%
- [ ] 전체 에러율: <1%

### 비즈니스 지표
- [ ] 다중 직원 동시 사용: 5명 이상
- [ ] 고객 만족도: >4.5/5
- [ ] 예약 자동화율: >70%
- [ ] 병원 응답 시간: <5분
- [ ] 시스템 가용성: >99.5%

---

## 📋 Human-in-the-Loop 풀자동화 예약 시스템 (2026-01-30)

### 시스템 개요

**목적**: 고객 인입부터 예약 확정까지 AI 자동화 + 휴먼 승인 하이브리드 시스템 구축

**플로우**:
```
1. 고객 인입 (LINE 메시지)
   ↓
2. AI 자동 응대 (RAG + 예약 유도)
   ↓
3. 예약 의도 감지 → 예약 양식 전송
   ↓
4. 1차 예약 신청 로그 생성
   ↓
5. 휴먼 알림 (카카오톡/슬랙)
   ↓
6. 휴먼 승인/조율/거절
   ↓
7. CRM 자동 예약 등록 (승인 시)
   ↓
8. 고객 확정 안내
```

### 완료된 구현 (2026-01-30)

#### 1. 데이터베이스 스키마 ✅
**파일**: `/web/supabase/migrations/005_booking_automation_system.sql`

**테이블**:
- `booking_requests` - 1차 예약 신청 로그 (pending_human_approval → human_approved → confirmed)
- `human_notifications` - 카카오/슬랙 알림 추적
- `booking_intent_logs` - AI 의도 감지 로그
- `channel_accounts.full_automation_enabled` - 풀자동화 ON/OFF
- `channel_accounts.automation_config` - 자동화 설정 (예약 유도 강도, 알림 채널 등)

**함수**:
- `create_booking_request()` - AI가 예약 요청 생성
- `approve_booking_request()` - 휴먼 승인 처리
- `confirm_booking_to_crm()` - CRM 등록 완료

**뷰**:
- `pending_booking_requests` - 대기 중인 예약 (대시보드용)

#### 2. AI 예약 의도 감지 서비스 ✅
**파일**: `/web/src/services/booking/intent-detection.ts`

**기능**:
- LLM 기반 예약 의도 감지 (신뢰도 0.0~1.0)
- Intent 분류: booking_inquiry, booking_request, booking_modification, booking_cancellation
- 엔티티 추출: 날짜, 시간, 시술 종류, 특별 요청
- 다국어 폴백 키워드 매칭 (KO, EN, JA, ZH)
- 예약 양식 생성 (언어별)
- 양식 응답 파싱

#### 3. 예약 요청 관리 서비스 ✅
**파일**: `/web/src/services/booking/booking-request.ts`

**기능**:
- 예약 신청 생성 (`createBookingRequest`)
- 대기 중인 예약 조회 (`getPendingBookingRequests`)
- 휴먼 승인 처리 (`approveBookingRequest`)
- 예약 거절 (`rejectBookingRequest`)
- CRM 등록 완료 (`confirmBookingToCRM`)
- 풀자동화 모드 확인 (`isFullAutomationEnabled`)
- 자동화 설정 조회 (`getAutomationConfig`)

#### 4. RAG + 예약 통합 파이프라인 ✅
**파일**: `/web/src/services/booking/rag-booking-integration.ts`

**기능**:
- 기존 RAG에 예약 로직 통합
- 예약 의도 자동 감지
- 신뢰도 기반 액션 결정:
  - Confidence >0.9: 예약 요청 즉시 생성
  - Confidence 0.7-0.89: 예약 양식 전송
  - Confidence 0.5-0.69: 추가 정보 요청
  - Confidence <0.5: 일반 응답 + 예약 유도 멘트
- 양식 응답 자동 파싱 및 예약 생성
- 예약 확정 메시지 생성 (다국어)

#### 5. 휴먼 알림 시스템 ✅
**파일**: `/web/src/services/booking/human-notification.ts`

**기능**:
- Slack 알림 전송 (Block Kit UI, 승인/조율/거절 버튼)
- 카카오 알림톡 전송 (템플릿 기반)
- 알림 로그 저장
- 휴먼 응답 기록
- 다중 채널 자동 전송 (`notifyHumanForBookingRequest`)

### 시스템 구성

**채널별 풀자동화 설정**:
```json
{
  "full_automation_enabled": false,  // 기본값: 비활성화
  "automation_config": {
    "booking_prompt_intensity": "medium",  // low, medium, high
    "notification_channels": ["slack"],     // kakao_alimtalk, slack, email
    "auto_crm_sync": true,
    "require_human_approval": true,
    "business_hours": {
      "timezone": "Asia/Seoul",
      "weekdays": ["mon", "tue", "wed", "thu", "fri"],
      "hours": "09:00-18:00"
    }
  }
}
```

### 다음 단계

1. **API 엔드포인트 생성**:
   - `POST /api/booking/requests` - 예약 생성
   - `GET /api/booking/requests` - 대기 목록 조회
   - `PATCH /api/booking/requests/[id]/approve` - 승인
   - `POST /api/booking/notifications/slack` - Slack 인터랙션 처리

2. **휴먼 대시보드 UI**:
   - 대기 중인 예약 목록 (`/dashboard/bookings`)
   - 승인/거절 버튼
   - 대안 날짜 입력

3. **CRM 연동 완성**:
   - 승인 후 자동 CRM 등록
   - 예약 ID 매핑

4. **채널 관리 UI 업데이트**:
   - 풀자동화 모드 토글
   - 자동화 설정 편집

5. **메시지 처리 파이프라인 통합**:
   - LINE/Meta 웹훅에서 `enhancedRAGPipeline.process` 호출
   - 예약 생성 시 자동 알림 발송

---

## 📋 풀자동화 시스템 검증 현황 (2026-01-31)

### 현재 상황

#### ✅ 완료된 작업
1. **Migration 008 실행 완료** - Database RLS 정책 수정 (`public.users` 스키마 명시)
2. **Frontend tenant_id 이슈 수정** - `activeTenantId` 타입 변경 + React Query `enabled` 옵션
3. **Middleware API 401 수정** - API 호출 시 리다이렉트 대신 401 JSON 반환
4. **LINE 풀자동화 활성화** - `UPDATE channel_accounts SET full_automation_enabled = true WHERE channel_type = 'line';`
5. **배포 완료** - GitHub main 브랜치 푸시 (커밋: `61a9c22`)

#### 🔄 진행 중
- Vercel 자동 배포 (GitHub main 브랜치 푸시 시 자동 트리거)
- 지식베이스 UI 검증 대기 (75개 문서 표시 확인)

### 문제 분석 및 해결

#### 문제 1: 지식베이스 404 에러
**증상**:
```
Failed to load resource: the server responded with a status of 404 ()
GET https://csflow.vercel.app/api/knowledge/documents?tenantId=... → Redirecting...
```

**근본 원인**:
- 미들웨어가 `/api/knowledge/documents` API 호출을 인증 필수로 판단
- 인증 실패 시 `/login`으로 **리다이렉트**를 반환 ("Redirecting..." 메시지)
- 브라우저의 React Query는 JSON 데이터를 기대했지만 HTML 리다이렉트 응답을 받음
- 결과: 404 에러 + 데이터 로드 실패

**해결 방법**:
1. `/web/middleware.ts` 수정 (Line 43-62):
```typescript
// Before: 모든 경로에서 인증 실패 시 리다이렉트
if (!user && !isPublicRoute) {
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

// After: API 경로는 401 JSON 반환
const isApiRoute = request.nextUrl.pathname.startsWith("/api");

if (!user && !isPublicRoute) {
  if (isApiRoute) {
    // API 호출은 401 Unauthorized 반환 (리다이렉트 안 함)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 페이지 접근은 로그인으로 리다이렉트
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}
```

2. 커밋 및 배포:
   - 커밋: `61a9c22` "Fix: API routes return 401 instead of redirect for unauthorized access"
   - 푸시: GitHub main 브랜치
   - Vercel 자동 배포 진행 중

**기대 결과**:
- ✅ 로그인 후 API 호출 시 정상 응답 (200 OK + JSON 데이터)
- ✅ 로그인 안 한 상태로 API 호출 시 401 JSON 반환 (리다이렉트 없음)
- ✅ 지식베이스 UI에서 75개 문서 정상 표시

### 검증 절차

#### 1. Vercel 배포 확인 (2-3분 소요)
1. https://vercel.com/dashboard 접속
2. 프로젝트 선택
3. "Deployments" 탭에서 최신 배포 상태 확인
4. ✅ **Ready** (녹색) 상태 대기

#### 2. 지식베이스 UI 검증
1. **하드 새로고침 필수** (브라우저 캐시 클리어)
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + F5`
2. https://csflow.vercel.app/knowledge 접속
3. 로그인: `afformation.ceo@gmail.com / afformation1!`
4. **75개 문서 표시** 확인
5. Console 오류 없음 확인 (`tenant_id=eq.none` 에러 없음)

### 풀자동화 6단계 테스트 계획

**사전 조건**:
- ✅ Migration 008 실행 완료
- ✅ Frontend 수정 완료
- ✅ LINE 풀자동화 활성화 (`full_automation_enabled = true`)
- 🔄 지식베이스 75개 문서 표시 (Vercel 배포 후 확인)

**테스트 순서**:

#### [Stage 1] 고객 인입 (사용자 직접 테스트)
**사용자 액션**: LINE 앱에서 메시지 전송
- 예시: "안녕하세요, 라식 수술 상담받고 싶습니다"

**자동 검증**:
```sql
-- 1. 고객 자동 등록 확인
SELECT * FROM customers
WHERE id IN (
  SELECT customer_id FROM customer_channels
  WHERE channel_account_id IN (
    SELECT id FROM channel_accounts WHERE channel_type = 'line'
  )
)
ORDER BY created_at DESC
LIMIT 5;

-- 2. 대화 생성 확인
SELECT * FROM conversations
WHERE channel_account_id IN (
  SELECT id FROM channel_accounts WHERE channel_type = 'line'
)
ORDER BY created_at DESC
LIMIT 5;

-- 3. 메시지 저장 확인
SELECT * FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE channel_account_id IN (
    SELECT id FROM channel_accounts WHERE channel_type = 'line'
  )
)
ORDER BY created_at DESC
LIMIT 10;
```

#### [Stage 2] AI 자동 응대 + 예약 유도
**자동 처리**:
1. 질문 분류 (가격/시술정보/위치/고민/통역)
2. RAG 기반 답변 생성 (지식베이스 75개 문서 활용)
3. 지속적인 예약 유도 프롬프트
4. 예약 의도 감지 (신뢰도 0.7 이상)
5. 예약 양식 전송 (LINE Quick Reply)

**검증 SQL**:
```sql
-- AI 응답 로그 확인
SELECT * FROM ai_response_logs
WHERE conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY created_at DESC;

-- 예약 의도 감지 로그 확인
SELECT * FROM booking_intent_logs
WHERE customer_id = 'YOUR_CUSTOMER_ID'
ORDER BY created_at DESC;
```

**LINE 앱 확인**:
- [ ] AI 응답 메시지 수신
- [ ] 라식 수술 정보 포함
- [ ] 예약 유도 멘트 포함
- [ ] (예약 의도 감지 시) 예약 양식 전송

#### [Stage 3] 예약 정보 수집
**사용자 액션**: 예약 양식에 응답
```
1️⃣ 2026-02-15
2️⃣ 오전 10시
3️⃣ 라식
4️⃣ 일본어 통역 필요
```

**자동 처리**:
- 양식 응답 파싱
- `booking_requests` 테이블에 레코드 생성
- `status`: "pending_human_approval"

**검증 SQL**:
```sql
SELECT * FROM booking_requests
WHERE customer_id = 'YOUR_CUSTOMER_ID'
ORDER BY created_at DESC;
```

#### [Stage 4] 휴먼 알림 (Slack)
**자동 처리**:
- Slack 알림 전송 (Block Kit UI, 액션 버튼)
- `human_notifications` 테이블 로그 생성

**검증 SQL**:
```sql
SELECT * FROM human_notifications
WHERE booking_request_id = 'YOUR_BOOKING_REQUEST_ID'
ORDER BY sent_at DESC;
```

**Slack 앱 확인**:
- [ ] 알림 메시지 수신
- [ ] 예약 정보 정확히 표시
- [ ] [예약 가능] [조율 필요] [거절] 버튼 표시

#### [Stage 5] 휴먼 승인/조율/거절
**사용자 액션**: Slack에서 액션 버튼 클릭

**시나리오 A: 예약 가능**
- `booking_requests.status` → "human_approved" → "confirmed"
- CRM API 호출 → 예약 등록
- 고객에게 확정 메시지 전송

**시나리오 B: 조율 필요**
- `booking_requests.status` → "requires_coordination"
- AI가 대안 날짜 제시 메시지 전송

**시나리오 C: 거절**
- `booking_requests.status` → "rejected"
- AI가 거절 사유 + 다른 옵션 제시

**검증 SQL**:
```sql
SELECT
  br.status,
  br.approved_by,
  br.approved_at,
  br.alternative_dates,
  br.rejection_reason,
  hn.human_response
FROM booking_requests br
JOIN human_notifications hn ON hn.booking_request_id = br.id
WHERE br.id = 'YOUR_BOOKING_REQUEST_ID';
```

#### [Stage 6] CRM 연동 완료
**자동 처리** (시나리오 A 진행 시):
- CRM API 호출 → 실제 예약 등록
- `booking_requests.crm_booking_id` 설정
- `booking_requests.status` = "confirmed"
- 고객에게 확정 메시지 전송 (날짜/시간/주소/담당자)

**검증 SQL**:
```sql
SELECT
  id,
  status,
  crm_booking_id,
  confirmed_at,
  requested_date,
  requested_time,
  treatment
FROM booking_requests
WHERE status = 'confirmed'
ORDER BY confirmed_at DESC;
```

**LINE 앱 확인**:
- [ ] 예약 확정 메시지 수신
- [ ] 날짜, 시간, 장소, 주소, 담당의 정보 포함
- [ ] 병원 연락처 포함
- [ ] 변경/취소 안내 포함

### 참고 문서
- **풀자동화 체크리스트**: `/web/FULL_AUTOMATION_CHECKLIST.md`
- **Vercel 배포 가이드**: `/web/VERCEL_DEPLOYMENT_CHECK.md`
- **Frontend Tenant Fix**: `/web/FRONTEND_TENANT_FIX.md`

---

이 개발 계획서는 기존 기능을 유지하면서 프로덕션 환경에 필요한 모든 요소를 점진적으로 추가합니다. 각 단계는 독립적으로 테스트 가능하며, 문제 발생 시 안전하게 롤백할 수 있습니다.
