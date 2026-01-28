# CS 자동화 플랫폼 - 종합 개발 문서

## 프로젝트 개요

**목적**: 50개 이상의 메신저 계정(라인, 왓츠앱, 페이스북, 인스타그램 등)을 통합 관리하고, LLM RAG 기반 자동 응대와 CRM 연동을 제공하는 해외환자유치 CS 자동화 플랫폼

**핵심 가치**:
- 모든 메신저 채널을 하나의 인터페이스에서 고객별로 통합 관리
- 자동 번역으로 다국어 실시간 소통 (DeepL)
- AI 자동 응대로 24/7 고객 서비스 (GPT-4 + Claude 혼용)
- 거래처별 학습 시스템으로 점진적 품질 향상

---

## 개발 현황 요약

### 완료된 작업 (2026-01-28 기준)

#### 1. 프로젝트 기반 구축 ✅
- Next.js 14 프로젝트 생성 (App Router, TypeScript)
- Tailwind CSS + shadcn/ui 설정
- 환경변수 설정 구조
- 프로젝트 폴더 구조 생성

#### 2. 데이터베이스 스키마 ✅
- **Supabase 스키마 적용 완료** (`web/supabase/schema.sql`)
- Supabase 타입 정의 (`web/src/lib/supabase/types.ts`)
- 전체 테이블 스키마 완성:
  - tenants (거래처)
  - channel_accounts (채널 계정)
  - customers (고객)
  - customer_channels (고객-채널 연결)
  - conversations (대화)
  - messages (메시지)
  - knowledge_documents (지식베이스)
  - knowledge_chunks (지식 청크 - 벡터 검색용)
  - escalations (에스컬레이션)
  - ai_response_logs (AI 응답 로그)
  - automation_rules (자동화 규칙)
  - **internal_notes (내부 노트 - Channel.io 참고)** ✅ NEW
  - bookings (예약)

#### 3. AI/RAG 서비스 레이어 ✅
- **임베딩 서비스** (`web/src/services/ai/embeddings.ts`)
  - OpenAI text-embedding-3-small 연동
  - 텍스트 청킹 로직
  - Lazy initialization 패턴 적용

- **LLM 서비스** (`web/src/services/ai/llm.ts`)
  - GPT-4 + Claude 혼용 라우팅
  - 복잡도 기반 모델 선택
  - Lazy initialization 패턴 적용

- **RAG Retriever** (`web/src/services/ai/retriever.ts`)
  - 벡터 검색 (pgvector)
  - 풀텍스트 검색
  - Hybrid Search (RRF 알고리즘)

- **RAG Pipeline** (`web/src/services/ai/rag-pipeline.ts`)
  - 전체 RAG 워크플로우
  - 신뢰도 계산
  - 에스컬레이션 조건 체크
  - 응답 로깅

#### 4. 핵심 서비스 레이어 ✅
- **대화 서비스** (`web/src/services/conversations.ts`)
- **메시지 서비스** (`web/src/services/messages.ts`)
- **고객 서비스** (`web/src/services/customers.ts`)
  - 상담 태그 업데이트 기능 추가 (가망/잠재/1차예약/확정예약/시술완료/취소)
- **에스컬레이션 서비스** (`web/src/services/escalations.ts`)
- **지식베이스 서비스** (`web/src/services/knowledge-base.ts`)
- **번역 서비스** (`web/src/services/translation.ts`) - DeepL API
- **내부 노트 서비스** (`web/src/services/internal-notes.ts`) ✅ NEW
  - 팀원 간 내부 코멘트 기능 (Channel.io 참고)
  - @멘션 지원

#### 5. 인프라 서비스 ✅
- **Upstash Redis** (`web/src/lib/upstash/redis.ts`)
  - 캐시 헬퍼 함수
  - Optional initialization (환경변수 없어도 빌드 가능)

- **Upstash QStash** (`web/src/lib/upstash/qstash.ts`)
  - 작업 큐 정의
  - Optional initialization

#### 6. API Routes ✅
- `/api/webhooks/line` - LINE 웹훅 핸들러
- `/api/jobs/process-message` - 메시지 처리 작업
- `/api/jobs/send-message` - 메시지 발송 작업
- `/api/jobs/escalation-notify` - 에스컬레이션 알림

#### 7. 빌드 및 실행 확인 ✅
- TypeScript 빌드 성공
- 개발 서버 정상 실행 (localhost:3000)
- 환경변수 없이도 빌드 가능하도록 방어 코드 적용

#### 8. 통합 인박스 UI (Phase 1) ✅ NEW
- **대시보드 레이아웃** (`web/src/app/(dashboard)/layout.tsx`)
  - 사이드바 + 헤더 구조
  - 접기/펼치기 기능

- **통합 인박스 페이지** (`web/src/app/(dashboard)/inbox/page.tsx`)
  - 3단 레이아웃 (고객목록 - 대화창 - 정보패널)
  - **상담 태그 시스템** (Channel.io 참고)
    - 가망/잠재/1차예약/확정예약/시술완료/취소
    - 필터 및 드롭다운 선택 UI
  - **내부대화 분리** (Channel.io 참고)
    - 전체/고객대화/내부노트 탭으로 분리
    - 내부 노트 작성 토글
    - @멘션 기능
  - **번역 토글** - 원문/번역 간편 전환
  - **AI BOT 라벨** - AI 응답 명확히 구분 + 신뢰도 표시
  - 채널별 컬러 구분 (LINE, WhatsApp, 카카오 등)

#### 9. 인박스 UI 고도화 (2026-01-28) ✅ NEW
- **리사이즈 가능한 3단 패널** (`react-resizable-panels v4`)
  - ResizablePanelGroup (orientation: horizontal)
  - 고객목록(28%) / 대화창(44%) / 정보패널(28%) 기본 비율
  - 최소/최대 크기 제한 (minSize/maxSize)
  - 드래그 핸들로 크기 조절

- **멀티 거래처 필터링** (50+ 병원 지원)
  - HospitalMultiSelect: 검색 가능한 멀티 체크박스 콤보박스
  - 10개 병원 프리셋 (힐링안과, 청담봄온의원, 서울성형외과 등)
  - 색상 코딩된 병원 배지
  - 전체 선택/해제 기능
  - 선택된 병원만 대화 필터링

- **태그 시스템 전면 개편** (3카테고리)
  - 상담태그 (ConsultationTag): 초진/재진/수술상담/시술상담/가격문의/예약변경/불만접수/일반문의
  - 상태태그 (StatusTag): 가망/잠재/1차예약/확정예약/시술완료/사후관리/VIP전환/이탈
  - 고객태그 (CustomerTag): VIP/리피터/가격문의/불만고객/인플루언서/현지에이전트/통역필요/보험문의
  - TagFilterPanel: 팝오버 기반 카테고리별 멀티 선택
  - 활성 필터 칩 표시 + 개별 제거 가능
  - 색상 코딩된 태그 배지 (카테고리별 다른 색상)

- **채팅 스크롤 수정**
  - native `overflow-y-auto` div + `useRef` 사용
  - `messagesEndRef`로 자동 스크롤
  - 대화 전환 시 자동 하단 이동 (`useEffect`)
  - 스크롤-투-바텀 플로팅 버튼 (AnimatePresence)

- **CS 직원 편의 기능**
  - 빠른 답변 템플릿 (Quick Reply) - 인사/예약안내/가격안내/감사인사 등
  - 키보드 단축키 (⌘K 검색, Escape 초기화)
  - 메시지 호버 액션 (복사, 답장)
  - 감정 분석 인디케이터 (대화 헤더)
  - AI 전환 확률 점수 (고객 프로필)
  - 대화 고정/북마크 기능
  - 담당자 표시 (어사인)
  - 시스템 메시지 구분 표시
  - Enter 전송 / Shift+Enter 줄바꿈
  - 긴급/대기 건수 하단 퀵 스탯

---

## 경쟁사 분석: Channel.io

### Channel.io 주요 UI/기능 분석 (2026-01-27)

Channel.io(채널톡)의 실제 사용 화면 분석 결과:

#### 1. 수신함 (Inbox) 구조
```
┌─────────────────────────────────────────────────────────────────────┐
│ 좌측 사이드바                                                        │
│ ├─ 팀챗                                                             │
│ ├─ 수신함 (메인)                                                    │
│ ├─ AI (ALF)                                                         │
│ ├─ 고객 연락처                                                      │
│ ├─ 오퍼레이션                                                       │
│ ├─ 도큐먼트                                                         │
│ ├─ 마케팅                                                           │
│ └─ 팀 ALF                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ 수신함 필터 영역                                                     │
│ ├─ 전체 (63)                                                        │
│ ├─ 담당자별: 어포메이션, 강상우, 이청선, SUZUKI SHOKO              │
│ ├─ 상태별: 진행중/보류중/부재중/종료됨                              │
│ ├─ 서비스: 채널톡 메시지, 이메일, 라인 Official Account             │
│ └─ 상담 태그: 가망, 관리필요, 예약취소, 인플, 잠재, 확정예약, 1차예약│
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. 대화 화면 구성
- **좌측**: 고객 목록 (이름, 담당자, 최근 메시지, 태그 표시)
- **중앙**: 대화 타임라인 (메시지 + 시스템 이벤트)
  - 번역보기 버튼으로 원문/번역 토글
  - 내부대화(팀챗)와 고객응대 분리
  - AI BOT 응답 표시 ("확인필요" 등)
- **우측**: 고객 정보 패널
  - 담당자/팔로워 할당
  - 상담 정보 (유입페이지, 상담태그, CSAT)
  - 고객 정보 (이름, 이메일, 휴대폰, 최근접속)
  - 상담 목록, 보낸 메시지 목록, 파일/링크 모음

#### 3. 참고할 좋은 기능
| 기능 | 설명 | 우리 시스템 적용 |
|------|------|-----------------|
| **상담 태그 시스템** | 가망/잠재/1차예약/확정예약 등 | 고객 상태 추적에 활용 |
| **서비스(채널) 필터** | 라인, 이메일 등 채널별 필터 | 채널별 대화 필터링 |
| **담당자별 필터** | 각 담당자 배정 건수 표시 | 업무 분배 현황 파악 |
| **내부대화/고객응대 분리** | 팀원 간 코멘트와 실제 응대 분리 | 내부 커뮤니케이션 기능 추가 |
| **번역보기 토글** | 원문/번역 전환 버튼 | 이미 구현 예정 |
| **상담 대기 시간 표시** | "10일 8시간" 등 | SLA 관리에 활용 |
| **AI BOT 라벨** | AI 응답에 BOT 표시 | AI 응답 명확히 구분 |

#### 4. 고객 연락처 (CRM) 화면
- 테이블 형태의 고객 목록
- 다양한 컬럼: 이름, 이메일, 휴대폰, 회원ID, 최근접속, 고객태그, 국가, 언어 등
- 고급 필터 기능
- 세그먼트 관리
- 일회성 메시지 발송 기능

#### 5. AI (ALF) 기능
- AI 에이전트 통계 대시보드
- 관여율, 해결률, CX Score, 절감 비용
- 지식 관리 (폴더별, 엑셀/웹사이트/PDF 지원)
- 태스크 관리
- 워크플로우 자동화

---

## 통합 전략

**현재 상황**:
- 기존 솔루션: Meta 플랫폼 연동 완료 (Facebook, Instagram, WhatsApp)
- 추가 필요: LINE 연동 (우선)
- CRM: 자체 개발 CRM (REST API 제공)
- 인프라: Supabase + Upstash

**LLM 전략**: GPT-4 + Claude 혼용
- GPT-4: 일반 고객 응대, 빠른 응답
- Claude: 복잡한 의료 상담, 긴 컨텍스트 필요 시

---

## 1. 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|----------|
| **Frontend** | Next.js 14, React 19 | Server Components, 뛰어난 성능 |
| **UI** | shadcn/ui, Tailwind CSS, Framer Motion | 혁신적 UI, 애니메이션 |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | 서버리스, 실시간 구독 |
| **Vector DB** | Supabase pgvector | RAG용 벡터 검색 |
| **Cache/Queue** | Upstash Redis + QStash | 서버리스 캐싱, 작업 큐 |
| **LLM** | OpenAI GPT-4 + Anthropic Claude | 고품질 응답, 다국어 |
| **Translation** | DeepL API | 최고 품질 번역 |
| **Real-time** | Supabase Realtime | 실시간 메시징 |
| **Storage** | Supabase Storage | 미디어 파일 저장 |
| **Auth** | Supabase Auth | 인증/권한 관리 |

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        클라이언트 레이어                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 Admin Dashboard                                   │  │
│  │  - 혁신적 UI (Glass Morphism + 3D Elements)                   │  │
│  │  - 통합 인박스 (메신저/병원 식별 강조)                          │  │
│  │  - 실시간 메시징 (Supabase Realtime)                          │  │
│  │  - 다국어 UI (next-intl)                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Supabase Edge Functions                         │
│  - API Gateway (인증/인가)                                           │
│  - Webhook Handlers (각 메신저)                                      │
│  - RAG Pipeline                                                      │
│  - 번역 서비스 (DeepL)                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│   Supabase DB        │ │   Upstash        │ │   External APIs      │
│  - PostgreSQL        │ │  - Redis Cache   │ │  - OpenAI GPT-4      │
│  - pgvector          │ │  - QStash Queue  │ │  - Claude            │
│  - Realtime          │ │  - Rate Limiting │ │  - DeepL             │
│  - Row Level Security│ │                  │ │  - 메신저 APIs       │
└──────────────────────┘ └──────────────────┘ └──────────────────────┘
```

---

## 3. LLM RAG 자동 응대 구조 (고도화)

### 3.1 Multi-Tenant RAG 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Advanced Multi-Tenant RAG System                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  1. Query Processing Layer                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │
│  │  │언어감지 │→│의도분류 │→│엔티티   │→│쿼리     │        │   │
│  │  │        │  │        │  │추출    │  │재작성   │        │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  2. Retrieval Layer (Hybrid Search)          │   │
│  │                                                              │   │
│  │  ┌──────────────────┐    ┌──────────────────┐               │   │
│  │  │  Vector Search   │    │  Keyword Search  │               │   │
│  │  │  (pgvector)      │    │  (Full-text)     │               │   │
│  │  │  - Semantic      │    │  - BM25          │               │   │
│  │  │  - 유사도 검색   │    │  - 정확 매칭     │               │   │
│  │  └────────┬─────────┘    └────────┬─────────┘               │   │
│  │           │                       │                          │   │
│  │           └───────┬───────────────┘                          │   │
│  │                   ▼                                          │   │
│  │           ┌──────────────┐                                   │   │
│  │           │ Hybrid Merge │ (RRF - Reciprocal Rank Fusion)   │   │
│  │           └──────────────┘                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  3. Re-ranking Layer                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                      │   │
│  │  │Cross-   │→│Relevance│→│Diversity│                      │   │
│  │  │Encoder  │  │Score    │  │Filter   │                      │   │
│  │  └─────────┘  └─────────┘  └─────────┘                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  4. Context Augmentation                     │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │ Retrieved Docs + Conversation History +             │     │   │
│  │  │ Customer Profile + Tenant Config + Medical Context  │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  5. LLM Router (GPT-4 / Claude)              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ Query Complexity Analysis:                           │    │   │
│  │  │ - Simple FAQ → GPT-4 (빠름, 저비용)                  │    │   │
│  │  │ - Complex Medical → Claude (정확도, 긴 컨텍스트)     │    │   │
│  │  │ - Multi-turn → Claude (대화 맥락 유지)               │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  6. Response Validation                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │
│  │  │Safety   │→│Factuality│→│Confidence│→│Hallucin-│        │   │
│  │  │Check    │  │Check    │  │Score    │  │ation Det│        │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                   ┌──────────┴──────────┐                          │
│                   ▼                     ▼                          │
│           ┌──────────────┐      ┌──────────────┐                   │
│           │ Auto Response│      │ Escalation   │                   │
│           │ (신뢰도 ≥75%)│      │ (신뢰도 <75%)│                   │
│           └──────────────┘      └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Progressive Learning Loop (자동 학습 시스템)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Progressive Learning Pipeline                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 에스컬레이션 발생                                                │
│     └─ AI 신뢰도 < 75% → 담당자에게 전달                            │
│                                                                     │
│  2. 전문가 답변 수집                                                 │
│     ├─ 담당자 직접 답변 기록                                         │
│     ├─ 답변 품질 평가 (5점 척도)                                    │
│     └─ 에스컬레이션 사유 태깅                                        │
│                                                                     │
│  3. 자동 지식 추출 (LLM 기반)                                        │
│     ├─ 질문 패러프레이즈 생성 (10개 변형)                            │
│     ├─ 답변 구조화 (JSON Schema)                                    │
│     ├─ 메타데이터 자동 태깅 (카테고리, 키워드, 의도)                 │
│     └─ 임베딩 벡터 생성                                              │
│                                                                     │
│  4. 지식베이스 자동 업데이트                                         │
│     ├─ 중복 문서 체크 (유사도 > 0.95)                               │
│     ├─ 기존 문서 병합 또는 신규 추가                                 │
│     ├─ 버전 관리 (문서 히스토리)                                    │
│     └─ 테넌트별 격리 유지                                           │
│                                                                     │
│  5. 자동 품질 모니터링                                               │
│     ├─ 유사 쿼리 재발생 시 새 지식 사용 여부 추적                   │
│     ├─ A/B 테스트 (기존 vs 신규 지식)                               │
│     └─ 에스컬레이션 감소율 측정                                      │
│                                                                     │
│  6. 주간 자동 개선 사이클                                            │
│     ├─ 에스컬레이션 패턴 분석 리포트                                │
│     ├─ 프롬프트 자동 튜닝 제안                                       │
│     └─ 지식 갭 분석 → 관리자 알림                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 신뢰도 계산 모델 (상세)

```typescript
interface ConfidenceBreakdown {
  retrieval: number;     // 검색 품질 (0.20)
  generation: number;    // 생성 품질 (0.25)
  factuality: number;    // 사실성 (0.30)
  domain: number;        // 도메인 적합성 (0.15)
  consistency: number;   // 일관성 (0.10)
  overall: number;       // 종합 점수
}

// 신뢰도 계산 로직
class AdvancedConfidenceCalculator {
  calculate(query, response, docs, tenantId): ConfidenceBreakdown {
    return {
      // 1. 검색 신뢰도: 문서 유사도 + 최신성 + 출처 다양성
      retrieval: this.calcRetrieval(query, docs),

      // 2. 생성 신뢰도: 텍스트 엔트로피 + 인용 비율 + 불확실성 표현
      generation: this.calcGeneration(response, docs),

      // 3. 사실성: 출처 일관성 + 환각 감지 + 의료 팩트체크
      factuality: this.calcFactuality(response, docs),

      // 4. 도메인 신뢰도: 도메인 매칭 + 전문용어 사용 + 테넌트 지식 활용
      domain: this.calcDomain(query, response, tenantId),

      // 5. 일관성: 내부 일관성 + 쿼리 관련성
      consistency: this.calcConsistency(response, query),

      overall: weightedSum(scores)
    };
  }
}

// 동적 임계값 (상황별 조정)
class DynamicThreshold {
  getThreshold(context, tenantId): number {
    let base = 0.75;

    // 응급 쿼리 → 0.95 (더 보수적)
    if (this.isEmergency(context.query)) base = 0.95;

    // 가격 문의 → 0.85 (정확도 중요)
    if (this.isPriceInquiry(context.query)) base = 0.85;

    // 단순 FAQ → 0.65 (낮은 기준)
    if (this.isSimpleFAQ(context.query)) base = 0.65;

    // 테넌트 성능 반영
    const accuracy = getTenantAccuracy(tenantId);
    if (accuracy < 0.70) base += 0.15;
    if (accuracy > 0.90) base -= 0.05;

    return Math.min(base, 0.95);
  }
}
```

### 3.4 거래처별 프롬프트 시스템

```typescript
interface TenantPromptConfig {
  tenantId: string;
  hospitalName: string;
  hospitalNameEn: string;
  specialty: 'ophthalmology' | 'dentistry' | 'plastic_surgery' | 'dermatology' | 'general';

  // 시스템 프롬프트 (거래처별 맞춤)
  systemPrompt: string;

  // 도메인 규칙
  domainRules: {
    allowedTopics: string[];      // 답변 가능 주제
    prohibitedTopics: string[];   // 금지 주제 (경쟁사 언급 등)
    requiredDisclaimers: string[]; // 필수 고지사항
    priceRanges: Record<string, { min: number; max: number; currency: string }>;
  };

  // 응답 스타일
  responseStyle: {
    tone: 'formal' | 'friendly' | 'professional';
    language: 'simple' | 'technical';
    maxLength: number;
    includeEmoji: boolean;
    signatureTemplate: string;
  };

  // 에스컬레이션 조건
  escalationRules: {
    confidenceThreshold: number;
    alwaysEscalateKeywords: string[];  // "환불", "불만", "소송" 등
    workingHours: { start: string; end: string; timezone: string };
    escalationChannels: ('kakao_alimtalk' | 'slack' | 'email')[];
  };

  // LLM 라우팅 선호도
  llmPreference: {
    default: 'gpt-4' | 'claude';
    complexQueries: 'gpt-4' | 'claude';
    costSensitive: boolean;
  };
}
```

---

## 4. 혁신적 UI/UX 설계

### 4.1 디자인 컨셉: "Medical AI Command Center"

**핵심 디자인 철학**:
- **Glass Morphism 2.0**: 반투명 레이어 + 블러 효과로 깊이감
- **Micro-interactions**: 모든 상호작용에 부드러운 애니메이션
- **AI-Native UI**: AI 상태/사고 과정을 시각적으로 표현
- **Dark Mode First**: 장시간 사용에 최적화된 다크 테마

### 4.2 색상 시스템

```css
/* Primary Palette - 의료/신뢰 */
--primary-50: #eff6ff;
--primary-500: #3b82f6;   /* 주요 액션 */
--primary-600: #2563eb;
--primary-900: #1e3a8a;

/* Accent - AI/혁신 */
--accent-violet: #8b5cf6;  /* AI 관련 요소 */
--accent-cyan: #06b6d4;    /* 실시간 데이터 */
--accent-emerald: #10b981; /* 성공/완료 */

/* Status Colors */
--status-urgent: #ef4444;     /* 🔴 긴급 */
--status-warning: #f59e0b;    /* 🟠 주의 */
--status-pending: #eab308;    /* 🟡 대기 */
--status-success: #22c55e;    /* 🟢 해결 */
--status-ai: #8b5cf6;         /* 🟣 AI 처리 */

/* Dark Mode */
--bg-primary: #0f0f23;        /* 배경 */
--bg-secondary: #1a1a2e;      /* 카드 배경 */
--bg-tertiary: #16213e;       /* 호버 상태 */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);
```

### 4.3 통합 인박스 UI (상세)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔮 CS Command Center                              [🌙] [🔔 12] [👤] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  🔍 Search conversations...           [All Channels ▼] [Filter ▼]  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─── Quick Stats ──────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │ 📨 127   │  │ 🤖 82%   │  │ ⚡ 1.2m  │  │ 🚨 23    │            │  │
│  │  │ New      │  │ AI Rate  │  │ Avg Time │  │ Escalated│            │  │
│  │  │ ↑12%     │  │ ↑5.2%    │  │ ↓0.3m    │  │ ↓8       │            │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─── Conversation List ───────────────────┬─── Chat View ──────────────┐  │
│  │                                          │                            │  │
│  │  ┌────────────────────────────────────┐ │  ┌────────────────────────┐│  │
│  │  │ 🔴 URGENT                          │ │  │ 👤 김환자 (일본)        ││  │
│  │  │ ┌──────────────────────────────┐   │ │  │ ─────────────────────  ││  │
│  │  │ │ [LINE] 🏥 힐링안과           │   │ │  │ 📍 Tokyo, Japan        ││  │
│  │  │ │ 김환자 (日本)                │   │ │  │ 🗣️ Japanese            ││  │
│  │  │ │ "라식 수술 비용이 얼마..."   │   │ │  │ 📱 LINE: healing_usr_1 ││  │
│  │  │ │ ⏰ 5분 전  🤖 AI 대기 중     │   │ │  │ 🏥 힐링안과 (LINE)     ││  │
│  │  │ └──────────────────────────────┘   │ │  └────────────────────────┘│  │
│  │  └────────────────────────────────────┘ │                            │  │
│  │                                          │  ┌────────────────────────┐│  │
│  │  ┌────────────────────────────────────┐ │  │ 💬 Conversation        ││  │
│  │  │ 🟡 PENDING                         │ │  │ ─────────────────────  ││  │
│  │  │ ┌──────────────────────────────┐   │ │  │                        ││  │
│  │  │ │ [카카오] 🏥 스마일치과       │   │ │  │ 👤 14:30 (일본어)      ││  │
│  │  │ │ 이환자 (한국)                │   │ │  │ ┌──────────────────┐  ││  │
│  │  │ │ "예약 변경하고 싶어요"       │   │ │  │ │ ラシック手術の費用 │  ││  │
│  │  │ │ ⏰ 1시간 전  👤 담당자 처리  │   │ │  │ │ はいくらですか？  │  ││  │
│  │  │ └──────────────────────────────┘   │ │  │ └──────────────────┘  ││  │
│  │  └────────────────────────────────────┘ │  │ 🌐 번역: 라식 수술    ││  │
│  │                                          │  │ 비용이 얼마인가요?    ││  │
│  │  ┌────────────────────────────────────┐ │  │                        ││  │
│  │  │ 🟢 RESOLVED                        │ │  │ 🤖 14:31 (AI 자동응답) ││  │
│  │  │ ┌──────────────────────────────┐   │ │  │ ┌──────────────────┐  ││  │
│  │  │ │ [Instagram] 🏥 서울성형      │   │ │  │ │ 라식 수술 비용은 │  ││  │
│  │  │ │ 박환자 (대만)                │   │ │  │ │ 양안 기준 150만원 │  ││  │
│  │  │ │ "Before/After 사진 보고..."  │   │ │  │ │ 입니다. 상담 예약 │  ││  │
│  │  │ │ ⏰ 어제  ✅ AI 완료          │   │ │  │ │ 도와드릴까요?    │  ││  │
│  │  │ └──────────────────────────────┘   │ │  │ └──────────────────┘  ││  │
│  │  └────────────────────────────────────┘ │  │ 🎯 신뢰도: 92% ✓      ││  │
│  │                                          │  │                        ││  │
│  │  ┌────────────────────────────────────┐ │  └────────────────────────┘│  │
│  │  │ 🟣 AI PROCESSING                   │ │                            │  │
│  │  │ ┌──────────────────────────────┐   │ │  ┌────────────────────────┐│  │
│  │  │ │ [WhatsApp] 🏥 힐링안과      │   │ │  │ 📝 Message Input       ││  │
│  │  │ │ John Smith (USA)             │   │ │  │ ─────────────────────  ││  │
│  │  │ │ "What's the price for..."    │   │ │  │ Type a message...      ││  │
│  │  │ │ ⏰ 방금  🔮 AI 분석 중...    │   │ │  │                        ││  │
│  │  │ └──────────────────────────────┘   │ │  │ [🌐 DeepL] [🤖 AI제안] ││  │
│  │  └────────────────────────────────────┘ │  │ [📎 첨부] [📅 예약]   ││  │
│  │                                          │  └────────────────────────┘│  │
│  └──────────────────────────────────────────┴────────────────────────────┘  │
│                                                                             │
│  ┌─── Customer Profile Panel ───────────────────────────────────────────┐  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  👤 김환자                                              [VIP]  │  │  │
│  │  │  ────────────────────────────────────────────────────────────  │  │  │
│  │  │  📍 Location: Tokyo, Japan                                     │  │  │
│  │  │  🗣️ Language: Japanese (한국어 가능)                          │  │  │
│  │  │  🏥 Interest: 라식, 라섹, 스마일라식                           │  │  │
│  │  │  📅 Booking: 2024-02-15 10:00 (상담 예약)                     │  │  │
│  │  │  💰 Budget: ₩1,500,000 ~ ₩2,000,000                          │  │  │
│  │  │  ────────────────────────────────────────────────────────────  │  │  │
│  │  │  📱 Channels:                                                  │  │  │
│  │  │  [LINE healing_usr_1] [WhatsApp +81-90-xxxx]                  │  │  │
│  │  │  ────────────────────────────────────────────────────────────  │  │  │
│  │  │  📝 Notes:                                                     │  │  │
│  │  │  - 2024-01-25: 가격 문의, 라식 관심                           │  │  │
│  │  │  - 2024-01-27: 상담 예약 완료                                 │  │  │
│  │  │  ────────────────────────────────────────────────────────────  │  │  │
│  │  │  [🗓️ CRM 열기] [📅 예약 등록] [🏷️ 태그 추가] [📤 내보내기]   │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 AI 상태 시각화 컴포넌트

```tsx
// AI 처리 상태를 시각적으로 표현하는 컴포넌트
interface AIStatusIndicator {
  status: 'idle' | 'thinking' | 'searching' | 'generating' | 'validating' | 'complete' | 'escalated';
  confidence?: number;
  processingSteps?: {
    step: string;
    status: 'pending' | 'active' | 'complete';
    duration?: number;
  }[];
}

// 예시: AI 사고 과정 시각화
┌─────────────────────────────────────────┐
│  🔮 AI Processing                       │
│  ─────────────────────────────────────  │
│  ✅ 언어 감지: 일본어                   │
│  ✅ 의도 분류: 가격 문의                │
│  ✅ 지식 검색: 3개 문서 발견            │
│  🔄 응답 생성 중...                     │
│  ⏳ 신뢰도 검증 대기                    │
│  ─────────────────────────────────────  │
│  예상 완료: 2초                         │
│  ████████████░░░░░░░░ 65%              │
└─────────────────────────────────────────┘
```

### 4.5 채널/병원 식별 배지 시스템

```tsx
// 채널 배지 컴포넌트
const ChannelBadge = ({ channel, hospital }) => (
  <div className="flex items-center gap-2 p-2 rounded-lg bg-glass">
    {/* 채널 아이콘 */}
    <ChannelIcon channel={channel} />

    {/* 병원명 */}
    <span className="font-medium">{hospital.name}</span>

    {/* 채널 타입 */}
    <Badge variant={channel.type}>
      {channel.type.toUpperCase()}
    </Badge>
  </div>
);

// 채널별 색상 코딩
const channelColors = {
  line: { bg: '#06C755', text: 'white', icon: 'LINE' },
  whatsapp: { bg: '#25D366', text: 'white', icon: 'WhatsApp' },
  facebook: { bg: '#1877F2', text: 'white', icon: 'Messenger' },
  instagram: { bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', text: 'white', icon: 'Instagram' },
  kakao: { bg: '#FEE500', text: '#3C1E1E', icon: '카카오톡' }
};

// 병원별 로고/색상
const hospitalBranding = {
  healing_eye: { logo: '/logos/healing.png', color: '#2563eb', name: '힐링안과' },
  smile_dental: { logo: '/logos/smile.png', color: '#10b981', name: '스마일치과' },
  seoul_plastic: { logo: '/logos/seoul.png', color: '#8b5cf6', name: '서울성형' }
};
```

### 4.6 혁신적 UI 컴포넌트 목록

| 컴포넌트 | 설명 | 혁신 포인트 |
|---------|------|------------|
| **AI Thinking Visualizer** | AI 사고 과정 실시간 표시 | 사용자가 AI 동작을 이해 |
| **Confidence Meter** | 신뢰도 게이지 애니메이션 | 에스컬레이션 판단 근거 시각화 |
| **Multi-Channel Timeline** | 고객의 모든 채널 대화 통합 | 채널 전환 시에도 맥락 유지 |
| **Smart Reply Suggestions** | AI 제안 답변 카드 UI | 클릭 한 번으로 전송 |
| **Translation Preview** | 번역 결과 실시간 미리보기 | 발송 전 확인 가능 |
| **Hospital Switcher** | 거래처 빠른 전환 | 키보드 단축키 지원 |
| **Escalation Flow** | 에스컬레이션 프로세스 시각화 | 상태 추적 용이 |
| **Knowledge Graph** | 지식베이스 관계도 | 문서 간 연결 시각화 |
| **Performance Heatmap** | 시간대별 응대 현황 | 운영 최적화 인사이트 |
| **Customer Journey Map** | 고객 여정 시각화 | 터치포인트 분석 |

---

## 5. 핵심 기능 상세

### 5.1 통합 인박스 기능

- **고객 중심 뷰**: 채널이 아닌 고객 단위로 대화 그룹화
- **메신저/병원 명확 표시**: 배지 + 색상으로 즉시 식별
- **실시간 업데이트**: Supabase Realtime으로 즉시 반영
- **스마트 정렬**: 긴급도, 대기시간, AI 상태 기준 자동 정렬
- **키보드 단축키**: Vim-style 네비게이션 (j/k로 이동)

### 5.2 자동 번역 시스템 (DeepL)

```typescript
interface TranslationService {
  // 수신 메시지 자동 번역
  translateIncoming(message: string, targetLang: 'ko'): Promise<{
    original: string;
    translated: string;
    detectedLang: string;
    confidence: number;
  }>;

  // 발신 메시지 자동 번역
  translateOutgoing(message: string, targetLang: string): Promise<{
    original: string;
    translated: string;
    alternatives?: string[];  // 대안 번역
  }>;

  // 번역 캐싱 (Upstash Redis)
  getCachedTranslation(hash: string): Promise<string | null>;
  cacheTranslation(hash: string, translation: string, ttl: number): Promise<void>;
}
```

### 5.3 CRM 연동

```typescript
interface CRMIntegration {
  // 고객 정보 동기화
  syncCustomer(customerId: string): Promise<Customer>;

  // 예약 생성/수정
  createBooking(data: BookingDto): Promise<Booking>;
  updateBooking(id: string, data: Partial<BookingDto>): Promise<Booking>;

  // 자동 메모 추가
  addNote(customerId: string, note: NoteDto): Promise<Note>;

  // 태그 관리
  addTags(customerId: string, tags: string[]): Promise<void>;
}
```

### 5.4 에스컬레이션 관리

```
에스컬레이션 플로우:

AI 자동응대 → 신뢰도 < 임계값 → 에스컬레이션 생성
                    │
                    ▼
          ┌─────────────────────┐
          │  에스컬레이션 큐     │
          │  - 우선순위 정렬     │
          │  - 담당자 자동 할당  │
          │  - SLA 타이머       │
          └──────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   [카카오 알림톡]  [슬랙 알림]  [대시보드 알림]
   (담당자 휴대폰)  (팀 채널)    (실시간 푸시)
                     │
                     ▼
          ┌─────────────────────┐
          │  담당자 응대        │
          │  - AI 제안 답변     │
          │  - 직접 수정/작성   │
          │  - 품질 평가        │
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │  학습 데이터 수집    │
          │  - 질문-답변 쌍     │
          │  - 자동 KB 업데이트 │
          └─────────────────────┘
```

---

## 6. 전체 기능 목록

### 6.1 핵심 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 통합 인박스 | 모든 채널 메시지 고객별 통합 관리 | P0 |
| LLM RAG 자동응대 | GPT-4 + Claude 기반 자동 답변 | P0 |
| 자동 번역 | DeepL 기반 실시간 양방향 번역 | P0 |
| 에스컬레이션 | 신뢰도 기반 담당자 전달 | P0 |
| CRM 연동 | 자체 CRM API 연동 | P0 |
| 지식베이스 관리 | 거래처별 문서/FAQ 관리 | P0 |

### 6.2 추가 기능 (전체 진행)

| 기능 | 설명 | 구현 상세 |
|------|------|----------|
| **음성 메시지 처리** | 음성→텍스트 변환 후 자동응대 | Whisper API로 STT, 텍스트로 RAG 처리 |
| **이미지 분석** | 시술 전후 사진 분석, 상담 지원 | GPT-4 Vision으로 이미지 분석 |
| **챗봇 위젯** | 병원 웹사이트 임베드용 | 커스터마이징 가능한 React 위젯 |
| **예약 캘린더 동기화** | Google Calendar, Naver 연동 | Calendar API 양방향 동기화 |
| **환자 포털** | 환자 직접 예약/조회 웹앱 | Next.js 별도 앱 |
| **다국어 콘텐츠 생성** | 마케팅 문구 자동 번역 | DeepL + LLM 검수 |
| **경쟁사 분석** | 가격/서비스 비교 리포트 | 웹 스크래핑 + 분석 대시보드 |

### 6.3 AI 고도화 기능 (전체 진행)

| 기능 | 설명 | 구현 상세 |
|------|------|----------|
| **Fine-tuning** | 의료 도메인 특화 모델 | 에스컬레이션 데이터로 LoRA 학습 |
| **Multi-modal** | 이미지 기반 상담 | GPT-4 Vision + 시술 사진 분석 |
| **Proactive Outreach** | AI 선제 연락 | 관심 고객 자동 식별, 맞춤 메시지 |
| **Sentiment Analysis** | 고객 감정 분석 | 감정 점수 → 우선순위 자동 조정 |
| **Conversion Prediction** | 예약 전환 확률 예측 | ML 모델로 전환 가능성 스코어링 |

---

## 7. 개발 로드맵

### Phase 1: 기반 구축 + LINE 연동 ✅ COMPLETED

**목표**: 기존 솔루션과 통합, LINE 연동, 기본 인프라

**주요 작업**:
- [x] Supabase 프로젝트 설정 (DB, Auth, Realtime, Storage) ✅
- [x] **Supabase 스키마 적용 완료** ✅
- [x] 서비스 레이어 구축 (AI, 대화, 메시지, 고객, 에스컬레이션) ✅
- [x] RAG 파이프라인 기본 구현 ✅
- [x] DeepL 번역 서비스 연동 ✅
- [x] **통합 인박스 UI 구현** (Channel.io 참고) ✅
  - [x] 3단 레이아웃 (고객목록 - 대화창 - 정보패널) ✅
  - [x] 상담 상태 관리 (진행중/보류중/부재중/종료됨) ✅
  - [x] **상담 태그 시스템** (가망/잠재/1차예약/확정예약 등) ✅
  - [x] 채널/담당자별 필터링 ✅
  - [x] **번역 토글** (원문/번역 간편 전환) ✅
  - [x] **AI BOT 라벨** (AI 응답 명확히 구분) ✅
  - [x] **내부 노트 기능** (@멘션 지원) ✅
- [x] LINE Messaging API 연동 완성 ✅
- [x] 메시지 정규화 레이어 완성 ✅
- [x] React Query Hooks 구현 ✅
- [x] SLA 대기 시간 표시 ✅

**산출물**:
- LINE + Meta(FB, Insta, WhatsApp) 통합 ✅
- 실시간 번역 기능 ✅
- Channel.io 수준의 통합 인박스 UI ✅

### Phase 2: LLM RAG 자동응대 ✅ COMPLETED

**목표**: AI 자동 응대 시스템 완성

**주요 작업**:
- [x] RAG 파이프라인 구축 (pgvector) ✅
- [x] Hybrid Search 구현 (Vector + Full-text + RRF) ✅
- [x] GPT-4 + Claude 라우팅 로직 ✅
- [x] 신뢰도 계산 모델 구현 ✅
- [x] **내부대화 기능** (Channel.io 참고) ✅
  - [x] 팀원 간 코멘트 (고객에게 미표시) ✅
  - [x] 멘션 기능 (@담당자) ✅
  - [x] 내부대화/고객응대 탭 분리 ✅
- [x] 에스컬레이션 시스템 ✅
- [x] 지식베이스 관리 UI ✅
- [x] 지식베이스 API ✅
- [x] 자체 CRM API 연동 ✅

**산출물**:
- 거래처별 맞춤 AI 응대 ✅
- 에스컬레이션 알림 시스템 ✅
- CRM 고객 정보 연동 ✅
- 팀 협업 기능 ✅

### Phase 3: 자동화 및 고급 기능 ✅ COMPLETED

**목표**: 완전 자동화 + 추가 기능

**주요 작업**:
- [x] 카카오톡 채널 연동 ✅
- [x] 자동화 규칙 엔진 ✅
- [x] Progressive Learning Loop ✅
- [x] 만족도 조사 시스템 ✅
- [x] **분석 대시보드** ✅
  - [x] 실시간 메트릭 ✅
  - [x] 채널별 분석 ✅
  - [x] AI 성능 메트릭 ✅
  - [x] 대화 트렌드 분석 ✅
- [x] CRM 동기화 서비스 ✅

**산출물**:
- 완전 자동화 워크플로우 ✅
- AI 성과 대시보드 ✅
- 양방향 CRM 동기화 ✅

### Phase 4: 엔터프라이즈 기능 ✅ COMPLETED

**목표**: 엔터프라이즈 기능 + 보안 강화

**주요 작업**:
- [x] 멀티 테넌트 관리 서비스 ✅
- [x] SSO/SAML 인증 ✅
- [x] 감사 로그 ✅
- [x] SLA 모니터링 ✅
- [x] 화이트라벨링 ✅
- [x] 외부 API 제공 ✅
- [x] Phase 4 데이터베이스 스키마 ✅

**산출물**:
- 엔터프라이즈 보안 기능 ✅
- SSO/SAML 지원 ✅
- API 키 관리 및 웹훅 ✅
- 브랜딩 커스터마이징 ✅

### Phase 5: Meta Platform + 추가 채널 통합 ✅ COMPLETED

**목표**: Meta 플랫폼 통합 + 추가 채널

**주요 작업**:
- [x] Facebook Messenger 어댑터 ✅
- [x] Instagram DM 어댑터 ✅
- [x] WhatsApp Business 어댑터 ✅
- [x] Meta 통합 Webhook 핸들러 ✅
- [x] Meta OAuth 연동 플로우 ✅
- [x] 채널 관리 UI ✅
- [x] WeChat 어댑터 ✅
- [x] 고객 프로필 통합 강화 ✅
- [x] 메시지 템플릿 관리 ✅

**산출물**:
- 6개 채널 완전 통합 (LINE, KakaoTalk, Facebook, Instagram, WhatsApp, WeChat) ✅
- 채널 OAuth 연동 UI ✅
- 고객 타임라인 및 프로필 API ✅
- 메시지 템플릿 시스템 ✅

### Phase 6: AI 고도화 및 확장 ✅ COMPLETED

**목표**: AI 고도화 + 성능 최적화

**주요 작업**:
- [x] 음성 메시지 처리 (Whisper) ✅
- [x] 이미지 분석 (GPT-4 Vision) ✅
- [x] Sentiment Analysis 구현 ✅
- [x] Conversion Prediction 모델 ✅
- [x] Proactive Outreach 시스템 ✅
- [x] 예약 캘린더 동기화 (Google/Naver) ✅
- [x] 챗봇 위젯 개발 ✅

**산출물**:
- 음성 메시지 자동 텍스트 변환 (Whisper API) ✅
- 의료 이미지 분석 (GPT-4 Vision) ✅
- 고객 감정 분석 및 우선순위 조정 ✅
- 전환 확률 예측 및 고가치 고객 식별 ✅
- AI 선제 연락 캠페인 시스템 ✅
- Google/Naver 캘린더 양방향 동기화 ✅
- 임베더블 챗봇 위젯 ✅

### Phase 7: 고도화 및 최적화 ✅ COMPLETED

**목표**: Fine-tuning, 성능 최적화, 테스트 안정화

**주요 작업**:
- [x] Fine-tuning 파이프라인 (`/src/services/ai/fine-tuning.ts`) ✅
- [x] 경쟁사 분석 서비스 (`/src/services/competitor-analysis.ts`) ✅
- [x] 성능 최적화 서비스 (`/src/services/performance-optimization.ts`) ✅
- [x] Upstash Vector 통합 (`/src/services/upstash-vector.ts`) ✅
- [x] Vitest 테스트 인프라 구축 ✅
- [x] 환자 포털 개발 (별도 앱 `/portal`) ✅
- [x] E2E 테스트 (Playwright) - 21개 테스트 ✅
- [x] 프로덕션 최적화 (보안 헤더, 이미지 최적화) ✅
- [x] 전체 UI/UX 업그레이드 (9개 대시보드 페이지 + globals.css) ✅
- [x] 인박스 UI 고도화 (2026-01-28) ✅
  - [x] 리사이즈 가능한 3단 패널 (react-resizable-panels v4) ✅
  - [x] 멀티 거래처 필터링 (50+ 병원 지원, 검색 가능 콤보박스) ✅
  - [x] 태그 시스템 전면 개편 (상담/상태/고객 3카테고리, 멀티 필터) ✅
  - [x] 채팅 스크롤 수정 (auto-scroll, scroll-to-bottom 버튼) ✅
  - [x] CS 직원 편의 기능 (빠른 답변, 단축키, 호버 액션, 감정 분석, 전환 점수) ✅
- [x] **전체 프론트엔드 DB 연동 (2026-01-28)** ✅
  - [x] 대시보드 (`/dashboard`) — `/api/dashboard/stats` 실시간 통계 ✅
  - [x] 통합 인박스 (`/inbox`) — `/api/conversations`, `/api/conversations/[id]/messages` + Supabase Realtime ✅
  - [x] 채널 관리 (`/channels`) — `/api/channels`, `/api/channels/available` CRUD ✅
  - [x] 거래처 관리 (`/tenants`) — `/api/tenants` CRUD + AI 설정 ✅
  - [x] 지식베이스 (`/knowledge`) — `/api/knowledge/documents` CRUD + 임베딩 ✅
  - [x] 담당자 관리 (`/team`) — `/api/team` CRUD + 역할/상태 관리 ✅
  - [x] 에스컬레이션 (`/escalations`) — `/api/escalations` + 담당자 배정, 상태 변경, 30초 자동 새로고침 ✅
  - [x] 분석/리포트 (`/analytics`) — `/api/analytics?period=` 기간별 통계 + 차트 데이터 ✅
  - [x] 설정 (`/settings`) — `/api/settings` GET/PATCH 5탭 전체 설정 저장 ✅
  - [x] 전체 빌드 검증 통과 (Next.js 16.1.4 Turbopack, 30 pages + 42 API routes, 0 errors) ✅

**산출물**:
- OpenAI Fine-tuning 파이프라인 (에스컬레이션 → 학습 데이터) ✅
- 경쟁사 가격/서비스 비교 분석 ✅
- Upstash Redis 스마트 캐싱 시스템 ✅
- Upstash Vector 기반 고속 RAG 검색 ✅
- Vitest 기반 테스트 환경 (98개 단위 테스트) ✅
- Playwright E2E 테스트 (21개 - 전 페이지 렌더링 + 인박스 기능) ✅
- 환자 포털 (별도 Next.js 앱, 예약/상담/문서 조회) ✅
- next.config.ts 프로덕션 보안 헤더 및 이미지 최적화 ✅
- 전체 UI/UX 업그레이드 (card-3d, progress-shine, 그라디언트 헤더, 친근한 UX 문구) ✅
- 인박스 UI 고도화 (리사이즈, 멀티필터, 태그 개편, 스크롤 수정, CS 편의기능) ✅
- **전체 9개 프론트엔드 페이지 DB 연동 완료 (Mock 데이터 제거, API Route 기반 실시간 데이터)** ✅

---

## 8. 데이터베이스 스키마 (Supabase)

```sql
-- 거래처 (병원)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  specialty TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 메신저 채널 계정
CREATE TABLE channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  channel_type TEXT NOT NULL, -- 'line', 'whatsapp', 'facebook', 'instagram', 'kakao'
  channel_account_id TEXT NOT NULL, -- 각 플랫폼의 계정 ID
  name TEXT NOT NULL,
  credentials JSONB, -- 암호화된 인증 정보
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 고객
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT,
  language TEXT DEFAULT 'ko',
  country TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  crm_customer_id TEXT, -- 외부 CRM ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 고객-채널 연결
CREATE TABLE customer_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  channel_account_id UUID REFERENCES channel_accounts(id),
  channel_user_id TEXT NOT NULL, -- 각 플랫폼의 사용자 ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_account_id, channel_user_id)
);

-- 대화
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  channel_account_id UUID REFERENCES channel_accounts(id),
  status TEXT DEFAULT 'open', -- 'open', 'pending', 'resolved', 'escalated'
  priority TEXT DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
  assigned_to UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 메시지
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  sender_type TEXT NOT NULL, -- 'customer', 'agent', 'ai'
  content_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'audio', 'location'
  content TEXT,
  original_content TEXT, -- 번역 전 원문
  original_language TEXT,
  translated_content TEXT,
  media_url TEXT,
  metadata JSONB DEFAULT '{}',
  ai_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 지식베이스 문서 (RAG용)
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  embedding VECTOR(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 에스컬레이션
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  reason TEXT NOT NULL,
  ai_confidence FLOAT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학습 데이터 (에스컬레이션 → 지식)
CREATE TABLE learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID REFERENCES escalations(id),
  question TEXT NOT NULL,
  question_paraphrases TEXT[] DEFAULT '{}',
  answer TEXT NOT NULL,
  category TEXT,
  quality_score INT, -- 1-5
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 자동화 규칙
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Vector 검색 인덱스
CREATE INDEX knowledge_documents_embedding_idx ON knowledge_documents
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 9. 성공 지표 (KPI)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| AI 자동응대율 | 85% 이상 | 전체 문의 중 AI만으로 해결된 비율 |
| 평균 응답 시간 | 30초 이내 | 고객 문의 → 첫 응답 시간 |
| 고객 만족도 | 4.7/5.0 | 응대 후 만족도 조사 |
| 에스컬레이션 감소율 | 월 25% 감소 | 학습 후 에스컬레이션 비율 변화 |
| 시스템 가용성 | 99.95% | 업타임 모니터링 |
| 번역 정확도 | 98% 이상 | DeepL 품질 + 샘플 검수 |
| 전환율 | +30% | AI 응대 후 예약 전환율 |

---

## 10. 검증 계획

### 10.1 개발 중 검증
- 단위 테스트: Vitest
- E2E 테스트: Playwright
- API 테스트: Supertest
- 부하 테스트: k6

### 10.2 배포 후 검증
1. **기능 검증**: 각 메신저 채널 송수신 테스트
2. **번역 검증**: DeepL 번역 품질 샘플링
3. **AI 응답 검증**: 거래처별 FAQ 응답 품질 체크
4. **성능 검증**: 응답 시간, 처리량 모니터링
5. **사용성 검증**: 실제 운영자 피드백 수집

---

## 11. 리스크 및 대응

| 리스크 | 영향 | 대응 방안 |
|--------|------|----------|
| 메신저 API 정책 변경 | 높음 | 다중 채널 지원, 추상화 레이어 |
| LLM 비용 증가 | 중간 | 캐싱, 경량 모델 혼용, 규칙 기반 우선 |
| DeepL API 장애 | 중간 | 폴백 번역 서비스 (Google) |
| 개인정보 보호 | 높음 | 암호화, RLS, 감사 로그 |
| 시스템 장애 | 높음 | Supabase 이중화, 자동 복구 |

---

## 12. 전체 기능 세분화 목록 (개발 체크리스트)

### 12.1 Phase 1: 기반 구축 + LINE 연동 ✅ COMPLETED

#### 1.1 프로젝트 초기화 ✅
- [x] Next.js 14 프로젝트 생성 (App Router) ✅
- [x] TypeScript 설정 ✅
- [x] ESLint + Prettier 설정 ✅
- [x] Tailwind CSS 설정 ✅
- [x] shadcn/ui 설치 및 설정 ✅
- [x] Framer Motion 설치 ✅
- [x] 환경변수 설정 (.env.local) ✅
- [x] 프로젝트 구조 생성 ✅

#### 1.2 Supabase 설정 ✅
- [x] Supabase 프로젝트 생성 ✅
- [x] 데이터베이스 스키마 생성 ✅
  - [x] tenants 테이블 ✅
  - [x] channel_accounts 테이블 ✅
  - [x] customers 테이블 ✅
  - [x] customer_channels 테이블 ✅
  - [x] conversations 테이블 ✅
  - [x] messages 테이블 ✅
  - [x] knowledge_documents 테이블 ✅
  - [x] escalations 테이블 ✅
  - [x] learning_data 테이블 ✅
  - [x] automation_rules 테이블 ✅
  - [x] internal_notes 테이블 ✅
  - [x] bookings 테이블 ✅
- [x] pgvector 확장 활성화 ✅
- [x] Row Level Security (RLS) 정책 설정 ✅
- [x] Supabase Auth 설정 ✅
- [x] Supabase Realtime 설정 ✅
- [x] Supabase Storage 버킷 생성 ✅

#### 1.3 Upstash 설정 ✅
- [x] Upstash Redis 인스턴스 생성 ✅
- [x] Upstash Vector 인스턴스 생성 (RAG 벡터 검색용) ✅
- [x] QStash 설정 (작업 큐) ✅
- [x] Rate Limiting 설정 ✅
- [x] 캐시 전략 정의 ✅

#### 1.4 인증 시스템 ✅
- [x] 로그인 페이지 UI ✅
- [x] 회원가입 페이지 UI ✅
- [x] 세션 관리 ✅
- [x] RBAC (역할 기반 접근 제어) ✅

#### 1.5 대시보드 레이아웃 ✅
- [x] 사이드바 네비게이션 ✅
- [x] 헤더 (검색, 알림, 프로필) ✅
- [x] 다크 모드 토글 ✅
- [x] 반응형 레이아웃 ✅
- [x] 토스트 알림 시스템 ✅

#### 1.6 LINE 연동 ✅
- [x] LINE Messaging API 웹훅 핸들러 ✅
- [x] LINE 메시지 수신 처리 ✅
- [x] LINE 메시지 발송 처리 ✅
- [x] LINE 서명 검증 ✅
- [x] LINE 사용자 프로필 조회 ✅
- [x] LINE 미디어 메시지 처리 ✅
- [x] LINE Quick Replies 지원 ✅
- [x] LINE 템플릿/캐러셀 메시지 ✅

#### 1.7 메시지 정규화 레이어 ✅
- [x] UnifiedMessage 인터페이스 정의 ✅
- [x] LINE → UnifiedMessage 변환 ✅
- [x] 채널 어댑터 레지스트리 ✅
- [x] 메시지 큐 처리 (Upstash QStash) ✅
- [x] 메시지 저장 로직 ✅

#### 1.8 통합 인박스 기본 UI ✅
- [x] 고객 목록 컴포넌트 ✅
  - [x] 검색 기능 ✅
  - [x] 필터링 (채널별, 거래처별, 상태별) ✅
  - [x] 정렬 (시간, 우선순위) ✅
- [x] 대화 상세 컴포넌트 ✅
  - [x] 메시지 타임라인 ✅
  - [x] 채널/병원 배지 ✅
  - [x] 원문/번역 토글 ✅
  - [x] AI 응답 표시 ✅
- [x] 고객 프로필 패널 ✅
  - [x] 기본 정보 표시 ✅
  - [x] 연결된 채널 목록 ✅
  - [x] 메모 추가/편집 ✅
  - [x] 태그 관리 ✅
- [x] 메시지 입력 컴포넌트 ✅
  - [x] 텍스트 입력 ✅
  - [x] 번역 토글 ✅
- [x] 내부 노트 기능 ✅
  - [x] 팀원 간 코멘트 ✅
  - [x] @멘션 지원 ✅
  - [x] 내부/고객 탭 분리 ✅
- [x] 상담 태그 시스템 ✅
- [x] SLA 대기시간 표시 ✅

#### 1.9 DeepL 번역 시스템 ✅
- [x] DeepL API 클라이언트 ✅
- [x] 수신 메시지 자동 번역 ✅
- [x] 발신 메시지 자동 번역 ✅
- [x] 언어 감지 ✅
- [x] Papago 폴백 지원 ✅

---

### 12.2 Phase 2: LLM RAG 자동응대 ✅ COMPLETED

#### 2.1 RAG 파이프라인 - Query Processing ✅
- [x] 언어 감지 모듈 ✅
- [x] 의도 분류 (Intent Classification) ✅
- [x] 엔티티 추출 ✅
- [x] 쿼리 재작성 (Query Rewriting) ✅

#### 2.2 RAG 파이프라인 - Retrieval ✅
- [x] Vector Search 구현 (pgvector) ✅
- [x] Full-text Search 구현 ✅
- [x] Hybrid Search (RRF 알고리즘) ✅
- [x] 테넌트별 검색 격리 ✅
- [x] 검색 결과 필터링 ✅

#### 2.3 RAG 파이프라인 - Re-ranking ✅
- [x] Relevance Score 계산 ✅
- [x] Diversity Filter ✅

#### 2.4 RAG 파이프라인 - Context Augmentation ✅
- [x] Retrieved Docs 조합 ✅
- [x] 대화 히스토리 포함 ✅
- [x] 고객 프로필 포함 ✅
- [x] 테넌트 설정 포함 ✅

#### 2.5 LLM Router ✅
- [x] GPT-4 클라이언트 ✅
- [x] Claude 클라이언트 ✅
- [x] 쿼리 복잡도 분석 ✅
- [x] 라우팅 로직 구현 ✅
- [x] 폴백 처리 ✅

#### 2.6 Response Validation ✅
- [x] Safety Check ✅
- [x] Confidence Score 계산 ✅
  - [x] Retrieval 점수 (0.20) ✅
  - [x] Generation 점수 (0.25) ✅
  - [x] Factuality 점수 (0.30) ✅
  - [x] Domain 점수 (0.15) ✅
  - [x] Consistency 점수 (0.10) ✅
- [x] 에스컬레이션 키워드 감지 ✅
- [x] 민감 주제 감지 ✅

#### 2.7 에스컬레이션 시스템 ✅
- [x] 에스컬레이션 생성 로직 ✅
- [x] 우선순위 자동 설정 ✅
- [x] 담당자 자동 할당 ✅
- [x] 에스컬레이션 서비스 ✅
- [x] 에스컬레이션 API ✅

#### 2.8 지식베이스 관리 ✅
- [x] 문서 업로드 UI ✅
- [x] 문서 편집기 ✅
- [x] 임베딩 생성 (OpenAI) ✅
- [x] 문서 버전 관리 ✅
- [x] 카테고리 관리 ✅
- [x] 태그 관리 ✅
- [x] 문서 검색 ✅
- [x] 지식베이스 API ✅
- [x] 임베딩 재생성 기능 ✅
- [x] 에스컬레이션에서 지식 추출 ✅
- [x] 대량 문서 가져오기 ✅

#### 2.9 테넌트(거래처) 설정 ✅
- [x] 테넌트 생성/편집 서비스 ✅
- [x] 시스템 프롬프트 설정 ✅
- [x] AI 설정 관리 ✅
- [x] 에스컬레이션 규칙 설정 ✅

#### 2.10 CRM API 연동 ✅
- [x] CRM API 클라이언트 구현 ✅
- [x] 고객 정보 조회/동기화 ✅
- [x] 예약 조회/생성/수정 ✅
- [x] 메모 추가 ✅
- [x] 태그 동기화 ✅
- [x] React Query Hooks ✅

---

### 12.3 Phase 3: 자동화 및 고급 기능 ✅ COMPLETED

#### 3.1 카카오톡 채널 연동 ✅
- [x] 카카오 i Open Builder 어댑터 ✅
- [x] 카카오톡 채널 웹훅 핸들러 ✅
- [x] 메시지 수신/발송 ✅
- [x] Skill 응답 생성 ✅
- [x] Quick Replies 지원 ✅
- [x] 콜백 비동기 메시징 ✅
- [x] 알림톡/친구톡 API 지원 ✅

#### 3.2 자동화 규칙 엔진 ✅
- [x] 트리거 타입 정의 ✅
  - [x] message_received ✅
  - [x] conversation_created ✅
  - [x] booking_confirmed ✅
  - [x] booking_reminder ✅
  - [x] visit_completed ✅
  - [x] no_response ✅
  - [x] customer_tagged ✅
  - [x] escalation_created ✅
- [x] 조건 평가 (AND/OR 로직, 연산자) ✅
- [x] 액션 정의 ✅
  - [x] send_message ✅
  - [x] send_notification ✅
  - [x] update_status ✅
  - [x] add_tag ✅
  - [x] assign_agent ✅
  - [x] create_escalation ✅
  - [x] sync_crm ✅
  - [x] webhook ✅
  - [x] branch (조건부 분기) ✅
- [x] 규칙 실행 엔진 ✅
- [x] 실행 로그 ✅
- [x] 실행 제한 및 쿨다운 ✅

#### 3.3 Progressive Learning Loop ✅
- [x] 에스컬레이션 답변 수집 ✅
- [x] 대화 컨텍스트 추출 ✅
- [x] LLM 기반 지식 추출 ✅
- [x] 질문 패러프레이즈 생성 ✅
- [x] 자동 카테고리/태그 할당 ✅
- [x] 자동 KB 업데이트 ✅
- [x] 미학습 에스컬레이션 배치 처리 ✅
- [x] 학습 통계 ✅

#### 3.4 음성 메시지 처리 (Phase 6으로 이동)
- [ ] Whisper API 연동
- [ ] 음성 → 텍스트 변환
- [ ] RAG 파이프라인 연결

#### 3.5 이미지 분석 (Phase 6으로 이동)
- [ ] GPT-4 Vision 연동
- [ ] 이미지 분석
- [ ] 이미지 기반 상담

#### 3.6 챗봇 위젯 (Phase 6으로 이동)
- [ ] React 위젯 컴포넌트
- [ ] 커스터마이징 옵션
- [ ] 임베드 스크립트 생성

#### 3.7 분석 대시보드 ✅
- [x] 실시간 현황 위젯 ✅
- [x] 채널별 문의량 차트 ✅
- [x] AI 정확도 분석 ✅
- [x] 에스컬레이션 추이 ✅
- [x] 응답 시간 분석 ✅
- [x] 시간대별/요일별 분석 ✅
- [x] 모델 사용량 추적 ✅

#### 3.8 만족도 조사 시스템 ✅
- [x] 만족도 조사 발송 ✅
- [x] 응답 처리 ✅
- [x] 다국어 템플릿 (KO, EN, JA, ZH, VI, TH) ✅
- [x] Quick Reply 평점 버튼 ✅
- [x] 조사 통계 ✅

#### 3.9 CRM 동기화 서비스 ✅
- [x] 고객 동기화 ✅
- [x] 예약 동기화 ✅
- [x] 노트 동기화 ✅
- [x] CRM에서 데이터 가져오기 ✅
- [x] 대화 해결 시 자동 동기화 ✅
- [x] CRM 웹훅 처리 ✅
- [x] 전체 동기화 작업 ✅

---

### 12.4 Phase 4: 엔터프라이즈 기능 ✅ COMPLETED

#### 4.1 멀티 테넌트 관리 ✅
- [x] 데이터 완전 격리 (RLS) ✅
- [x] 테넌트별 리소스 제한 ✅
- [x] 테넌트 관리 콘솔 ✅
- [x] 테넌트 설정 UI ✅

#### 4.2 SSO/SAML 인증 ✅
- [x] SAML 2.0 지원 ✅
- [x] OAuth 2.0 확장 ✅
- [x] SSO 설정 UI ✅
- [x] 인증 서비스 구현 ✅

#### 4.3 감사 로그 ✅
- [x] 모든 액션 로깅 ✅
- [x] 로그 검색 UI ✅
- [x] 로그 내보내기 ✅
- [x] 보존 정책 ✅
- [x] 감사 로그 API ✅

#### 4.4 SLA 모니터링 ✅
- [x] SLA 정의 설정 ✅
- [x] 실시간 모니터링 ✅
- [x] 위반 알림 ✅
- [x] SLA 리포트 ✅
- [x] SLA 서비스 구현 ✅

#### 4.5 화이트라벨링 ✅
- [x] 브랜딩 설정 UI ✅
- [x] 커스텀 도메인 ✅
- [x] 이메일 템플릿 커스터마이징 ✅
- [x] 화이트라벨 서비스 구현 ✅

#### 4.6 외부 API 제공 ✅
- [x] API 키 관리 ✅
- [x] API 문서 (Swagger) ✅
- [x] Rate Limiting ✅
- [x] API 사용량 대시보드 ✅
- [x] 웹훅 관리 ✅

#### 4.7 Phase 4 데이터베이스 스키마 ✅
- [x] audit_logs 테이블 ✅
- [x] sla_configurations 테이블 ✅
- [x] sla_violations 테이블 ✅
- [x] whitelabel_settings 테이블 ✅
- [x] api_keys 테이블 ✅
- [x] tenant_webhooks 테이블 ✅
- [x] sso_configurations 테이블 ✅

---

### 12.5 Phase 5: Meta Platform + 추가 채널 통합 ✅ COMPLETED

#### 5.1 Facebook Messenger 어댑터 ✅
- [x] Webhook 핸들러 ✅
- [x] 메시지 수신/발송 ✅
- [x] 서명 검증 ✅
- [x] 사용자 프로필 조회 ✅
- [x] Quick Replies 지원 ✅

#### 5.2 Instagram DM 어댑터 ✅
- [x] Webhook 핸들러 ✅
- [x] 메시지 수신/발송 ✅
- [x] 스토리 멘션 처리 ✅
- [x] 미디어 메시지 지원 ✅

#### 5.3 WhatsApp Business 어댑터 ✅
- [x] Webhook 핸들러 ✅
- [x] 메시지 수신/발송 ✅
- [x] 템플릿 메시지 ✅
- [x] 미디어 메시지 ✅
- [x] 읽음 확인 처리 ✅

#### 5.4 Meta 통합 Webhook ✅
- [x] 통합 Webhook 핸들러 (`/api/webhooks/meta`) ✅
- [x] 채널 타입 자동 감지 ✅
- [x] 서명 검증 통합 ✅

#### 5.5 Meta OAuth 연동 ✅
- [x] OAuth 서비스 구현 ✅
- [x] 토큰 관리 ✅
- [x] 페이지 목록 조회 ✅
- [x] 권한 범위 관리 ✅

#### 5.6 채널 관리 UI ✅
- [x] 채널 목록 페이지 ✅
- [x] 채널 연동 마법사 ✅
- [x] OAuth 플로우 UI ✅
- [x] 채널 상태 모니터링 ✅

#### 5.7 WeChat 어댑터 ✅
- [x] Official Account API 연동 ✅
- [x] XML 메시지 파싱 ✅
- [x] 메시지 수신/발송 ✅
- [x] 템플릿 메시지 ✅
- [x] Access Token 관리 ✅
- [x] Webhook 핸들러 (`/api/webhooks/wechat`) ✅

#### 5.8 고객 프로필 통합 강화 ✅
- [x] CustomerProfile 타입 확장 ✅
- [x] CustomerStats 통계 ✅
- [x] CustomerTimeline 이벤트 ✅
- [x] 프로필 API (`/api/customers/[id]/profile`) ✅
- [x] 타임라인 API (`/api/customers/[id]/timeline`) ✅
- [x] CRM 동기화 API (`/api/customers/[id]/sync`) ✅
- [x] 중복 고객 탐지 API (`/api/customers/[id]/duplicates`) ✅
- [x] 고객 병합 API (`/api/customers/[id]/merge`) ✅
- [x] 채널 정보로 고객 업데이트 ✅

#### 5.9 메시지 템플릿 관리 ✅
- [x] Template 서비스 구현 ✅
- [x] 변수 추출/적용 로직 ✅
- [x] 다국어 템플릿 지원 ✅
- [x] 채널별 설정 ✅
- [x] 템플릿 API (CRUD) ✅
- [x] 템플릿 복제 기능 ✅
- [x] 기본 템플릿 생성 ✅
- [x] message_templates 테이블 마이그레이션 ✅

---

### 12.6 Phase 6: AI 고도화 + 확장 ✅ COMPLETED

#### 6.1 음성 메시지 처리 ✅
- [x] Whisper API 연동 (`/src/services/ai/voice-processing.ts`) ✅
- [x] 음성 → 텍스트 변환 ✅
- [x] RAG 파이프라인 연결 ✅
- [x] 타임스탬프 세그먼트 지원 ✅
- [x] 언어 자동 감지 ✅

#### 6.2 이미지 분석 ✅
- [x] GPT-4 Vision 연동 (`/src/services/ai/image-analysis.ts`) ✅
- [x] 이미지 분석 파이프라인 ✅
- [x] 시술 전후 사진 분석 (다중 이미지) ✅
- [x] 의료 이미지 전문 분석 ✅
- [x] 문서 OCR (영수증, 신분증, 의료기록) ✅

#### 6.3 Sentiment Analysis ✅
- [x] 감정 분석 모델 연동 (`/src/services/ai/sentiment-analysis.ts`) ✅
- [x] 감정 점수 계산 (-1 ~ 1) ✅
- [x] 우선순위 자동 조정 ✅
- [x] 감정 추이 분석 ✅
- [x] 부정 감정 에스컬레이션 ✅
- [x] 감정 대시보드 데이터 ✅

#### 6.4 Conversion Prediction ✅
- [x] LLM 기반 전환 예측 (`/src/services/ai/conversion-prediction.ts`) ✅
- [x] 전환 확률 스코어링 ✅
- [x] 고가치 고객 식별 ✅
- [x] 예측 기반 우선순위 ✅
- [x] 전환 퍼널 분석 ✅
- [x] 배치 예측 업데이트 ✅

#### 6.5 Proactive Outreach ✅
- [x] 관심 고객 자동 식별 (`/src/services/ai/proactive-outreach.ts`) ✅
- [x] AI 맞춤 메시지 생성 ✅
- [x] 캠페인 생성/실행 ✅
- [x] 응답률 추적 ✅
- [x] 아웃리치 분석 대시보드 ✅
- [x] 다국어 템플릿 (KO, EN, JA, ZH) ✅

#### 6.6 예약 캘린더 동기화 ✅
- [x] Google Calendar API 연동 (`/src/services/calendar-sync.ts`) ✅
- [x] Naver Calendar API 연동 ✅
- [x] 양방향 동기화 ✅
- [x] 충돌 감지 및 대안 시간 제안 ✅
- [x] OAuth 토큰 관리 ✅

#### 6.7 챗봇 위젯 ✅
- [x] React 위젯 컴포넌트 (`/src/components/widget/ChatWidget.tsx`) ✅
- [x] 커스터마이징 옵션 (색상, 위치, 스타일) ✅
- [x] 위젯 API (`/api/widget/session`, `/api/widget/message`, `/api/widget/config`) ✅
- [x] 위젯 서비스 (`/src/services/widget.ts`) ✅
- [x] 임베드 코드 생성 ✅

#### 6.8 Fine-tuning 파이프라인 (Phase 7로 이동)
- [ ] 학습 데이터 수집 UI
- [ ] 데이터 정제/검수
- [ ] LoRA 학습 설정
- [ ] 모델 배포
- [ ] A/B 테스트

#### 6.9 환자 포털 (Phase 7로 이동)
- [ ] 별도 Next.js 앱 생성
- [ ] 환자 로그인/회원가입
- [ ] 예약 조회/변경
- [ ] 상담 내역 조회
- [ ] 문서 다운로드
- [ ] 다국어 지원

#### 6.10 경쟁사 분석 (Phase 7로 이동)
- [ ] 웹 스크래핑 설정
- [ ] 가격 정보 수집
- [ ] 서비스 비교 분석
- [ ] 리포트 생성
- [ ] 알림 설정

#### 6.11 성능 최적화 (지속)
- [ ] 데이터베이스 쿼리 최적화
- [ ] 캐싱 전략 개선
- [ ] API 응답 시간 개선
- [ ] 프론트엔드 번들 최적화

#### 6.12 테스트 및 안정화 (지속)
- [ ] 단위 테스트 커버리지 향상
- [ ] E2E 테스트 구현
- [ ] 부하 테스트
- [ ] 보안 감사

---

### 12.7 Phase 7: 고도화 및 최적화 ✅ COMPLETED

#### 7.1 Fine-tuning 파이프라인 ✅
- [x] Fine-tuning 서비스 구현 (`/src/services/ai/fine-tuning.ts`) ✅
- [x] 에스컬레이션 기반 학습 데이터 수집 ✅
- [x] OpenAI Fine-tuning API 연동 ✅
- [x] 학습 작업 관리 (생성, 모니터링, 취소) ✅
- [x] 모델 A/B 테스트 설정 ✅
- [ ] 학습 데이터 검수 UI
- [ ] 모델 배포 및 전환 UI

#### 7.2 경쟁사 분석 ✅
- [x] 경쟁사 분석 서비스 (`/src/services/competitor-analysis.ts`) ✅
- [x] 가격 정보 수집 및 비교 ✅
- [x] AI 기반 인사이트 생성 ✅
- [x] 경쟁사 리포트 생성 ✅
- [x] 가격 알림 설정 ✅
- [ ] 웹 스크래핑 자동화

#### 7.3 성능 최적화 ✅
- [x] 성능 최적화 서비스 (`/src/services/performance-optimization.ts`) ✅
- [x] Upstash Redis 스마트 캐싱 ✅
- [x] 응답 시간 추적 및 메트릭 ✅
- [x] 캐시 히트율 모니터링 ✅
- [x] 최적화 권장사항 생성 ✅
- [ ] 데이터베이스 쿼리 최적화 적용
- [ ] 프론트엔드 번들 최적화

#### 7.4 Upstash Vector 통합 ✅
- [x] Upstash Vector 서비스 (`/src/services/upstash-vector.ts`) ✅
- [x] 벡터 임베딩 생성 및 저장 ✅
- [x] 시맨틱 검색 구현 ✅
- [x] 하이브리드 검색 (벡터 + 키워드) ✅
- [x] 문서 청킹 및 인덱싱 ✅
- [x] 테넌트별 네임스페이스 격리 ✅

#### 7.5 테스트 인프라 ✅
- [x] Vitest 설정 (`/vitest.config.ts`) ✅
- [x] 테스트 환경 설정 (`/src/test/setup.ts`) ✅
- [x] RAG 파이프라인 테스트 (`/src/test/services/rag-pipeline.test.ts`) ✅
- [x] 채널 어댑터 테스트 (`/src/test/services/channels.test.ts`) ✅
- [x] 번역 서비스 테스트 (`/src/test/services/translation.test.ts` - 17 tests) ✅
- [x] 템플릿 서비스 테스트 (`/src/test/services/templates.test.ts` - 14 tests) ✅
- [x] LLM 라우터 테스트 (`/src/test/services/llm.test.ts` - 13 tests) ✅
- [x] SLA 모니터링 테스트 (`/src/test/services/sla-monitoring.test.ts` - 16 tests) ✅
- [x] 만족도 조사 테스트 (`/src/test/services/satisfaction-survey.test.ts` - 13 tests) ✅
- [x] QStash 작업큐 테스트 (`/src/test/services/qstash.test.ts` - 7 tests) ✅
- [x] 총 98개 단위 테스트 통과 (8개 파일) ✅
- [x] E2E 테스트 (Playwright) - 21개 테스트 전체 통과 ✅
- [ ] 통합 테스트 추가

#### 7.6 Sentry 에러 모니터링 ✅
- [x] @sentry/nextjs 설치 ✅
- [x] 클라이언트 설정 (`/sentry.client.config.ts`) ✅
- [x] 서버 설정 (`/sentry.server.config.ts`) ✅
- [x] Edge 설정 (`/sentry.edge.config.ts`) ✅
- [x] next.config.ts withSentryConfig 래핑 ✅
- [x] 글로벌 에러 바운더리 (`/src/app/global-error.tsx`) ✅
- [x] 환경변수 설정 (SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT) ✅
- [ ] Sentry 프로젝트 생성 후 실제 DSN 값 `.env.local`에 등록 (대기 중)

#### 7.7 CI/CD 파이프라인 ✅
- [x] GitHub Actions 워크플로우 (`.github/workflows/ci.yml`) ✅
- [x] Lint → Test → Build → Deploy 파이프라인 ✅
- [x] PR 시 Preview 배포 (Vercel) ✅
- [x] main push 시 Production 배포 ✅
- [x] GitHub 웹 인터페이스에서 workflow 파일 직접 커밋 완료 ✅

#### 7.8 Slack 알림 서비스 ✅
- [x] Slack Web API 기반 알림 서비스 (`/src/services/slack-notification.ts`) ✅
- [x] 에스컬레이션 알림 (우선순위별 이모지, Block Kit UI) ✅
- [x] 예약 확정 알림 ✅
- [x] 24시간 무응답 알림 ✅
- [x] 기존 Webhook 방식 호환 유지 ✅
- [x] escalation-notify 라우트 Slack Web API 통합 ✅

#### 7.9 LINE 채널 자격증명 등록 ✅
- [x] LINE Channel ID, Secret, Access Token `.env.local` 등록 ✅
- [x] LINE Bot Basic ID 등록 (@246kdolz) ✅

#### 7.10 환자 포털 (별도 앱) ✅
- [x] 별도 Next.js 앱 생성 (`/portal`) ✅
- [x] 환자 로그인 (이메일 인증 코드) ✅
- [x] 예약 조회/변경 ✅
- [x] 상담 내역 조회 ✅
- [x] 문서 다운로드 ✅
- [x] 다국어 지원 (KO, EN, JA, ZH, VI, TH) ✅

#### 7.12 E2E 테스트 (Playwright) ✅
- [x] Playwright 설정 (`/web/playwright.config.ts`) ✅
- [x] 전 페이지 렌더링 테스트 (9개 페이지) ✅
- [x] 인박스 기능 테스트 (12개 시나리오) ✅
- [x] 총 21개 E2E 테스트 전체 통과 ✅
- [x] npm scripts 추가 (`test:e2e`, `test:e2e:ui`) ✅

#### 7.13 프로덕션 최적화 ✅
- [x] next.config.ts 보안 헤더 (X-Frame-Options, CSP 등) ✅
- [x] 이미지 최적화 (AVIF/WebP 포맷, Supabase 리모트 패턴) ✅
- [x] API 라우트 캐시 헤더 (no-store) ✅
- [x] Sentry 소스맵 삭제 후 업로드 ✅

#### 7.11 사이드바 페이지 구현 ✅
- [x] 채널 관리 페이지 (`/channels`) - 채널 요약 카드, 연동 섹션, 채널 목록/추가/삭제 ✅
- [x] 거래처 관리 페이지 (`/tenants`) - 거래처 카드, AI 설정 다이얼로그, 통계 ✅
- [x] 담당자 관리 페이지 (`/team`) - 팀원 목록, 역할 RBAC, 초대 다이얼로그 ✅
- [x] 설정 메인 페이지 (`/settings`) - 5탭 구성 (일반/AI/번역/알림/채널) ✅
- [x] Playwright E2E 렌더링 검증 완료 ✅

#### 7.14 LLM 7개 기능 전체 구현 완료 ✅
- [x] **기능 1: 담당자 수동 번역** - `POST /api/messages` 엔드포인트 + DeepL `to_customer` 번역 + QStash 발송 ✅
- [x] **기능 2: AI RAG 파이프라인** - 이전 Phase에서 완료 (pgvector + RRF + GPT-4/Claude) ✅
- [x] **기능 3: 리마인드 AI** - `/api/jobs/check-no-response` 크론 API + Slack 알림 + 에스컬레이션 자동 생성 ✅
- [x] **기능 4: 이미지 인식** - LINE/Meta 웹훅 Step 5.5에 `analyzeImage()` (GPT-4V) 연결 ✅
- [x] **기능 5: 음성 인식** - LINE/Meta 웹훅 Step 5.5에 `transcribeVoiceFromUrl()` (Whisper) 연결 ✅
- [x] **기능 6: CRM 자동 액션** - `rule-engine.ts`에 `create_crm_booking/update_crm_customer/add_crm_note` 핸들러 추가 ✅
- [x] **기능 7: 자동 태그** - 이전 Phase에서 완료 (`add_customer_tag/update_consultation_tag`) ✅
- [x] TypeScript 빌드 에러 수정 (spread types fix in webhook routes) ✅
- [x] `claude.ai.md` LLM 감사 문서 전체 업데이트 (7/7 완료) ✅

#### 7.15 Vercel 배포 설정 ✅
- [x] `vercel.json` 생성 (루트 디렉토리 → `web/` 서브디렉토리 빌드 설정) ✅
- [x] `buildCommand: "cd web && npm install && npm run build"` ✅
- [x] `outputDirectory: "web/.next"` ✅
- [x] 404 NOT_FOUND 오류 수정 (Root Directory 미설정 문제) ✅

#### 7.16 전체 UI/UX 업그레이드 ✅
- [x] `globals.css` 업그레이드 - `card-3d`, `hero-gradient`, `ai-glow-pulse`, `progress-shine`, `float-slow`, `float-medium`, `animate-in-scale` CSS 클래스 추가 ✅
- [x] **대시보드** (`/dashboard`) - 시간대별 인사, hero gradient, AI Insight 카드, card-3d 효과 ✅
- [x] **통합 인박스** (`/inbox`) - 3패널 입장 애니메이션, AI 어시스턴트 라벨, amber 내부노트, AnimatePresence 필터링 ✅
- [x] **채널 관리** (`/channels`) - `\uXXXX` → UTF-8 변환, card-3d, 그라디언트 헤더 (blue→cyan) ✅
- [x] **거래처 관리** (`/tenants`) - card-3d, backdrop-blur-sm, 그라디언트 헤더 (emerald→teal) ✅
- [x] **지식베이스** (`/knowledge`) - card-3d, progress-shine, 그라디언트 헤더 (amber→orange) ✅
- [x] **담당자 관리** (`/team`) - card-3d, rounded-2xl, 그라디언트 헤더 (blue→indigo) ✅
- [x] **에스컬레이션** (`/escalations`) - card-3d, progress-shine SLA바, 그라디언트 헤더 (red→rose) ✅
- [x] **분석/리포트** (`/analytics`) - card-3d, progress-shine 차트바, 그라디언트 헤더 (violet→purple) ✅
- [x] **설정** (`/settings`) - card-3d, progress-shine 슬라이더, 그라디언트 헤더 (slate→zinc) ✅
- [x] 전체 빌드 검증 통과 (Next.js 16.1.4 Turbopack, 0 errors) ✅

#### 7.17 인박스 UI 고도화 (2026-01-28) ✅
- [x] `react-resizable-panels` v4 설치 + shadcn `resizable.tsx` 래퍼 생성 ✅
- [x] 3단 리사이즈 패널 (기본 28/44/28, min/max 제한) ✅
- [x] `HospitalMultiSelect` 컴포넌트 (검색 가능 콤보박스, 10개 병원 프리셋) ✅
- [x] `TagFilterPanel` 컴포넌트 (3카테고리: 상담/상태/고객 태그) ✅
- [x] 채팅 스크롤 수정 (native div + `useRef` + auto-scroll + scroll-to-bottom 버튼) ✅
- [x] Quick Reply 템플릿 (인사/예약안내/가격안내/감사인사 등) ✅
- [x] 키보드 단축키 (⌘K 검색, Escape 초기화) ✅
- [x] 메시지 호버 액션 (복사, 답장) ✅
- [x] 감정 분석 인디케이터 + AI 전환 확률 점수 ✅
- [x] 대화 고정/북마크, 담당자 표시, 시스템 메시지 구분 ✅
- [x] 활성 필터 칩 + 개별 제거, 긴급/대기 퀵 스탯 ✅
- [x] TypeScript 빌드 통과 (Next.js 16.1.4 Turbopack) ✅
- [x] Vercel 프로덕션 배포 완료 (42초 빌드) ✅

**UI/UX 업그레이드 공통 적용 사항:**
- 모든 easing 커브: `[0.22, 1, 0.36, 1]` (표준화)
- `hover-lift` → `card-3d` (3D perspective 호버 효과)
- Cards: `rounded-2xl`, Badges: `rounded-full`
- 페이지별 고유 그라디언트 헤더 아이콘 + `text-white`
- `progress-shine` 애니메이션 바
- 한국어 UTF-8 문자 (절대 `\uXXXX` 사용 금지)
- 친근하고 따뜻한 설명 텍스트 ("~하세요" 어미)

#### 7.18 인박스 3패널 레이아웃 수정 (2026-01-28) ✅
- [x] **근본 원인 발견**: `react-resizable-panels` v4에서 `defaultSize={28}` (number)은 **28픽셀**로 해석됨. 퍼센트가 아님! ✅
  - v4 `pt()` 함수: `typeof number → [value, "px"]`, `typeof string → [value, "%"]`
  - 수정: `defaultSize={28}` → `defaultSize="28%"` (string percentage)
- [x] `ResizablePanelGroup` className에서 `flex` 제거 (라이브러리 내부 `display:flex` 충돌) ✅
- [x] 사이드바 collapsed 상태를 Layout과 동기화 (props 전달) ✅
- [x] 인박스 레이아웃 `h-full` + `flex-1 overflow-hidden p-3` 최적화 ✅
- [x] 패널 크기: 좌측 28% (대화목록) / 중앙 44% (채팅) / 우측 28% (고객프로필) ✅
- [x] Playwright 검증: 456px / 716px / 456px (1920x1080 기준) ✅

#### 7.19 메신저 채널 연동 가이드 (2026-01-28)

##### LINE 채널 연동 (완료)
- **Webhook URL**: `https://csflow.vercel.app/api/webhooks/line`
- **LINE 자격증명** (.env.local):
  - `LINE_CHANNEL_ACCESS_TOKEN` ✅
  - `LINE_CHANNEL_SECRET=4d6ed56d04080afca0d60e42464ec49b` ✅
  - `LINE_CHANNEL_ID=2008754781` ✅
  - `LINE_BOT_BASIC_ID=@246kdolz` ✅
- **LINE Developers Console 설정 필요**:
  1. https://developers.line.biz/ → 채널 선택
  2. Messaging API → Webhook settings → URL: `https://csflow.vercel.app/api/webhooks/line`
  3. "Use webhook" 토글 ON
  4. "Verify" 버튼 클릭하여 검증
- **DB 필요**: `channel_accounts` 테이블에 LINE 채널 레코드 필요 (account_id = LINE Bot User ID)

##### Meta Platform 연동 (Facebook/Instagram/WhatsApp)
- **통합 Webhook URL**: `https://csflow.vercel.app/api/webhooks/meta`
- **Webhook Verify Token**: `cs_automation_verify_token`
- **Facebook App ID**: `779249264859459`
- **Meta Developer Console 설정 필요**:
  1. https://developers.facebook.com/ → App 선택
  2. Webhooks → Page subscriptions → Callback URL: `https://csflow.vercel.app/api/webhooks/meta`
  3. Verify Token: `cs_automation_verify_token`
  4. 구독 필드: `messages`, `messaging_postbacks`, `messaging_optins`
  5. Instagram: `instagram_manage_messages` 권한 필요
  6. WhatsApp: Business Account 연결 + 전화번호 등록 필요
- **OAuth Redirect URI**: `https://csflow.vercel.app/api/oauth/meta`

##### 연동 전 필수 사전 조건
1. **Supabase 마이그레이션 실행** (아직 미실행 시):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_message_templates.sql`
   - `web/supabase/phase4-schema.sql`
2. **채널 관리 UI에서 채널 등록** → Supabase `channel_accounts` 테이블에 자동 저장됨
3. **거래처(tenant) 자동 생성** → 첫 채널 등록 시 기본 거래처가 자동 생성됨

#### 7.20 채널 등록 DB 연동 (2026-01-28) ✅
- [x] `POST /api/channels` API에 직접 자격증명 채널(LINE, KakaoTalk, WeChat) 지원 추가 ✅
  - 기존 Meta OAuth 채널(Facebook, Instagram, WhatsApp)과 병행 지원
  - `channel_accounts` 테이블에 INSERT → Supabase 영구 저장
  - 중복 채널 감지 (tenant_id + channel_type + account_id)
  - 기본 거래처 자동 생성 (테넌트 미존재 시)
- [x] `GET /api/channels` API → `channel_accounts` 테이블 직접 쿼리로 변경 ✅
- [x] `DELETE /api/channels` → UUID 기반 삭제 + 레거시 호환 ✅
- [x] 채널 추가 폼 채널별 필드 분기 ✅
  - **LINE**: 채널 ID, 채널 액세스 토큰, 채널 시크릿, 봇 Basic ID
  - **KakaoTalk**: REST API 키, Admin 키
  - **WeChat**: 앱 ID, 앱 시크릿
- [x] `handleAddChannel` → API 호출로 변경 (기존: React state만 업데이트) ✅
- [x] LINE 채널 등록 완료 (Supabase 저장 확인) ✅
  - Tenant ID: `8d3bd24e-0d74-4dc7-aa34-3e39d5821244`
  - Channel ID: `dc37a525-0388-4fb0-8345-f9d1cece3171`
  - credentials JSONB: `{ access_token, channel_secret, channel_id, bot_basic_id }`
  - webhook_url: `https://csflow.vercel.app/api/webhooks/line`
- [x] DB 저장 구조:
  ```
  channel_accounts 테이블:
  - id: UUID (auto-generated)
  - tenant_id: UUID (FK → tenants.id)
  - channel_type: "line" | "kakao" | "wechat" | "facebook" | "instagram" | "whatsapp"
  - account_name: "CS Command LINE"
  - account_id: "2008754781" (LINE Channel ID)
  - credentials: JSONB { access_token, channel_secret, channel_id, bot_basic_id }
  - is_active: true
  - webhook_url: "https://csflow.vercel.app/api/webhooks/line"
  - created_at, updated_at
  ```

#### 7.21 인박스 DB 연동 + 번역 색상 + 거래처별 채널 관리 (2026-01-28) ✅
- [x] **인박스 실시간 DB 연동** ✅
  - `/api/conversations` API 신규 생성 → conversations + customers + channel_accounts + tenants JOIN 쿼리
  - `/api/conversations/[id]/messages` API 신규 생성 → 대화별 메시지 조회
  - Supabase Realtime 구독 (conversations, messages 테이블 변경 감지)
  - DB 대화 + Mock 대화 병합 표시 (DB 우선, Mock은 데모용)
  - 대화 선택 시 실시간 메시지 로딩 + 스피너
  - 메시지 전송 시 `POST /api/messages` API 호출 (DB 대화만)
  - 고객 프로필 동적 생성 (선택된 대화의 customer 데이터)
- [x] **번역 텍스트 색상 가독성 수정** ✅
  - 에이전트 메시지 (파란색 배경): `text-primary-foreground/80` (밝은 색)
  - 고객 메시지 (일반 배경): `text-muted-foreground` (기존 유지)
  - 번역 라벨, 테두리도 배경에 맞게 조건부 적용
- [x] **거래처별 채널 관리** ✅
  - `/api/tenants` API 신규 생성 → 전체 거래처 목록 조회
  - 채널 관리 페이지 헤더에 거래처 선택 드롭다운 추가
  - 거래처 변경 시 해당 거래처 채널만 표시
  - 채널 추가 시 선택된 거래처에 자동 연결

#### 7.22 전체 프론트엔드 DB 연동 (2026-01-28) ✅
- [x] **9개 전체 페이지 Mock 데이터 제거 → API Route 기반 실시간 DB 데이터 전환** ✅
- [x] **대시보드** (`/dashboard`) — `GET /api/dashboard/stats` 실시간 통계 (대화, 메시지, AI, 에스컬레이션, 고객) ✅
- [x] **통합 인박스** (`/inbox`) — `GET/POST /api/conversations`, `GET /api/conversations/[id]/messages` + Supabase Realtime 구독 ✅
- [x] **채널 관리** (`/channels`) — `GET/POST/DELETE /api/channels`, `GET /api/channels/available` CRUD + 거래처별 필터 ✅
- [x] **거래처 관리** (`/tenants`) — `GET/POST/PATCH/DELETE /api/tenants` CRUD + AI 설정 다이얼로그 ✅
- [x] **지식베이스** (`/knowledge`) — `GET/POST/PATCH/DELETE /api/knowledge/documents`, `POST /api/knowledge/documents/[id]/embed` ✅
- [x] **담당자 관리** (`/team`) — `GET/POST/PATCH/DELETE /api/team` CRUD + 역할/상태 관리 + 초대 ✅
- [x] **에스컬레이션** (`/escalations`) — `GET/PATCH /api/escalations` + 담당자 배정 (optimistic update) + 상태 변경 + 30초 자동 새로고침 ✅
- [x] **분석/리포트** (`/analytics`) — `GET /api/analytics?period=` 기간별 통계 (KPI, 채널분포, 일별트렌드, 거래처성과, 언어분포, 에스컬레이션사유, 응답시간) ✅
- [x] **설정** (`/settings`) — `GET/PATCH /api/settings` 5탭 전체 설정 로드/저장 (일반/AI/번역/알림/채널) ✅
- [x] **전체 빌드 검증 통과** (Next.js 16.1.4 Turbopack, 30 pages + 42 API routes, 0 TypeScript errors) ✅

---

## 13. 프로젝트 구조

```
csautomation/
├── apps/
│   ├── web/                    # Next.js 14 Admin Dashboard
│   │   ├── app/
│   │   │   ├── (auth)/        # 인증 관련 페이지
│   │   │   ├── (dashboard)/   # 대시보드 페이지
│   │   │   │   ├── inbox/     # 통합 인박스
│   │   │   │   ├── channels/  # 채널 관리
│   │   │   │   ├── tenants/   # 거래처 관리
│   │   │   │   ├── knowledge/ # 지식베이스
│   │   │   │   ├── escalations/
│   │   │   │   ├── analytics/
│   │   │   │   └── settings/
│   │   │   └── api/           # API Routes
│   │   ├── components/
│   │   │   ├── ui/            # shadcn/ui 컴포넌트
│   │   │   ├── inbox/         # 인박스 컴포넌트
│   │   │   ├── chat/          # 채팅 컴포넌트
│   │   │   └── ai/            # AI 상태 컴포넌트
│   │   └── lib/
│   │       ├── supabase/      # Supabase 클라이언트
│   │       ├── api/           # API 클라이언트
│   │       └── utils/
│   │
│   ├── widget/                 # 임베더블 챗봇 위젯
│   └── portal/                 # 환자 포털 (추후)
│
├── packages/
│   ├── database/              # Supabase 스키마, 마이그레이션
│   ├── ai/                    # LLM, RAG 관련 모듈
│   │   ├── rag/              # RAG 파이프라인
│   │   ├── llm/              # LLM 클라이언트 (GPT-4, Claude)
│   │   └── embedding/        # 임베딩 생성
│   ├── channels/              # 메신저 채널 어댑터
│   │   ├── line/
│   │   ├── whatsapp/
│   │   ├── facebook/
│   │   ├── instagram/
│   │   └── kakao/
│   ├── translation/           # DeepL 번역 서비스
│   └── shared/                # 공유 타입, 유틸리티
│
├── supabase/
│   ├── functions/             # Edge Functions
│   │   ├── webhook-line/
│   │   ├── webhook-meta/
│   │   ├── process-message/
│   │   ├── rag-query/
│   │   └── translate/
│   └── migrations/            # DB 마이그레이션
│
└── docs/                      # 문서
    ├── api/
    ├── architecture/
    └── guides/
```

---

## 14. 필요한 환경변수 및 설정값

### 14.1 Supabase 설정 (필수)
```bash
# Supabase 프로젝트 URL과 키
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 설정 방법:
# 1. https://supabase.com 에서 프로젝트 생성
# 2. Settings > API 에서 URL과 키 복사
# 3. Database > Extensions 에서 'vector' 확장 활성화
```

### 14.2 OpenAI API (필수 - AI/RAG용)
```bash
OPENAI_API_KEY=sk-your-openai-api-key

# 설정 방법:
# 1. https://platform.openai.com/api-keys 에서 API 키 생성
# 2. 사용 모델: gpt-4, text-embedding-3-small
# 3. 예상 비용: 월 $50-200 (사용량에 따라)
```

### 14.3 Anthropic API (선택 - Claude 사용 시)
```bash
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key

# 설정 방법:
# 1. https://console.anthropic.com 에서 API 키 생성
# 2. 사용 모델: claude-3-sonnet-20240229
# 3. 복잡한 의료 상담에 활용
```

### 14.4 DeepL API (필수 - 번역용)
```bash
DEEPL_API_KEY=your-deepl-api-key

# 설정 방법:
# 1. https://www.deepl.com/pro-api 에서 API 키 발급
# 2. Free 플랜: 월 500,000자 무료
# 3. Pro 플랜: 월 $5.49/100만자
```

### 14.5 Upstash Redis (캐싱/세션 - ✅ 설정 완료)
```bash
UPSTASH_REDIS_REST_URL=https://grown-eft-57579.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# 용도:
# - API 응답 캐싱
# - 세션 관리
# - Rate Limiting
```

### 14.6 Upstash Vector (RAG 벡터 검색 - ✅ 설정 완료)
```bash
UPSTASH_VECTOR_REST_URL=https://credible-dory-34434-us1-vector.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your-vector-token

# 용도:
# - RAG 벡터 검색 (고속)
# - 임베딩 저장 및 유사도 검색
# - pgvector 대비 성능 향상
```

### 14.7 Upstash QStash (선택 - 작업 큐)
```bash
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-current-key
QSTASH_NEXT_SIGNING_KEY=your-next-key

# 설정 방법:
# 1. https://upstash.com 에서 QStash 활성화
# 2. Details 탭에서 토큰과 서명 키 복사
# 3. 없어도 빌드/실행 가능 (동기 처리로 대체)
```

### 14.7 LINE Messaging API (채널 연동용)
```bash
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# 설정 방법:
# 1. https://developers.line.biz 에서 채널 생성
# 2. Messaging API 탭에서 토큰 발급
# 3. 웹훅 URL 설정: https://your-domain.com/api/webhooks/line
```

### 14.8 Meta Platform (Facebook, Instagram, WhatsApp) ✅ 설정 완료
```bash
# Facebook Messenger
FACEBOOK_APP_ID=779249264859459
FACEBOOK_APP_SECRET=45cef21e10d966a1e06a8af8c11509ad
FB_WEBHOOK_VERIFY_TOKEN=hi

# Instagram DM
INSTAGRAM_APP_ID=1777471926473316
INSTAGRAM_APP_SECRET=3316673a4fc563ae22f2fe2ee72dcf6d
IG_WEBHOOK_VERIFY_TOKEN=impakers-best

# WhatsApp Business
WHATSAPP_VERIFY_TOKEN=hello
NEXT_PUBLIC_WA_CONFIG_ID=1208932041106790

# Meta 통합 Webhook + OAuth
META_WEBHOOK_VERIFY_TOKEN=cs_automation_verify_token
META_OAUTH_REDIRECT_URI=https://csflow.vercel.app/api/oauth/meta

# 참고:
# - FB/IG/WhatsApp 모두 /api/webhooks/meta 단일 엔드포인트로 수신
# - 서명 검증에 FACEBOOK_APP_SECRET / INSTAGRAM_APP_SECRET 사용
# - Webhook 구독 검증에 각 플랫폼별 VERIFY_TOKEN 사용
# - Page Access Token은 OAuth 플로우를 통해 DB에 저장됨
```

### 14.9 앱 URL 설정
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 개발환경
# NEXT_PUBLIC_APP_URL=https://csflow.vercel.app  # 프로덕션

# QStash 웹훅 콜백 URL에 사용됨
```

---

## 15. 사용자 액션 필요 항목

### 15.1 제공 완료된 항목 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| **Supabase 프로젝트** | ✅ 완료 | URL/키 설정됨 |
| **OpenAI API 키** | ✅ 완료 | .env.local에 설정됨 |
| **DeepL API 키** | ✅ 완료 | .env.local에 설정됨 |
| **Anthropic API 키** | ✅ 완료 | Claude 사용 가능 |
| **Upstash Redis** | ✅ 완료 | 캐싱/세션 관리용 |
| **Upstash Vector** | ✅ 완료 | RAG 벡터 검색용 |
| **LINE 채널 정보** | ✅ 완료 | Channel ID/Secret/Access Token 설정됨 |
| **Facebook Messenger** | ✅ 완료 | App ID/Secret/Verify Token 설정됨 |
| **Instagram DM** | ✅ 완료 | App ID/Secret/Verify Token 설정됨 |
| **WhatsApp Business** | ✅ 완료 | Verify Token/Config ID 설정됨 |
| **Slack 알림** | ✅ 완료 | Bot Token 설정됨 |
| **Sentry 모니터링** | ✅ 완료 | DSN/Org/Project 설정됨 |

### 15.2 아직 필요한 항목

| 항목 | 상세 | 우선순위 |
|------|------|---------|
| **자체 CRM API 문서** | 연동할 CRM의 API 스펙 | P1 |
| **카카오 알림톡 정보** | 에스컬레이션 알림용 (현재 Slack 대체) | P2 |
| **Meta Page Access Token** | OAuth 플로우로 각 페이지 토큰 획득 필요 | P1 |
| **WeChat 채널 정보** | Official Account App ID/Secret | P3 |

### 15.3 데이터베이스 마이그레이션 (사용자 실행 필요)

Supabase SQL Editor에서 아래 SQL 파일들을 **순서대로** 실행해주세요.

**실행 순서 (중요!):**
1. `supabase/migrations/001_initial_schema.sql` - 기본 스키마 (테이블, 타입, RLS)
2. `supabase/migrations/002_message_templates.sql` - 메시지 템플릿 + OAuth 세션
3. `web/supabase/phase4-schema.sql` - Phase 4 엔터프라이즈 기능 (감사로그, SLA, SSO 등)

**접속 방법:**
1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택 (bfxtgqhollfkzawuzfwo)
3. 좌측 메뉴 > SQL Editor
4. New Query 클릭
5. 위 순서대로 각 파일 내용 복사 & 붙여넣기 후 Run 클릭

**참고:** `web/supabase/schema.sql`은 개발 참고용 파일로, 실제 마이그레이션은 `supabase/migrations/` 폴더의 파일을 사용합니다.

**포함된 내용:**
- pgvector, uuid-ossp 확장 활성화
- 전체 테이블 생성 (20개+ 테이블)
- 커스텀 타입 (ENUM)
- 벡터 검색 함수 (match_documents)
- 인덱스 생성
- RLS 정책 설정
- 트리거 설정 (updated_at 자동 업데이트 등)

### 15.3 LINE 연동 준비

| 단계 | 설명 |
|------|------|
| 1 | LINE Developers 계정 생성 |
| 2 | Provider 생성 |
| 3 | Messaging API 채널 생성 |
| 4 | Channel Access Token 발급 |
| 5 | Webhook URL 설정 |

### 15.4 카카오 알림톡 연동 준비 (에스컬레이션용)

| 단계 | 설명 |
|------|------|
| 1 | 카카오 비즈니스 계정 |
| 2 | 알림톡 발신 프로필 등록 |
| 3 | 템플릿 등록 및 승인 |
| 4 | API 키 발급 |

---

## 16. 개발 현황 요약 및 남은 작업

### 완료된 Phase (Phase 1-6)

| Phase | 상태 | 주요 완료 항목 |
|-------|------|--------------|
| **Phase 1**: 기반 구축 + LINE 연동 | ✅ 100% | Supabase 설정, LINE 어댑터, 통합 인박스 UI, DeepL 번역 |
| **Phase 2**: LLM RAG 자동응대 | ✅ 100% | RAG 파이프라인, GPT-4/Claude 라우터, 에스컬레이션, 지식베이스 |
| **Phase 3**: 자동화 및 고급 기능 | ✅ 100% | 카카오톡 연동, 자동화 규칙 엔진, Progressive Learning, 분석 대시보드 |
| **Phase 4**: 엔터프라이즈 기능 | ✅ 100% | SSO/SAML, 감사 로그, SLA 모니터링, 화이트라벨링, 외부 API |
| **Phase 5**: Meta Platform + 추가 채널 | ✅ 100% | Facebook, Instagram, WhatsApp, WeChat 어댑터, 고객 프로필 통합, 템플릿 관리 |
| **Phase 6**: AI 고도화 + 확장 | ✅ 100% | 음성처리(Whisper), 이미지분석(GPT-4V), 감정분석, 전환예측, 선제연락, 캘린더동기화, 챗봇위젯 |

### 통합된 채널 현황 (6개 채널)

| 채널 | 상태 | 어댑터 파일 |
|------|------|-----------|
| LINE | ✅ | `/src/services/channels/line.ts` |
| KakaoTalk | ✅ | `/src/services/channels/kakao.ts` |
| Facebook Messenger | ✅ | `/src/services/channels/facebook.ts` |
| Instagram DM | ✅ | `/src/services/channels/instagram.ts` |
| WhatsApp Business | ✅ | `/src/services/channels/whatsapp.ts` |
| WeChat | ✅ | `/src/services/channels/wechat.ts` |

### Phase 7 완료 현황 ✅

| 기능 | 상태 | 비고 |
|------|------|------|
| Fine-tuning 파이프라인 | ✅ 완료 | `/src/services/ai/fine-tuning.ts` |
| 환자 포털 | ✅ 완료 | `/portal` 별도 Next.js 앱 (port 3001) |
| 경쟁사 분석 | ✅ 완료 | `/src/services/competitor-analysis.ts` |
| 성능 최적화 | ✅ 완료 | 보안 헤더, 이미지 최적화, 캐시 전략 |
| E2E 테스트 | ✅ 완료 | Playwright 21개 테스트 전체 통과 |
| 단위 테스트 | ✅ 완료 | Vitest 98개 테스트 전체 통과 |
| Sentry 모니터링 | ✅ 설정 완료 | DSN 등록은 Sentry 프로젝트 생성 후 |
| **인박스 UI 고도화** | ✅ 완료 | 리사이즈 패널, 멀티 거래처 필터, 태그 개편, 스크롤 수정, CS 편의 기능 (2026-01-28) |
| **전체 프론트엔드 DB 연동** | ✅ 완료 | 9개 페이지 Mock→DB 전환, 42 API Routes, 빌드 검증 통과 (2026-01-28) |
| **E2E 브라우저 검증 + 버그 수정** | ✅ 완료 | 전체 9개 페이지 Playwright 실시간 검증, API 버그 수정, mock 데이터 완전 제거 (2026-01-28) |

### E2E 브라우저 검증 결과 (2026-01-28) ✅

배포 환경(https://csflow.vercel.app)에서 Playwright 브라우저 도구로 전체 9개 페이지를 실시간 검증하고 발견된 버그를 수정했습니다.

#### 수정된 버그

| 커밋 | 파일 | 문제 | 수정 내용 |
|------|------|------|----------|
| `118893e` | `api/escalations/route.ts` | FK join 실패로 채널 정보 누락 | `conversations → customers → customer_channels → channel_accounts` 경로로 수정 |
| `8d3b176` | `api/analytics/route.ts` | 동일 FK join 실패 | 동일 패턴 수정 |
| `19b0e2e` | `api/analytics/route.ts` | `.in()` sub-select 500 에러 | PostgREST 제한으로 인해 conversation ID를 명시적 배열로 fetch 후 전달 |
| `f656c00` | `dashboard/page.tsx`, `api/dashboard/stats/route.ts` | 하드코딩 mock 값 6개 | 활성 채널 수, 담당자 수, 고객 만족도, AI 인사이트 등 동적 데이터로 교체 |
| `2ee3991` | `knowledge/page.tsx`, `settings/channels/page.tsx` | `demo-tenant` 하드코딩 | 실제 tenant ID를 `/api/tenants`에서 동적 조회, mock 문서 8건 삭제 |
| `964f8de` | `analytics/page.tsx`, `channels/page.tsx`, `dashboard/page.tsx` | 하드코딩 인사이트 + hydration 에러 | 분석 인사이트 3건 동적 생성, channels fallback 제거, Date 초기화를 useEffect로 이동 |
| `90f1ab9` | `conversations.ts`, `inbox/page.tsx`, `api/channels/route.ts` | 인박스 대화 중복 + LINE 프로필사진 미표시 + 채널 대화 0건 | `getOrCreateConversation`에서 비종료 전체 상태 포함, `AvatarImage` + `profile_image_url` 적용, `statusMap`에 `open` 추가, 채널 API `messageCount` 실제 집계 |

#### 페이지별 검증 결과

| 페이지 | 상태 | DB 데이터 | 비고 |
|--------|------|----------|------|
| `/inbox` | ✅ 정상 | 실시간 대화, LINE 프로필사진 | 고객별 대화 중복 방지, AvatarImage 적용, open 상태 매핑 |
| `/dashboard` | ✅ 정상 | 동적 통계, 실시간 시간 | 인사이트, 채널별 문의, 거래처 정확도 |
| `/channels` | ✅ 정상 | 채널별 실제 대화 건수 표시 | 채널 추가/삭제/토글, messageCount 실제 집계 |
| `/tenants` | ✅ 정상 | 거래처 목록 + 통계 | AI 설정, 검색, CRUD |
| `/knowledge` | ✅ 정상 | 빈 상태 (mock 제거) | 문서 추가/편집/임베딩 |
| `/team` | ✅ 정상 | 팀원 0명 (빈 상태) | 역할 권한 테이블 표시 |
| `/escalations` | ✅ 정상 | 5건 에스컬레이션 | SLA 마감, 채널, 담당자 배정 |
| `/analytics` | ✅ 정상 | 기간별 통계 (0건 상태) | 동적 인사이트, 채널분포, 트렌드 |
| `/settings` | ✅ 정상 | 5탭 설정 | 일반/AI/번역/알림/채널 |

#### PostgREST 주의사항 (발견된 제약)

1. **FK join 경로**: `conversations` 테이블에는 `channel_account_id` FK가 없음. 채널 정보를 가져오려면 `conversations → customers → customer_channels → channel_accounts` 경로로 nested join 필요
2. **`.in()` sub-select 불가**: PostgREST 클라이언트에서 `.in("col", supabase.from(...).select(...))` 패턴은 작동하지 않음. 반드시 ID 배열을 먼저 fetch한 뒤 `.in("col", idArray)` 형태로 전달해야 함
3. **대화 중복 방지**: `getOrCreateConversation()`은 `.neq("status", "resolved")`로 비종료 대화를 모두 포함해야 함. `active`/`waiting`만 체크하면 `escalated`/`open` 상태 대화가 있을 때 중복 생성됨
4. **DB status 매핑**: 프론트엔드 `statusMap`에 DB의 모든 가능한 status 값을 포함해야 함. LINE webhook은 `"active"` 상태를 설정하고, 초기값은 `"open"` — 둘 다 매핑 필요

### 프론트엔드 DB 연동 현황 (전체 완료) ✅

| 페이지 | API Route | 주요 기능 |
|--------|-----------|----------|
| 대시보드 (`/dashboard`) | `GET /api/dashboard/stats` | 실시간 통계 (대화, 메시지, AI, 에스컬레이션, 고객) |
| 통합 인박스 (`/inbox`) | `GET/POST /api/conversations`, `GET /api/conversations/[id]/messages` | Supabase Realtime 실시간 대화, 메시지 전송 |
| 채널 관리 (`/channels`) | `GET/POST/DELETE /api/channels`, `GET /api/channels/available` | 채널 CRUD, OAuth 연동, 거래처별 필터 |
| 거래처 관리 (`/tenants`) | `GET/POST/PATCH/DELETE /api/tenants` | 거래처 CRUD, AI 설정, 통계 |
| 지식베이스 (`/knowledge`) | `GET/POST/PATCH/DELETE /api/knowledge/documents` | 문서 CRUD, 임베딩 생성 |
| 담당자 관리 (`/team`) | `GET/POST/PATCH/DELETE /api/team` | 팀원 CRUD, 역할/상태 관리, 초대 |
| 에스컬레이션 (`/escalations`) | `GET/PATCH /api/escalations` | 목록 조회, 담당자 배정, 상태 변경, 30초 자동 새로고침 |
| 분석/리포트 (`/analytics`) | `GET /api/analytics?period=` | KPI, 채널분포, 일별트렌드, 거래처성과, 언어분포, 에스컬레이션사유, 응답시간 |
| 설정 (`/settings`) | `GET/PATCH /api/settings` | 5탭 설정 (일반/AI/번역/알림/채널) 로드 및 저장 |

### 향후 개선 작업 (선택)

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| 통합 테스트 추가 | 서비스 간 연동 테스트 | 중 |
| 부하 테스트 (k6) | API 성능 벤치마크 | 낮음 |
| 학습 데이터 검수 UI | Fine-tuning 데이터 관리 UI | 낮음 |
| 웹 스크래핑 자동화 | 경쟁사 가격 자동 수집 | 낮음 |

### 완료된 핵심 서비스 및 API

| 서비스 | 파일 위치 | 기능 |
|--------|----------|------|
| AI Service | `/src/services/ai/` | RAG 파이프라인, LLM 라우팅 |
| Voice Processing | `/src/services/ai/voice-processing.ts` | Whisper 음성 인식 |
| Image Analysis | `/src/services/ai/image-analysis.ts` | GPT-4 Vision 이미지 분석 |
| Sentiment Analysis | `/src/services/ai/sentiment-analysis.ts` | 고객 감정 분석 |
| Conversion Prediction | `/src/services/ai/conversion-prediction.ts` | 전환 확률 예측 |
| Proactive Outreach | `/src/services/ai/proactive-outreach.ts` | AI 선제 연락 |
| Conversation Service | `/src/services/conversations.ts` | 대화 관리, 상태 처리 |
| Message Service | `/src/services/messages.ts` | 메시지 CRUD, 채널 발송 |
| Customer Service | `/src/services/customers.ts` | 고객 관리, 프로필, 타임라인 |
| Escalation Service | `/src/services/escalations.ts` | 에스컬레이션 관리 |
| Knowledge Service | `/src/services/ai/knowledge-base.ts` | 지식베이스, 임베딩 |
| Template Service | `/src/services/templates.ts` | 메시지 템플릿 관리 |
| Automation Service | `/src/services/automation/` | 자동화 규칙 엔진 |
| Translation Service | `/src/services/translation.ts` | DeepL 번역 |
| Calendar Sync | `/src/services/calendar-sync.ts` | Google/Naver 캘린더 동기화 |
| Widget Service | `/src/services/widget.ts` | 챗봇 위젯 백엔드 |
| Channel Adapters | `/src/services/channels/` | 6개 채널 어댑터 |

### 핵심 API 엔드포인트

```
채널 Webhooks:
- POST /api/webhooks/line
- POST /api/webhooks/kakao
- POST /api/webhooks/meta (Facebook, Instagram, WhatsApp 통합)
- GET/POST /api/webhooks/wechat

대화/메시지:
- GET/POST /api/conversations
- GET/PATCH /api/conversations/[id]
- GET /api/conversations/[id]/messages
- GET/POST /api/messages

대시보드/분석:
- GET /api/dashboard/stats
- GET /api/analytics?period=1d|7d|30d|90d
- GET /api/settings
- PATCH /api/settings

거래처:
- GET/POST/PATCH/DELETE /api/tenants

고객:
- GET/POST /api/customers
- GET /api/customers/[id]/profile
- GET /api/customers/[id]/timeline
- POST /api/customers/[id]/sync
- GET /api/customers/[id]/duplicates
- POST /api/customers/[id]/merge

지식베이스:
- GET/POST /api/knowledge/documents
- PATCH/DELETE /api/knowledge/documents/[id]
- POST /api/knowledge/documents/[id]/embed

템플릿:
- GET/POST /api/templates
- GET/PATCH/DELETE /api/templates/[id]
- POST /api/templates/[id]/duplicate

에스컬레이션:
- GET/POST /api/escalations
- PATCH /api/escalations/[id]

위젯 (Phase 6 신규):
- POST /api/widget/session
- POST /api/widget/message
- GET /api/widget/config
```

---

## 17. Channel.io 참고 사항 (UI/UX)

### 구현 시 참고할 패턴

1. **상담 상태 관리**: 진행중/보류중/부재중/종료됨
2. **상담 태그 시스템**: 가망/잠재/1차예약/확정예약 등 커스텀 태그
3. **담당자 할당**: 자동/수동 할당 + 팔로워 기능
4. **내부 메모**: 고객에게 보이지 않는 팀 내부 대화
5. **번역 토글**: 원문/번역 간편 전환
6. **대기 시간 표시**: SLA 관리용
7. **AI 응답 라벨**: BOT/AI 응답 명확히 구분
8. **고객 연락처**: 테이블 뷰 + 고급 필터 + 세그먼트

### UI 개선 아이디어

1. **Channel.io 대비 차별화**:
   - 더 강력한 AI 자동응대 (신뢰도 시각화)
   - 거래처별 맞춤 RAG
   - 의료 도메인 특화 기능

2. **유지할 좋은 패턴**:
   - 3단 레이아웃 (목록-대화-정보)
   - 상담 태그 시스템
   - 채널/담당자별 필터
