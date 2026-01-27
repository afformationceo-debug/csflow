# CS Automation Platform - Development Guide

## Project Overview

해외환자유치 CS 자동화 플랫폼 - 50개 이상의 메신저 계정을 통합 관리하고 LLM RAG 기반 자동 응대를 제공합니다.

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + pgvector)
- **State Management**: React Query (TanStack Query)
- **Queue**: Upstash QStash
- **Translation**: DeepL + Papago
- **LLM**: OpenAI GPT-4 + Claude
- **Monitoring**: Sentry (에러 트래킹, 성능)
- **Testing**: Vitest (98 tests)
- **CI/CD**: GitHub Actions

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Dashboard layout group
│   │   ├── inbox/          # Unified inbox
│   │   ├── dashboard/      # Main dashboard
│   │   ├── escalations/    # Escalation management
│   │   ├── analytics/      # Analytics
│   │   └── knowledge/      # Knowledge base
│   └── api/                # API routes
│       ├── webhooks/       # Channel webhooks (LINE, etc.)
│       └── jobs/           # Background job handlers
├── components/             # React components
│   └── ui/                 # shadcn/ui components
├── hooks/                  # React Query hooks
│   ├── use-conversations.ts
│   ├── use-messages.ts
│   ├── use-customers.ts
│   └── index.ts
├── services/               # Business logic services
│   ├── channels/           # Channel adapters
│   │   ├── types.ts        # Unified message types
│   │   ├── line.ts         # LINE adapter
│   │   └── index.ts        # Channel registry
│   ├── ai/                 # AI/RAG services
│   ├── conversations.ts
│   ├── messages.ts
│   ├── customers.ts
│   ├── internal-notes.ts
│   ├── escalations.ts
│   └── translation.ts
├── lib/                    # Utilities
│   ├── supabase/           # Supabase clients
│   └── upstash/            # QStash integration
└── types/                  # TypeScript types
```

## Development Progress

### Phase 1: Foundation + LINE Integration - COMPLETED

#### Database Schema (2024-01-27)
- [x] PostgreSQL schema with pgvector
- [x] Multi-tenant architecture (tenants, users)
- [x] Customer management (customers, customer_channels)
- [x] Conversation and message tables
- [x] Internal notes table
- [x] Knowledge base with vector search (pgvector)
- [x] Escalation tracking

#### React Query Hooks (2024-01-27)
- [x] `useConversations` - Conversation list with filters
- [x] `useConversationsRealtime` - Real-time updates
- [x] `useUpdateConversation` - Status/assignment updates
- [x] `useMarkAsRead` - Mark conversations as read
- [x] `useMessages` - Message list with pagination
- [x] `useMessagesRealtime` - Real-time message updates
- [x] `useSendMessage` - Send messages
- [x] `useUnifiedMessages` - Combined messages + internal notes
- [x] `useInternalNotes` - Internal notes management
- [x] `useCreateInternalNote` - Create internal notes
- [x] `useCustomer` - Customer detail
- [x] `useUpdateCustomer` - Customer updates
- [x] `useUpdateConsultationTag` - Consultation tag management
- [x] `useAddTag` / `useRemoveTag` - Tag management
- [x] `calculateWaitTime` - SLA time calculation
- [x] `useWaitTimeUpdater` - Real-time wait time updates

#### LINE Integration (2024-01-27)
- [x] LINE Messaging API adapter
- [x] Webhook handler with signature verification
- [x] Message parsing to unified format
- [x] Push message sending
- [x] User profile retrieval
- [x] Media content retrieval
- [x] Template/carousel messages
- [x] Quick replies
- [x] DB-based credential retrieval

#### Message Normalization Layer (2024-01-27)
- [x] `UnifiedInboundMessage` type
- [x] `UnifiedOutboundMessage` type
- [x] Channel adapter interface
- [x] Channel registry for multi-channel support
- [x] Sticker, location, media handling

#### Unified Inbox UI (2024-01-27)
- [x] 3-column layout (conversation list, chat, profile)
- [x] Channel filtering (LINE, WhatsApp, Kakao, Instagram)
- [x] Status filtering (urgent, pending, AI processing, resolved)
- [x] Consultation tag system (Channel.io style)
  - 가망, 잠재, 1차예약, 확정예약, 시술완료, 취소
- [x] Internal notes feature
  - Yellow note styling
  - @mention support
  - Separate view mode (all/customer/internal)
- [x] Message view tabs
- [x] Auto-translation toggle
- [x] SLA wait time display with color-coded urgency
  - Green: < 1 hour
  - Yellow: 1-8 hours
  - Orange: 8-24 hours
  - Red: > 24 hours (urgent)

### Phase 2: LLM RAG Auto-response - COMPLETED

#### RAG Pipeline (2024-01-27)
- [x] `ragPipeline.process()` - Full RAG pipeline with confidence scoring
- [x] `ragPipeline.getSuggestion()` - Agent AI suggestion
- [x] `ragPipeline.provideFeedback()` - Learning feedback
- [x] Automatic escalation keyword detection
- [x] Confidence threshold checking
- [x] Sensitive topic detection
- [x] AI response logging for analytics

#### Knowledge Base Service (2024-01-27)
- [x] `knowledgeBaseService.createDocument()` - Create with auto-embedding
- [x] `knowledgeBaseService.updateDocument()` - Update with re-embedding
- [x] `knowledgeBaseService.deleteDocument()` - Delete with cascade
- [x] `knowledgeBaseService.getDocuments()` - List with filters
- [x] `knowledgeBaseService.getCategories()` - Category list
- [x] `knowledgeBaseService.getStatistics()` - KB statistics
- [x] `knowledgeBaseService.importFromEscalation()` - Learning from escalations
- [x] `knowledgeBaseService.bulkImport()` - Batch document import
- [x] Tenant-specific namespace isolation

#### Vector Search & Retrieval (2024-01-27)
- [x] `generateEmbedding()` - OpenAI text-embedding-3-small
- [x] `generateEmbeddings()` - Batch embedding
- [x] `chunkText()` - Smart text chunking with overlap
- [x] `retrieveDocuments()` - Vector similarity search
- [x] `fullTextSearch()` - PostgreSQL FTS
- [x] `hybridSearch()` - RRF (Reciprocal Rank Fusion)

#### LLM Service (2024-01-27)
- [x] GPT-4 / GPT-4-turbo integration
- [x] Claude 3 Opus / Sonnet integration
- [x] `llmService.selectModel()` - Automatic model routing
- [x] `llmService.generate()` - RAG response generation
- [x] `llmService.generateSuggestion()` - Agent assistance
- [x] Tenant-specific system prompts
- [x] Confidence calculation algorithm

#### Knowledge Base React Query Hooks (2024-01-27)
- [x] `useKnowledgeDocuments()` - Document list with filters
- [x] `useKnowledgeDocument()` - Single document
- [x] `useKnowledgeCategories()` - Category list
- [x] `useKnowledgeStatistics()` - Statistics
- [x] `useCreateKnowledgeDocument()` - Create mutation
- [x] `useUpdateKnowledgeDocument()` - Update mutation
- [x] `useDeleteKnowledgeDocument()` - Delete mutation
- [x] `useRegenerateEmbeddings()` - Re-embed mutation

#### CRM API Integration (2024-01-27)
- [x] `crmService.getCustomer()` - Fetch customer
- [x] `crmService.searchCustomers()` - Search customers
- [x] `crmService.createCustomer()` - Create customer
- [x] `crmService.updateCustomer()` - Update customer
- [x] `crmService.syncCustomer()` - Sync to CRM
- [x] `crmService.getCustomerBookings()` - List bookings
- [x] `crmService.createBooking()` - Create booking
- [x] `crmService.updateBooking()` - Update booking
- [x] `crmService.cancelBooking()` - Cancel booking
- [x] `crmService.createBookingFromConversation()` - AI booking
- [x] `crmService.getCustomerNotes()` - List notes
- [x] `crmService.addNote()` - Add note
- [x] `crmService.checkHealth()` - API health check

#### CRM React Query Hooks (2024-01-27)
- [x] `useCRMCustomer()` - Fetch customer
- [x] `useSearchCRMCustomers()` - Search mutation
- [x] `useCreateCRMCustomer()` - Create mutation
- [x] `useUpdateCRMCustomer()` - Update mutation
- [x] `useSyncCustomerToCRM()` - Sync mutation
- [x] `useCRMBookings()` - List bookings
- [x] `useCRMBooking()` - Single booking
- [x] `useCreateCRMBooking()` - Create mutation
- [x] `useUpdateCRMBooking()` - Update mutation
- [x] `useCancelCRMBooking()` - Cancel mutation
- [x] `useCreateBookingFromConversation()` - AI booking mutation
- [x] `useCRMNotes()` - List notes
- [x] `useAddCRMNote()` - Add note mutation
- [x] `useCRMHealth()` - Health check

#### Knowledge Base API Routes (2024-01-27)
- [x] `GET /api/knowledge/documents` - List documents
- [x] `POST /api/knowledge/documents` - Create document
- [x] `GET /api/knowledge/documents/[id]` - Get document
- [x] `PATCH /api/knowledge/documents/[id]` - Update document
- [x] `DELETE /api/knowledge/documents/[id]` - Delete document
- [x] `POST /api/knowledge/documents/[id]/embeddings` - Regenerate embeddings

#### Knowledge Base Management UI (2026-01-27)
- [x] Full CRUD UI with React Query integration
- [x] Document create/edit/delete dialogs
- [x] Category filtering and search
- [x] Statistics dashboard (documents, chunks, categories)
- [x] Active/inactive toggle
- [x] Embedding regeneration
- [x] Source type badges (manual, escalation, import)
- [x] Loading/error states with skeleton UI

### Phase 3: Automation & CRM - COMPLETED

#### KakaoTalk Channel Integration (2026-01-27)
- [x] Kakao i Open Builder adapter (`/src/services/channels/kakao.ts`)
- [x] Webhook handler (`/api/webhooks/kakao`)
- [x] Message parsing to unified format
- [x] Skill response generation
- [x] Quick replies support
- [x] Callback async messaging
- [x] Channel API (Alimtalk/Friendtalk) support
- [x] Signature validation
- [x] DB-based credential retrieval

#### Automation Rule Engine (2026-01-27)
- [x] `ruleEngine.processTrigger()` - Process automation triggers
- [x] Trigger types: message_received, conversation_created, booking_confirmed, etc.
- [x] Condition evaluation (AND/OR logic, operators)
- [x] Action execution: send_message, send_notification, update_status, add_tag, etc.
- [x] Template interpolation with variables
- [x] Execution limits and cooldowns
- [x] Execution logging
- [x] Branch actions (conditional)
- [x] Types: `/src/services/automation/types.ts`
- [x] Engine: `/src/services/automation/rule-engine.ts`

#### Escalation → Learning Pipeline (2026-01-27)
- [x] `learningPipeline.processEscalation()` - Process resolved escalations
- [x] `learningPipeline.getConversationContext()` - Extract context
- [x] `learningPipeline.extractKnowledge()` - LLM-based knowledge extraction
- [x] Paraphrase generation for better retrieval
- [x] Automatic category and tag assignment
- [x] Batch processing of unlearned escalations
- [x] Learning statistics
- [x] Service: `/src/services/learning-pipeline.ts`

#### Satisfaction Survey Automation (2026-01-27)
- [x] `satisfactionSurveyService.sendSurvey()` - Send survey to customer
- [x] `satisfactionSurveyService.processResponse()` - Process survey response
- [x] Multi-language survey templates (KO, EN, JA, ZH, VI, TH)
- [x] Quick reply rating buttons
- [x] Automatic thank you messages
- [x] Survey statistics
- [x] Schedule for resolved conversations
- [x] Service: `/src/services/satisfaction-survey.ts`

#### Enhanced Analytics Dashboard (2026-01-27)
- [x] `analyticsService.getOverviewMetrics()` - Key metrics
- [x] `analyticsService.getChannelMetrics()` - Per-channel stats
- [x] `analyticsService.getAIMetrics()` - AI performance metrics
- [x] `analyticsService.getConversationTrends()` - Trends by day/week/hour
- [x] `analyticsService.getRealTimeMetrics()` - Live dashboard data
- [x] Model usage tracking
- [x] Escalation reason analysis
- [x] Service: `/src/services/analytics.ts`

#### CRM Deep Integration (2026-01-27)
- [x] `crmSyncService.syncCustomerToCRM()` - Customer sync
- [x] `crmSyncService.syncBookingToCRM()` - Booking sync
- [x] `crmSyncService.syncNotesToCRM()` - Notes sync
- [x] `crmSyncService.pullCustomerFromCRM()` - Pull from CRM
- [x] `crmSyncService.onConversationResolved()` - Auto-sync on resolution
- [x] `crmSyncService.handleCRMWebhook()` - Bidirectional sync
- [x] Full sync execution for tenants
- [x] Sync status tracking
- [x] Service: `/src/services/crm-sync.ts`

## Trusflow Integration (기존 솔루션 통합)

### Repository 정보
- **GitHub URL**: https://github.com/MyungSean/trusflow.git
- **분석 완료일**: 2026-01-27

### 기존 솔루션 구조 분석

#### 메신저 채널 연동 현황
| 채널 | 상태 | 주요 파일 |
|------|------|----------|
| Facebook Messenger | ✅ 구현됨 | `/app/api/webhook/fb-message/route.ts` |
| Instagram DM | ✅ 구현됨 | `/app/api/webhook/ig-message/route.ts` |
| WeChat | ✅ 구현됨 | `/app/api/webhook/wechat-message/route.ts` |
| LINE | ✅ 구현됨 | LINE 연동 코드 존재 |

#### 데이터베이스 스키마
```
chat_rooms (대화방)
├── id
├── patient_id (고객 연결)
├── channel_type
├── channel_account_id
├── last_message_at
└── metadata

chat_messages (메시지)
├── id
├── room_id
├── sender_type (patient/staff/system)
├── content_type (text/image/video/etc)
├── content
├── translated_content
├── original_language
└── created_at

patients (고객)
├── id
├── name
├── email
├── phone
├── country_code
└── metadata

patient_channels (고객-채널 연결)
├── id
├── patient_id
├── channel_type
├── channel_user_id
├── channel_account_id
└── is_primary

integrated_channels (연동된 채널 계정)
├── id
├── channel_type
├── name
├── credentials (암호화)
├── webhook_url
└── is_active
```

### 가져올 항목 (Import from Trusflow)

#### 1. Facebook Messenger 연동 (`/app/api/webhook/fb-message/route.ts`)
```typescript
// 핵심 기능
- Webhook verification (GET handler)
- Message event processing (POST handler)
- PSID → 내부 고객 ID 매핑
- 텍스트/이미지/파일 메시지 파싱
- Quick Reply 처리
- 메시지 발송 (Send API)
- 페이지 액세스 토큰 관리
```

**통합 방법**:
```
/src/services/channels/facebook.ts  ← 신규 생성
/app/api/webhooks/facebook/route.ts ← 신규 생성
```

#### 2. Instagram DM 연동 (`/app/api/webhook/ig-message/route.ts`)
```typescript
// 핵심 기능
- Webhook verification
- Message event processing
- IGSID → 내부 고객 ID 매핑
- 스토리 멘션/리플라이 처리
- Quick Reply payload 처리
- 미디어 메시지 (이미지, 비디오)
- 메시지 발송
```

**통합 방법**:
```
/src/services/channels/instagram.ts  ← 신규 생성
/app/api/webhooks/instagram/route.ts ← 신규 생성
```

#### 3. WhatsApp Business API 연동
```typescript
// 핵심 기능 (Trusflow 패턴 참고)
- Cloud API 또는 On-Premise API 지원
- 전화번호 기반 고객 식별
- 템플릿 메시지 (Alimtalk 유사)
- 세션 메시지 (24시간 윈도우)
- 미디어 메시지
- Interactive 메시지 (버튼, 리스트)
```

**통합 방법**:
```
/src/services/channels/whatsapp.ts  ← 신규 생성
/app/api/webhooks/whatsapp/route.ts ← 신규 생성
```

#### 4. 고객 채널 매핑 유틸 (`/lib/utils/patient-from-channel.ts`)
```typescript
// 핵심 기능
- 채널 사용자 ID → 내부 고객 ID 조회
- 신규 고객 자동 생성
- 복수 채널 → 단일 고객 프로필 통합
- 채널별 프로필 정보 가져오기
```

**통합 방법**: 기존 `/src/services/customers.ts` 확장

#### 5. 자동화 메시지 스케줄러 (`/lib/services/automated-message-scheduler.ts`)
```typescript
// 핵심 기능
- 예약 리마인더 자동 발송
- 후속 메시지 스케줄링
- 채널별 발송 시간 최적화
- 발송 실패 재시도 로직
```

**통합 방법**: 기존 `/src/services/automation/rule-engine.ts` 확장

### 추가 구현 항목 (Additional Features)

#### 1. Meta Platform 통합 연동 (우선순위: 높음) - COMPLETED ✅
- [x] Facebook Messenger 채널 어댑터 (`/src/services/channels/facebook.ts`)
- [x] Instagram DM 채널 어댑터 (`/src/services/channels/instagram.ts`)
- [x] WhatsApp Business 채널 어댑터 (`/src/services/channels/whatsapp.ts`)
- [x] Meta Webhook 통합 핸들러 (`/app/api/webhooks/meta/route.ts`)
- [x] 페이지/계정 OAuth 연동 플로우 (`/src/services/meta-oauth.ts`, `/app/api/oauth/meta/route.ts`)
- [x] 채널 연결 관리 UI (`/app/(dashboard)/settings/channels/`)

#### 2. WeChat 연동 (우선순위: 중간) - COMPLETED ✅
- [x] WeChat Official Account 어댑터 (`/src/services/channels/wechat.ts`)
- [x] XML 기반 메시지 파싱
- [x] WeChat Webhook 핸들러 (`/app/api/webhooks/wechat/route.ts`)
- [x] 템플릿 메시지 지원 (48시간 윈도우 외)
- [x] 사용자 프로필 조회

#### 3. 채널 관리 UI (우선순위: 높음) - COMPLETED ✅
- [x] 채널 계정 등록/삭제 화면 (`/app/(dashboard)/settings/channels/page.tsx`)
- [x] OAuth 연동 플로우 UI (`/app/(dashboard)/settings/channels/connect/page.tsx`)
- [x] 채널별 설정 (자동응답 ON/OFF)
- [x] 채널 상태 모니터링

#### 4. 고객 프로필 통합 강화 (우선순위: 중간) - COMPLETED ✅
- [x] 복수 채널 대화 타임라인 통합 뷰 (`/api/customers/[id]/timeline`)
- [x] 종합 고객 프로필 API (`/api/customers/[id]/profile`)
- [x] 고객 채널 병합 기능 (`/api/customers/[id]/merge`)
- [x] 중복 고객 감지 API (`/api/customers/[id]/duplicates`)
- [x] CRM 동기화 API (`/api/customers/[id]/sync`)
- [x] 고객 통계 (총 메시지, 대화, 예약, 선호 채널 등)

#### 5. 메시지 템플릿 관리 (우선순위: 중간) - COMPLETED ✅
- [x] 템플릿 CRUD 서비스 (`/src/services/templates.ts`)
- [x] 채널별 템플릿 설정
- [x] 변수 자동 추출 ({{variableName}})
- [x] 다국어 템플릿 버전 관리
- [x] 템플릿 API (`/app/api/templates/`)
- [x] 템플릿 복제 기능
- [x] 사용량 추적
- [x] 기본 템플릿 자동 생성

### 통합 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CS Automation Platform                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Channel Adapters                          │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │   │
│  │  │  LINE   │ │Facebook │ │Instagram│ │WhatsApp │ │ Kakao  │ │   │
│  │  │ (기존)  │ │(Trusflow│ │(Trusflow│ │(Trusflow│ │ (기존) │ │   │
│  │  │         │ │  통합)  │ │  통합)  │ │  통합)  │ │        │ │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │   │
│  │       │           │           │           │          │       │   │
│  │       └───────────┴─────┬─────┴───────────┴──────────┘       │   │
│  │                         │                                     │   │
│  │                         ▼                                     │   │
│  │            ┌─────────────────────────┐                       │   │
│  │            │  Unified Message Format │                       │   │
│  │            │  (기존 타입 시스템 활용)  │                       │   │
│  │            └─────────────────────────┘                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Core Services                             │   │
│  │  - RAG Pipeline (기존)                                       │   │
│  │  - Translation Service (기존)                                │   │
│  │  - CRM Sync Service (기존)                                   │   │
│  │  - Automation Rule Engine (기존 + Trusflow 스케줄러 통합)     │   │
│  │  - Customer Channel Mapping (Trusflow 패턴 적용)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 통합 일정 (진행 현황)

| 단계 | 작업 | 상태 |
|------|------|------|
| 1 | Facebook Messenger 어댑터 + Webhook | ✅ 완료 |
| 2 | Instagram DM 어댑터 + Webhook | ✅ 완료 |
| 3 | WhatsApp Business 어댑터 + Webhook | ✅ 완료 |
| 4 | Meta Unified Webhook Handler | ✅ 완료 |
| 5 | Meta OAuth 연동 플로우 | ✅ 완료 |
| 6 | 채널 관리 UI | ✅ 완료 |
| 7 | 고객 채널 통합 강화 | ✅ 완료 |
| 8 | WeChat 연동 | ✅ 완료 |
| 9 | 메시지 템플릿 관리 | ✅ 완료 |
| 10 | 음성 메시지 처리 (Whisper) | ✅ 완료 |
| 11 | 이미지 분석 (GPT-4 Vision) | ✅ 완료 |
| 12 | 감정 분석 (Sentiment Analysis) | ✅ 완료 |
| 13 | 전환 예측 (Conversion Prediction) | ✅ 완료 |
| 14 | 선제 연락 (Proactive Outreach) | ✅ 완료 |
| 15 | 캘린더 동기화 (Google/Naver) | ✅ 완료 |
| 16 | 챗봇 위젯 | ✅ 완료 |
| 17 | 테스트 및 안정화 | ⏳ 진행 예정 |

### Trusflow 코드 재사용 가이드

#### Facebook 메시징 액션 (`/lib/actions/facebook-messaging-actions.ts`)
```typescript
// 재사용할 함수들
export async function sendFacebookMessage(
  pageId: string,
  recipientPsid: string,
  message: FacebookMessage,
  accessToken: string
): Promise<SendMessageResult>

export async function getFacebookUserProfile(
  psid: string,
  accessToken: string
): Promise<FacebookUserProfile>

export function parseFacebookWebhookEvent(
  body: FacebookWebhookBody
): ParsedFacebookEvent[]
```

#### Instagram 메시징 액션 (`/lib/actions/instagram-messaging-actions.ts`)
```typescript
// 재사용할 함수들
export async function sendInstagramMessage(
  igAccountId: string,
  recipientIgsid: string,
  message: InstagramMessage,
  accessToken: string
): Promise<SendMessageResult>

export function parseInstagramWebhookEvent(
  body: InstagramWebhookBody
): ParsedInstagramEvent[]
```

#### 고객 채널 유틸 (`/lib/utils/patient-from-channel.ts`)
```typescript
// 재사용할 패턴
async function findOrCreateCustomerFromChannel(
  channelType: ChannelType,
  channelUserId: string,
  channelAccountId: string,
  profileData?: Partial<CustomerProfile>
): Promise<Customer>

async function linkChannelToCustomer(
  customerId: string,
  channelType: ChannelType,
  channelUserId: string,
  channelAccountId: string
): Promise<CustomerChannel>
```

## Important Notes

### CRM Integration
- CRM API URL 및 인증 정보 설정 필요:
  - `CRM_API_BASE_URL`: CRM API 기본 URL
  - `CRM_API_KEY`: API 인증 키

## Key Types

### Consultation Tags
```typescript
type ConsultationTag =
  | "prospect"      // 가망
  | "potential"     // 잠재
  | "first_booking" // 1차예약
  | "confirmed"     // 확정예약
  | "completed"     // 시술완료
  | "cancelled";    // 취소
```

### Message Types
```typescript
type MessageType = "customer" | "ai" | "agent" | "internal_note";
type MessageContentType = "text" | "image" | "video" | "audio" | "file" | "location" | "sticker";
```

### Channel Types
```typescript
type ChannelType = "line" | "whatsapp" | "facebook" | "instagram" | "kakao";
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# Meta Platform (Facebook, Instagram, WhatsApp)
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_PAGE_ACCESS_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
WHATSAPP_ACCESS_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=cs_automation_verify_token

# KakaoTalk
KAKAO_REST_API_KEY=
KAKAO_ADMIN_KEY=
KAKAO_SENDER_KEY=

# Translation
DEEPL_API_KEY=
PAPAGO_CLIENT_ID=
PAPAGO_CLIENT_SECRET=

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Queue
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# CRM
CRM_API_BASE_URL=
CRM_API_KEY=

# WeChat
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_VERIFY_TOKEN=
WECHAT_ENCODING_AES_KEY=
```

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Database Migration

SQL schema is located at `supabase/schema.sql`. Execute in Supabase SQL Editor.

Note: Korean full-text search uses 'simple' configuration instead of 'korean' (not supported by Supabase).

## API Endpoints

### Webhooks
- `POST /api/webhooks/line` - LINE message webhook
- `POST /api/webhooks/kakao` - KakaoTalk message webhook (Kakao i Open Builder)
- `GET/POST /api/webhooks/meta` - Meta unified webhook (Facebook, Instagram, WhatsApp)
- `GET/POST /api/webhooks/wechat` - WeChat Official Account webhook

### Channels
- `GET /api/channels` - List connected channels
- `POST /api/channels` - Connect new channel
- `PATCH /api/channels` - Update channel settings
- `DELETE /api/channels` - Disconnect channel
- `GET /api/channels/available` - Get available channels from OAuth session

### OAuth
- `GET /api/oauth/meta` - Meta OAuth callback handler
- `POST /api/oauth/meta` - Start Meta OAuth flow

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/[id]` - Get template
- `PATCH /api/templates/[id]` - Update template
- `DELETE /api/templates/[id]` - Delete template
- `POST /api/templates/[id]/duplicate` - Duplicate template

### Customers
- `GET /api/customers/[id]/profile` - Get comprehensive customer profile
- `GET /api/customers/[id]/timeline` - Get customer timeline events
- `POST /api/customers/[id]/sync` - Sync customer with CRM
- `GET /api/customers/[id]/duplicates` - Find potential duplicate customers
- `POST /api/customers/[id]/merge` - Merge two customers

### Background Jobs
- `POST /api/jobs/send-message` - Send message to channel
- `POST /api/jobs/escalation-notify` - Escalation notifications
- `POST /api/jobs/send-satisfaction-survey` - Send satisfaction survey
- `POST /api/jobs/crm-full-sync` - Full CRM sync
- `POST /api/jobs/process-learning` - Process escalation learning

## New Services (Phase 3)

### Automation Service
```typescript
import { ruleEngine } from "@/services/automation";

// Process a trigger
await ruleEngine.processTrigger("message_received", {
  tenantId: "...",
  conversationId: "...",
  customerId: "...",
  messageId: "...",
});
```

### Learning Pipeline
```typescript
import { learningPipeline } from "@/services/learning-pipeline";

// Process resolved escalation
await learningPipeline.processEscalation(escalationId);

// Batch process unlearned escalations
await learningPipeline.processUnlearnedEscalations(tenantId);
```

### Satisfaction Survey
```typescript
import { satisfactionSurveyService } from "@/services/satisfaction-survey";

// Send survey
await satisfactionSurveyService.sendSurvey({
  conversationId: "...",
  customerId: "...",
});

// Get statistics
const stats = await satisfactionSurveyService.getStatistics(tenantId);
```

### Analytics Service
```typescript
import { analyticsService } from "@/services/analytics";

// Get overview metrics
const metrics = await analyticsService.getOverviewMetrics(tenantId);

// Get real-time dashboard
const realtime = await analyticsService.getRealTimeMetrics(tenantId);
```

### CRM Sync Service
```typescript
import { crmSyncService } from "@/services/crm-sync";

// Sync customer
await crmSyncService.syncCustomerToCRM({
  csCustomerId: "...",
  name: "...",
  phone: "...",
});

// Auto-sync on conversation resolution
await crmSyncService.onConversationResolved(conversationId);
```

### Phase 4: Advanced Features - COMPLETED

#### Multi-Tenant Management (2026-01-27)
- [x] `tenantManagementService.getTenant()` - Get tenant configuration
- [x] `tenantManagementService.createTenant()` - Create new tenant
- [x] `tenantManagementService.updateTenantSettings()` - Update settings
- [x] `tenantManagementService.updateTenantAIConfig()` - Update AI config
- [x] `tenantManagementService.getTenantUsage()` - Usage statistics
- [x] `tenantManagementService.getTenantUsers()` - List users
- [x] `tenantManagementService.inviteUser()` - Invite user
- [x] `tenantManagementService.removeUser()` - Remove user
- [x] `tenantManagementService.validateTenantAccess()` - Access validation
- [x] Role-based permissions (owner, admin, manager, agent)
- [x] Service: `/src/services/tenant-management.ts`

#### SSO/SAML Authentication (2026-01-27)
- [x] `ssoAuthService.getConfig()` - Get SSO configuration
- [x] `ssoAuthService.upsertConfig()` - Create/update SSO config
- [x] `ssoAuthService.generateSAMLMetadata()` - Generate SP metadata
- [x] `ssoAuthService.generateSAMLAuthRequest()` - Generate auth request
- [x] `ssoAuthService.processSAMLAssertion()` - Process SAML response
- [x] `ssoAuthService.generateOIDCAuthUrl()` - OIDC authorization URL
- [x] `ssoAuthService.exchangeOIDCCode()` - Exchange OIDC code
- [x] Auto-provisioning of users
- [x] Domain restrictions
- [x] Group-to-role mapping
- [x] Service: `/src/services/sso-auth.ts`

#### Audit Logging (2026-01-27)
- [x] `auditLogService.log()` - Log audit event
- [x] `auditLogService.query()` - Query audit logs
- [x] `auditLogService.getSummary()` - Get audit summary
- [x] `auditLogService.export()` - Export logs (JSON/CSV)
- [x] `auditLogService.cleanup()` - Cleanup old logs
- [x] `auditLogService.logAuth()` - Helper for auth events
- [x] `auditLogService.logResourceChange()` - Helper for CRUD events
- [x] Severity levels (info, warning, error, critical)
- [x] Critical event notifications
- [x] Service: `/src/services/audit-log.ts`

#### SLA Monitoring (2026-01-27)
- [x] `slaMonitoringService.getSLAConfig()` - Get SLA configuration
- [x] `slaMonitoringService.upsertSLAConfig()` - Create/update SLA config
- [x] `slaMonitoringService.calculateMetrics()` - Calculate SLA metrics
- [x] `slaMonitoringService.checkConversationSLA()` - Check conversation SLA
- [x] `slaMonitoringService.recordBreach()` - Record SLA breach
- [x] `slaMonitoringService.getBreaches()` - Get SLA breaches
- [x] `slaMonitoringService.runSLACheck()` - Run SLA check job
- [x] Configurable targets (response time, resolution, AI rate, CSAT)
- [x] Business hours support
- [x] Multi-level escalation policy
- [x] Service: `/src/services/sla-monitoring.ts`

#### Whitelabel/Branding (2026-01-27)
- [x] `whitelabelService.getConfig()` - Get whitelabel config
- [x] `whitelabelService.updateConfig()` - Update whitelabel config
- [x] `whitelabelService.verifyDomain()` - Verify custom domain
- [x] `whitelabelService.generateCSSVariables()` - Generate theme CSS
- [x] `whitelabelService.getWidgetEmbed()` - Get widget embed code
- [x] `whitelabelService.generateWidgetLoader()` - Generate widget script
- [x] `whitelabelService.getEmailTemplate()` - Get branded email template
- [x] Custom branding (logo, colors, fonts)
- [x] Custom domain support with SSL
- [x] Embeddable chat widget
- [x] Custom email templates
- [x] Service: `/src/services/whitelabel.ts`

#### External API (2026-01-27)
- [x] `externalApiService.createAPIKey()` - Create API key
- [x] `externalApiService.validateAPIKey()` - Validate API key
- [x] `externalApiService.checkRateLimit()` - Check rate limits
- [x] `externalApiService.logRequest()` - Log API request
- [x] `externalApiService.revokeAPIKey()` - Revoke API key
- [x] `externalApiService.listAPIKeys()` - List API keys
- [x] `externalApiService.createWebhook()` - Create webhook
- [x] `externalApiService.triggerWebhook()` - Trigger webhook
- [x] `externalApiService.getAPIDocumentation()` - OpenAPI spec
- [x] Permission-based access control
- [x] Rate limiting (per minute/day)
- [x] IP allowlist
- [x] Webhook signature verification
- [x] Service: `/src/services/external-api.ts`

#### Database Schema (Phase 4) (2026-01-27)
- [x] `audit_logs` table
- [x] `sla_configs` table
- [x] `sla_breaches` table
- [x] `sso_configs` table
- [x] `sso_sessions` table
- [x] `whitelabel_configs` table
- [x] `api_keys` table
- [x] `api_request_logs` table
- [x] `webhooks` table
- [x] `webhook_deliveries` table
- [x] `survey_requests` table
- [x] `survey_responses` table
- [x] `automation_executions` table
- [x] Row Level Security policies
- [x] Schema: `/supabase/phase4-schema.sql`

## New Services (Phase 4)

### Tenant Management
```typescript
import { tenantManagementService } from "@/services/tenant-management";

// Get tenant config
const tenant = await tenantManagementService.getTenant(tenantId);

// Create tenant
const { tenantId, adminUserId } = await tenantManagementService.createTenant({
  name: "healing-eye",
  displayName: "힐링안과",
  adminEmail: "admin@healing.com",
  adminName: "관리자",
});

// Get usage statistics
const usage = await tenantManagementService.getTenantUsage(tenantId);
```

### SSO Authentication
```typescript
import { ssoAuthService } from "@/services/sso-auth";

// Get SSO config
const config = await ssoAuthService.getConfig(tenantId);

// Generate SAML auth request
const { url, requestId } = ssoAuthService.generateSAMLAuthRequest(config);

// Process SAML assertion
const result = await ssoAuthService.processSAMLAssertion(tenantId, assertion);
```

### Audit Logging
```typescript
import { auditLogService } from "@/services/audit-log";

// Log an event
await auditLogService.log({
  tenantId,
  userId,
  action: "user.created",
  description: "New user created",
  resourceType: "user",
  resourceId: newUserId,
});

// Query logs
const { logs, total } = await auditLogService.query({
  tenantId,
  action: ["auth.login", "auth.logout"],
  limit: 50,
});
```

### SLA Monitoring
```typescript
import { slaMonitoringService } from "@/services/sla-monitoring";

// Get SLA metrics
const metrics = await slaMonitoringService.calculateMetrics(tenantId);

// Check conversation SLA
const status = await slaMonitoringService.checkConversationSLA(conversationId);

// Get breaches
const breaches = await slaMonitoringService.getBreaches(tenantId, {
  isResolved: false,
});
```

### Whitelabel
```typescript
import { whitelabelService } from "@/services/whitelabel";

// Get config
const config = await whitelabelService.getConfig(tenantId);

// Update branding
await whitelabelService.updateConfig(tenantId, {
  branding: {
    companyName: "힐링안과",
    logoUrl: "https://...",
  },
});

// Get widget embed code
const embed = whitelabelService.getWidgetEmbed(tenantId);
```

### External API
```typescript
import { externalApiService } from "@/services/external-api";

// Create API key
const { apiKey, secretKey } = await externalApiService.createAPIKey({
  tenantId,
  name: "Production API",
  permissions: ["conversations:read", "messages:write"],
  createdBy: userId,
});

// Validate request
const validation = await externalApiService.validateAPIKey(
  apiKey,
  "conversations:read",
  clientIP
);

// Create webhook
await externalApiService.createWebhook(tenantId, {
  name: "New message webhook",
  url: "https://your-server.com/webhook",
  events: ["message.received", "conversation.created"],
});
```

### Phase 5: Meta Platform Integration - COMPLETED

#### Facebook Messenger Integration (2026-01-27)
- [x] `facebookAdapter.parseWebhook()` - Parse Facebook webhook events
- [x] `facebookAdapter.sendMessage()` - Send message via Facebook
- [x] `facebookAdapter.validateSignature()` - Validate webhook signature
- [x] `facebookAdapter.getUserProfile()` - Get user profile
- [x] `facebookAdapter.sendTypingIndicator()` - Send typing indicator
- [x] `facebookAdapter.markSeen()` - Mark message as seen
- [x] `facebookAdapter.verifyWebhook()` - Verify webhook subscription
- [x] Template messages (buttons, carousel, confirm)
- [x] Quick replies support
- [x] Media messages (image, video, audio, file)
- [x] Postback handling
- [x] Service: `/src/services/channels/facebook.ts`

#### Instagram DM Integration (2026-01-27)
- [x] `instagramAdapter.parseWebhook()` - Parse Instagram webhook events
- [x] `instagramAdapter.sendMessage()` - Send message via Instagram
- [x] `instagramAdapter.validateSignature()` - Validate webhook signature
- [x] `instagramAdapter.getUserProfile()` - Get user profile
- [x] `instagramAdapter.verifyWebhook()` - Verify webhook subscription
- [x] `instagramAdapter.getInstagramBusinessAccountId()` - Get IG Business Account
- [x] Story mentions/replies handling
- [x] Quick replies support (up to 13 options)
- [x] Media messages (image, video, audio)
- [x] Generic template support
- [x] Service: `/src/services/channels/instagram.ts`

#### WhatsApp Business API Integration (2026-01-27)
- [x] `whatsappAdapter.parseWebhook()` - Parse WhatsApp webhook events
- [x] `whatsappAdapter.sendMessage()` - Send message via WhatsApp
- [x] `whatsappAdapter.validateSignature()` - Validate webhook signature
- [x] `whatsappAdapter.sendTemplateMessage()` - Send template message (outside 24hr window)
- [x] `whatsappAdapter.getMediaUrl()` - Get media URL from media ID
- [x] `whatsappAdapter.downloadMedia()` - Download media content
- [x] `whatsappAdapter.markAsRead()` - Mark message as read
- [x] `whatsappAdapter.verifyWebhook()` - Verify webhook subscription
- [x] `whatsappAdapter.isWithinMessagingWindow()` - Check 24hr window
- [x] Interactive messages (button, list)
- [x] Template messages
- [x] Media messages (image, video, audio, document, sticker)
- [x] Location messages
- [x] Contact messages
- [x] Service: `/src/services/channels/whatsapp.ts`

#### Meta Unified Webhook Handler (2026-01-27)
- [x] Single endpoint for all Meta platforms (`/api/webhooks/meta`)
- [x] Automatic platform detection (page, instagram, whatsapp_business_account)
- [x] Webhook verification (GET request)
- [x] Signature verification (x-hub-signature-256)
- [x] Unified message processing pipeline
- [x] Auto-translation integration
- [x] RAG pipeline integration
- [x] Escalation handling
- [x] Route: `/src/app/api/webhooks/meta/route.ts`

## New Services (Phase 5)

### Facebook Messenger
```typescript
import { facebookAdapter } from "@/services/channels";

// Send message
const result = await facebookAdapter.sendMessage(pageId, {
  channelType: "facebook",
  channelUserId: recipientPsid,
  contentType: "text",
  text: "Hello!",
  quickReplies: [
    { label: "Yes", action: "message", value: "yes" },
    { label: "No", action: "message", value: "no" },
  ],
});

// Get user profile
const profile = await facebookAdapter.getUserProfile(pageId, psid);

// Send typing indicator
await facebookAdapter.sendTypingIndicator(pageId, psid, "typing_on");
```

### Instagram DM
```typescript
import { instagramAdapter } from "@/services/channels";

// Send message
const result = await instagramAdapter.sendMessage(igAccountId, {
  channelType: "instagram",
  channelUserId: recipientIgsid,
  contentType: "text",
  text: "Hello!",
});

// Get user profile
const profile = await instagramAdapter.getUserProfile(igAccountId, igsid);
```

### WhatsApp Business
```typescript
import { whatsappAdapter } from "@/services/channels";

// Send session message
const result = await whatsappAdapter.sendMessage(phoneNumberId, {
  channelType: "whatsapp",
  channelUserId: recipientPhone,
  contentType: "text",
  text: "Hello!",
  quickReplies: [
    { label: "Option 1", action: "message", value: "opt1" },
    { label: "Option 2", action: "message", value: "opt2" },
  ],
});

// Send template message (outside 24hr window)
await whatsappAdapter.sendTemplateMessage(
  phoneNumberId,
  recipientPhone,
  "appointment_reminder",
  "en",
  [
    {
      type: "body",
      parameters: [
        { type: "text", text: "John" },
        { type: "text", text: "2026-02-01 10:00" },
      ],
    },
  ]
);

// Download media from WhatsApp
const mediaBuffer = await whatsappAdapter.downloadMedia(phoneNumberId, mediaId);
```

### WeChat Official Account
```typescript
import { wechatAdapter } from "@/services/channels";

// Send message (within 48hr window)
const result = await wechatAdapter.sendMessage(officialAccountId, {
  channelType: "wechat",
  channelUserId: openId,
  contentType: "text",
  text: "Hello!",
});

// Get user profile
const profile = await wechatAdapter.getUserProfile(officialAccountId, openId);

// Send template message (outside 48hr window)
import { sendTemplateMessage } from "@/services/channels/wechat";
await sendTemplateMessage(
  credentials,
  openId,
  "template_id_123",
  {
    first: { value: "예약 확인" },
    keyword1: { value: "2026-02-01" },
    keyword2: { value: "10:00" },
    remark: { value: "감사합니다" },
  },
  "https://your-site.com/booking"
);
```

### Message Templates
```typescript
import { templateService, serverTemplateService, applyVariables } from "@/services/templates";

// Get templates
const templates = await templateService.getTemplates({
  tenantId,
  category: "booking",
  status: "active",
});

// Create template
const template = await templateService.createTemplate({
  tenantId,
  name: "예약 확정 안내",
  category: "booking",
  content: "{{customerName}}님의 예약이 확정되었습니다. 예약일: {{bookingDate}}",
  contentTranslations: {
    JA: "{{customerName}}様のご予約が確定いたしました。予約日: {{bookingDate}}",
    EN: "Dear {{customerName}}, your appointment is confirmed for {{bookingDate}}",
  },
});

// Apply variables
const message = applyVariables(template.content, {
  customerName: "김철수",
  bookingDate: "2026-02-01",
});

// Get template for specific channel
const channelTemplate = await serverTemplateService.getTemplateForChannel(
  tenantId,
  "booking",
  "whatsapp",
  "JA"
);

// Create default templates for new tenant
await serverTemplateService.createDefaultTemplates(tenantId);
```

### Customer Profile
```typescript
import { serverCustomerService } from "@/services/customers";

// Get comprehensive profile
const profile = await serverCustomerService.getCustomerProfile(customerId);
// Returns: customer data, channels, conversations, bookings, stats, timeline

// Get timeline events
const timeline = await serverCustomerService.getCustomerTimeline(customerId, 50);

// Find duplicate customers
const duplicates = await serverCustomerService.findDuplicates(customerId);

// Merge customers
await serverCustomerService.mergeCustomers(primaryId, secondaryId);

// Sync with CRM
const synced = await serverCustomerService.syncWithCRM(customerId);
```

## Phase 6 AI Services (신규)

### Voice Processing (음성 메시지 처리)
```typescript
import { voiceProcessingService } from "@/services/ai";

// Transcribe voice message
const result = await voiceProcessingService.transcribeVoiceMessage(
  audioBuffer,
  "voice.mp3",
  { language: "ko", includeTimestamps: true }
);
// Returns: { text, language, duration, confidence, segments }

// Transcribe from URL
const result = await voiceProcessingService.transcribeVoiceFromUrl(audioUrl);

// Process for RAG pipeline
const { transcription, messageId } = await voiceProcessingService.processVoiceMessageForRAG(
  conversationId,
  audioBuffer,
  "voice.mp3"
);
```

### Image Analysis (이미지 분석)
```typescript
import { imageAnalysisService } from "@/services/ai";

// Analyze single image
const result = await imageAnalysisService.analyzeImage(imageUrl, {
  language: "ko",
  analyzeForMedical: true,
});
// Returns: { description, category, tags, medicalRelevance, suggestedResponse, confidence }

// Analyze multiple images (before/after)
const result = await imageAnalysisService.analyzeMultipleImages(
  [beforeImageUrl, afterImageUrl],
  { context: "라식 수술" }
);

// Analyze document (OCR)
const doc = await imageAnalysisService.analyzeDocument(
  imageUrl,
  "medical_record",
  "ko"
);
// Returns: { extractedText, structuredData, documentType, confidence }
```

### Sentiment Analysis (감정 분석)
```typescript
import { sentimentAnalysisService } from "@/services/ai";

// Analyze message sentiment
const result = await sentimentAnalysisService.analyzeSentiment(message, {
  language: "ko",
  includeEmotions: true,
});
// Returns: { sentiment, score, confidence, emotions, urgency, suggestedPriority, requiresEscalation }

// Analyze sentiment trend
const trend = await sentimentAnalysisService.analyzeSentimentTrend(messages);
// Returns: { trend, averageSentiment, sentimentOverTime, riskLevel }

// Process message with auto-escalation
const result = await sentimentAnalysisService.processMessageSentiment(
  messageId,
  conversationId,
  content
);
```

### Conversion Prediction (전환 예측)
```typescript
import { conversionPredictionService } from "@/services/ai";

// Predict conversion probability
const prediction = await conversionPredictionService.predictConversion(
  customerId,
  tenantId
);
// Returns: { probability, confidence, stage, factors, recommendedActions, riskOfChurn }

// Get high-value leads
const leads = await conversionPredictionService.getHighValueLeads(tenantId, {
  minProbability: 0.6,
  limit: 20,
});

// Get conversion funnel analytics
const funnel = await conversionPredictionService.getConversionFunnel(
  tenantId,
  { start: startDate, end: endDate }
);
```

### Proactive Outreach (선제 연락)
```typescript
import { proactiveOutreachService } from "@/services/ai";

// Identify outreach candidates
const candidates = await proactiveOutreachService.identifyOutreachCandidates(
  tenantId,
  {
    limit: 50,
    reasons: ["high_conversion_probability", "stale_conversation"],
    minDaysSinceContact: 3,
  }
);

// Generate AI message
const message = await proactiveOutreachService.generateOutreachMessage(
  customerName,
  language,
  "high_conversion_probability",
  tenantId
);

// Create and execute campaign
const campaign = await proactiveOutreachService.createCampaign(tenantId, {
  name: "High-value leads follow-up",
  type: "high_conversion_probability",
  status: "scheduled",
  targetCriteria: { minConversionProbability: 0.7 },
  messageTemplate: "...",
});
```

### Calendar Sync (캘린더 동기화)
```typescript
import { calendarSyncService } from "@/services/calendar-sync";

// Sync bookings to Google Calendar
const result = await calendarSyncService.syncBookingsToCalendar(tenantId, {
  provider: "google",
  calendarId: "primary",
  accessToken,
  syncEnabled: true,
  twoWaySync: true,
  defaultReminders: [{ method: "popup", minutes: 30 }],
});

// Check for conflicts
const conflicts = await calendarSyncService.checkConflicts(
  config,
  proposedTime,
  60 // duration in minutes
);

// Get OAuth URL
const authUrl = calendarSyncService.getGoogleOAuthUrl(tenantId, redirectUri);
```

### Chatbot Widget
```typescript
// Widget Component
import { ChatWidget } from "@/components/widget/ChatWidget";

<ChatWidget
  config={{
    tenantId: "your-tenant-id",
    apiUrl: "https://your-api.com",
    primaryColor: "#2563eb",
    title: "채팅 상담",
    welcomeMessage: "안녕하세요!",
  }}
/>

// Widget Service (Backend)
import { widgetService } from "@/services/widget";

// Create session
const session = await widgetService.createWidgetSession(tenantId, language);

// Process message
const response = await widgetService.processWidgetMessage({
  tenantId,
  sessionId,
  message,
  language,
});

// Generate embed code
const embedCode = widgetService.generateEmbedCode(tenantId, apiUrl);
```

## Database Migrations

### Phase 5 Migration (`/supabase/migrations/002_message_templates.sql`)
- `message_templates` table - Reusable message templates
- `oauth_sessions` table - OAuth flow state management
- Row Level Security policies
- Template usage increment function
- OAuth session cleanup function

## Phase 7: AI Advanced Features - COMPLETED

### Fine-tuning Service (2026-01-27)
- [x] `fineTuningService.createTrainingData()` - Generate training data from escalations
- [x] `fineTuningService.startFineTuning()` - Start OpenAI fine-tuning job
- [x] `fineTuningService.getJobStatus()` - Check fine-tuning job status
- [x] `fineTuningService.cancelJob()` - Cancel fine-tuning job
- [x] `fineTuningService.listJobs()` - List fine-tuning jobs
- [x] `fineTuningService.testFineTunedModel()` - Test fine-tuned model
- [x] `fineTuningService.getFineTunedModels()` - List fine-tuned models
- [x] Automatic training data generation from resolved escalations
- [x] JSONL format for OpenAI fine-tuning
- [x] Service: `/src/services/ai/fine-tuning.ts`

### Competitor Analysis Service (2026-01-27)
- [x] `competitorAnalysisService.addCompetitor()` - Add competitor
- [x] `competitorAnalysisService.listCompetitors()` - List competitors
- [x] `competitorAnalysisService.fetchPrices()` - Fetch competitor prices
- [x] `competitorAnalysisService.comparePrices()` - Compare prices
- [x] `competitorAnalysisService.generateReport()` - Generate analysis report
- [x] `competitorAnalysisService.setPriceAlert()` - Set price alert
- [x] `competitorAnalysisService.checkPriceAlerts()` - Check price alerts
- [x] LLM-based web scraping and price extraction
- [x] Service: `/src/services/ai/competitor-analysis.ts`

### Performance Optimization Service (2026-01-27)
- [x] `performanceOptimizationService.analyzeResponseTimes()` - Analyze response times
- [x] `performanceOptimizationService.identifyBottlenecks()` - Identify bottlenecks
- [x] `performanceOptimizationService.optimizeRAGPipeline()` - Optimize RAG
- [x] `performanceOptimizationService.optimizeEmbeddingCache()` - Optimize embedding cache
- [x] `performanceOptimizationService.generatePerformanceReport()` - Generate report
- [x] `performanceOptimizationService.runHealthCheck()` - Run health check
- [x] Automatic bottleneck detection
- [x] RAG pipeline optimization suggestions
- [x] Service: `/src/services/ai/performance-optimization.ts`

### Upstash Vector Service (2026-01-27)
- [x] `upstashVectorService.upsert()` - Upsert vectors
- [x] `upstashVectorService.query()` - Query similar vectors
- [x] `upstashVectorService.delete()` - Delete vectors
- [x] `upstashVectorService.fetch()` - Fetch vectors by ID
- [x] `upstashVectorService.getStats()` - Get index statistics
- [x] `upstashVectorService.migrateFromPgvector()` - Migrate from pgvector
- [x] Namespace support for multi-tenant isolation
- [x] Metadata filtering support
- [x] Service: `/src/services/ai/upstash-vector.ts`

### API Routes (Phase 7)
- [x] `GET /api/ai/fine-tuning` - List fine-tuning jobs
- [x] `POST /api/ai/fine-tuning` - Start fine-tuning job
- [x] `GET /api/ai/fine-tuning/[jobId]` - Get job status
- [x] `DELETE /api/ai/fine-tuning/[jobId]` - Cancel job
- [x] `POST /api/ai/fine-tuning/test` - Test fine-tuned model
- [x] `GET /api/competitor-analysis` - Get competitors
- [x] `POST /api/competitor-analysis` - Add competitor / fetch prices
- [x] `GET /api/competitor-analysis/report` - Generate report
- [x] `GET /api/performance` - Get performance metrics
- [x] `POST /api/performance` - Run health check / optimize
- [x] `GET /api/vector` - Get vector stats
- [x] `POST /api/vector` - Query / upsert vectors
- [x] `DELETE /api/vector` - Delete vectors

### Widget API Routes (2026-01-27)
- [x] `POST /api/widget/session` - Create widget session
- [x] `POST /api/widget/message` - Process widget message
- [x] `GET /api/widget/config` - Get widget configuration

## New Services (Phase 7)

### Fine-tuning
```typescript
import { fineTuningService } from "@/services/ai";

// Generate training data
const trainingData = await fineTuningService.createTrainingData(tenantId, {
  minConfidence: 0.8,
  limit: 100,
});

// Start fine-tuning
const job = await fineTuningService.startFineTuning(
  tenantId,
  trainingData.filePath,
  { suffix: "healing-eye-v1" }
);

// Check status
const status = await fineTuningService.getJobStatus(jobId);

// Test model
const result = await fineTuningService.testFineTunedModel(modelId, testQuery);
```

### Competitor Analysis
```typescript
import { competitorAnalysisService } from "@/services/ai";

// Add competitor
await competitorAnalysisService.addCompetitor(tenantId, {
  name: "경쟁병원",
  website: "https://competitor.com",
  category: "ophthalmology",
});

// Fetch and compare prices
await competitorAnalysisService.fetchPrices(tenantId, competitorId);
const comparison = await competitorAnalysisService.comparePrices(tenantId);

// Generate report
const report = await competitorAnalysisService.generateReport(tenantId);
```

### Performance Optimization
```typescript
import { performanceOptimizationService } from "@/services/ai";

// Analyze performance
const analysis = await performanceOptimizationService.analyzeResponseTimes(tenantId);
const bottlenecks = await performanceOptimizationService.identifyBottlenecks(tenantId);

// Optimize
await performanceOptimizationService.optimizeRAGPipeline(tenantId);
await performanceOptimizationService.optimizeEmbeddingCache(tenantId);

// Generate report
const report = await performanceOptimizationService.generatePerformanceReport(tenantId);

// Health check
const health = await performanceOptimizationService.runHealthCheck();
```

### Upstash Vector
```typescript
import { upstashVectorService } from "@/services/ai";

// Upsert vectors
await upstashVectorService.upsert(
  [{ id: "doc-1", vector: embedding, metadata: { tenantId, category: "faq" } }],
  "tenant-123"
);

// Query similar
const results = await upstashVectorService.query(
  queryEmbedding,
  { topK: 5, namespace: "tenant-123", filter: "category = 'faq'" }
);

// Migrate from pgvector
await upstashVectorService.migrateFromPgvector(tenantId);
```

## Build Status

✅ Build successful (2026-01-27)
- All TypeScript errors resolved
- All services implemented
- All API routes functional
- 98 unit tests passing (8 test suites)

## 14. 테스트 설정

### Vitest 설정
- **Config**: `vitest.config.ts`
- **Setup**: `src/test/setup.ts` (환경변수 모킹, fetch 모킹)
- **실행**: `npm test` (98개 테스트 통과)

### 테스트 파일 목록
| 파일 | 테스트 수 | 설명 |
|------|-----------|------|
| `channels.test.ts` | 10 | LINE, KakaoTalk, Meta, WeChat 채널 어댑터 |
| `rag-pipeline.test.ts` | 8 | RAG 파이프라인 |
| `translation.test.ts` | 17 | 언어 감지, 번역, 국가-언어 매핑 |
| `templates.test.ts` | 14 | 변수 추출/적용, 메시지 템플릿 |
| `llm.test.ts` | 13 | 모델 선택, LLM 응답 생성, 신뢰도 계산 |
| `sla-monitoring.test.ts` | 16 | SLA 기본 설정, 에스컬레이션 정책, DB 매핑 |
| `satisfaction-survey.test.ts` | 13 | 다국어 설문 템플릿, 메시지 빌드 |
| `qstash.test.ts` | 7 | 잡 큐 모듈, 페이로드 구조 |

### 모킹 패턴
```typescript
// 클래스 모킹 (생성자가 있는 라이브러리)
vi.mock("openai", () => {
  const MockOpenAI = class {
    chat = { completions: { create: vi.fn().mockResolvedValue({...}) } };
  };
  return { default: MockOpenAI };
});

// Supabase 서버 클라이언트 모킹
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      // ... chained methods
    })),
  })),
}));
```

## 15. Sentry 에러 트래킹

### 설정 파일
- `sentry.client.config.ts` - 클라이언트 사이드 설정
- `sentry.server.config.ts` - 서버 사이드 설정
- `sentry.edge.config.ts` - Edge 런타임 설정
- `next.config.ts` - `withSentryConfig()` 래핑
- `src/app/global-error.tsx` - 전역 에러 바운더리

### 필요 환경변수
```
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=cs-automation
SENTRY_AUTH_TOKEN=sntrys_xxx
```

### 설정 특징
- 프로덕션: 트레이스 샘플 10-20%, 에러 리플레이 100%
- 개발: 트레이스 100%, 디버그 비활성
- 자동 계측: API Routes, Server Components, Middleware
- 소스맵: CI에서만 업로드, 브라우저에서 숨김

## 16. CI/CD (GitHub Actions)

### 워크플로우: `.github/workflows/ci.yml`

```
Push/PR → Lint → Test → Build → Deploy
```

| 이벤트 | 동작 |
|--------|------|
| PR → main | Lint + Test + Build + Preview 배포 |
| Push → main | Lint + Test + Build + Production 배포 |
| Push → develop | Lint + Test + Build |

### 필요 Secrets (GitHub)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## 17. GitHub 저장소

- **URL**: https://github.com/afformationceo-debug/csflow.git
- **브랜치**: main

---

## 12. 전체 기능 세분화 목록 (개발 체크리스트)

### Phase 1: 기반 구축 + LINE 연동 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| 데이터베이스 스키마 | PostgreSQL + pgvector 설정 | ✅ |
| 멀티테넌트 아키텍처 | tenants, users 테이블 | ✅ |
| 고객 관리 | customers, customer_channels 테이블 | ✅ |
| 대화/메시지 | conversations, messages 테이블 | ✅ |
| 내부 노트 | internal_notes 테이블 | ✅ |
| 지식베이스 | knowledge_documents + pgvector | ✅ |
| 에스컬레이션 | escalations 테이블 | ✅ |
| LINE 연동 | Messaging API, 웹훅, 프로필 조회 | ✅ |
| 메시지 정규화 | UnifiedInbound/OutboundMessage | ✅ |
| 통합 인박스 UI | 3컬럼 레이아웃, 필터링, 상담 태그 | ✅ |
| React Query Hooks | useConversations, useMessages 등 | ✅ |

### Phase 2: LLM RAG 자동응대 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| RAG 파이프라인 | ragPipeline.process(), getSuggestion() | ✅ |
| 벡터 검색 | generateEmbedding(), retrieveDocuments() | ✅ |
| 하이브리드 검색 | hybridSearch() - RRF 알고리즘 | ✅ |
| LLM 서비스 | GPT-4, Claude 3 통합 | ✅ |
| 모델 라우팅 | llmService.selectModel() | ✅ |
| 신뢰도 계산 | confidenceCalculator | ✅ |
| 에스컬레이션 키워드 | 자동 감지 | ✅ |
| 지식베이스 관리 | CRUD, 카테고리, 통계 | ✅ |
| 지식베이스 UI | 문서 관리, 임베딩 재생성 | ✅ |
| CRM API 연동 | 고객, 예약, 노트 관리 | ✅ |

### Phase 3: 자동화 & CRM 심화 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| 카카오톡 연동 | Kakao i Open Builder 어댑터 | ✅ |
| 자동화 규칙 엔진 | ruleEngine.processTrigger() | ✅ |
| 트리거 유형 | message_received, booking_confirmed 등 | ✅ |
| 액션 실행 | send_message, update_status, add_tag 등 | ✅ |
| 에스컬레이션 학습 | learningPipeline.processEscalation() | ✅ |
| 만족도 조사 | satisfactionSurveyService | ✅ |
| 다국어 설문 | KO, EN, JA, ZH, VI, TH | ✅ |
| 분석 대시보드 | analyticsService 메트릭스 | ✅ |
| CRM 동기화 | crmSyncService 양방향 동기화 | ✅ |

### Phase 4: 엔터프라이즈 기능 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| 멀티테넌트 관리 | tenantManagementService | ✅ |
| 역할 기반 권한 | owner, admin, manager, agent | ✅ |
| SSO/SAML 인증 | ssoAuthService | ✅ |
| OIDC 지원 | OAuth 2.0 + OpenID Connect | ✅ |
| 감사 로그 | auditLogService | ✅ |
| 로그 내보내기 | JSON/CSV 포맷 | ✅ |
| SLA 모니터링 | slaMonitoringService | ✅ |
| SLA 위반 추적 | sla_breaches 테이블 | ✅ |
| 화이트라벨 | whitelabelService | ✅ |
| 커스텀 도메인 | SSL 인증서 자동 발급 | ✅ |
| 외부 API | externalApiService | ✅ |
| API 키 관리 | 권한, Rate Limit, IP 허용 목록 | ✅ |
| 웹훅 발송 | webhook signature verification | ✅ |

### Phase 5: Meta 플랫폼 통합 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| Facebook Messenger | facebookAdapter | ✅ |
| Instagram DM | instagramAdapter | ✅ |
| WhatsApp Business | whatsappAdapter | ✅ |
| Meta 통합 웹훅 | /api/webhooks/meta | ✅ |
| Meta OAuth | 페이지/계정 연동 | ✅ |
| WeChat 연동 | wechatAdapter | ✅ |
| 채널 관리 UI | 연결/해제, 설정 | ✅ |
| 고객 프로필 통합 | 복수 채널 타임라인 | ✅ |
| 중복 고객 감지 | findDuplicates() | ✅ |
| 고객 병합 | mergeCustomers() | ✅ |
| 메시지 템플릿 | templateService | ✅ |
| 다국어 템플릿 | contentTranslations | ✅ |

### Phase 6: AI 고도화 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| 음성 처리 | voiceProcessingService (Whisper) | ✅ |
| 이미지 분석 | imageAnalysisService (GPT-4 Vision) | ✅ |
| 문서 OCR | analyzeDocument() | ✅ |
| 감정 분석 | sentimentAnalysisService | ✅ |
| 감정 트렌드 | analyzeSentimentTrend() | ✅ |
| 전환 예측 | conversionPredictionService | ✅ |
| 고가치 리드 | getHighValueLeads() | ✅ |
| 선제 연락 | proactiveOutreachService | ✅ |
| 캠페인 관리 | createCampaign() | ✅ |
| 캘린더 동기화 | calendarSyncService | ✅ |
| Google Calendar | OAuth 연동 | ✅ |
| 챗봇 위젯 | ChatWidget 컴포넌트 | ✅ |
| 위젯 서비스 | widgetService | ✅ |

### Phase 7: AI 어드밴스드 ✅ 완료

| 항목 | 설명 | 상태 |
|------|------|------|
| Fine-tuning | fineTuningService | ✅ |
| 학습 데이터 생성 | createTrainingData() | ✅ |
| 모델 테스트 | testFineTunedModel() | ✅ |
| 경쟁사 분석 | competitorAnalysisService | ✅ |
| 가격 비교 | comparePrices() | ✅ |
| 분석 리포트 | generateReport() | ✅ |
| 성능 최적화 | performanceOptimizationService | ✅ |
| 병목 분석 | identifyBottlenecks() | ✅ |
| Upstash Vector | upstashVectorService | ✅ |
| pgvector 마이그레이션 | migrateFromPgvector() | ✅ |

### 향후 개발 예정 (Phase 8+)

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 테스트 자동화 | Unit/E2E 테스트 (Vitest, Playwright) | 높음 |
| CI/CD 파이프라인 | GitHub Actions | 높음 |
| 모니터링/알림 | Sentry, DataDog 연동 | 중간 |
| 다국어 UI | next-intl 적용 | 중간 |
| 모바일 앱 | React Native | 낮음 |
| 환자 포털 | 고객용 웹앱 | 낮음 |

---

## 13. Supabase 마이그레이션 가이드

### 마이그레이션 파일 목록

| 순서 | 파일 경로 | 설명 |
|------|----------|------|
| 1 | `/supabase/migrations/001_initial_schema.sql` | 기본 스키마 (tenants, **users**, channels, conversations 등) |
| 2 | `/web/supabase/schema.sql` | 확장 스키마 (**중복 주의**, 001과 유사하나 **users 테이블 없음**) |
| 3 | `/supabase/migrations/002_message_templates.sql` | 메시지 템플릿, OAuth 세션 (**users 자동 생성 포함**) |
| 4 | `/web/supabase/phase4-schema.sql` | Phase 4 테이블 (audit_logs, sla_configs, sso_configs 등) |

### 스키마 차이점 (중요)

| 항목 | `001_initial_schema.sql` | `/web/supabase/schema.sql` |
|------|--------------------------|----------------------------|
| users 테이블 | ✅ 있음 (`auth.users` FK) | ❌ **없음** |
| ENUM 타입 | ✅ 사용 (`channel_type`, `user_role` 등) | ❌ TEXT 사용 |
| UUID 생성 | `uuid_generate_v4()` | `gen_random_uuid()` |
| 테이블 이름 | `knowledge_embeddings` | `knowledge_chunks` |
| RLS 정책 | 사용자 기반 (auth.uid()) | 서비스 롤 기반 |

### 실행 순서 및 주의사항

**경로 A: 001 기반 (권장 - users 테이블 포함)**:
```
1. 001_initial_schema.sql
   - 기본 테이블 및 ENUM 타입 생성
   - tenants, users, channel_accounts, customers, conversations, messages 등
   - ⚠️ users.id가 auth.users(id)를 참조하므로 Supabase Auth 필요

2. 002_message_templates.sql
   - users 테이블이 이미 존재하므로 자동 생성 건너뜀
   - message_templates, oauth_sessions 테이블 생성

3. phase4-schema.sql
   - audit_logs, sla_configs, sla_breaches, sso_configs 등
```

**경로 B: schema.sql 기반 (users 없는 환경)**:
```
1. /web/supabase/schema.sql
   - 기본 테이블 (users 없음, TEXT 타입 사용)

2. 002_message_templates.sql
   - ✅ users 테이블 자동 생성 (DO $$ 블록으로 체크)
   - message_templates, oauth_sessions 테이블 생성

3. phase4-schema.sql
   - 나머지 Phase 4 테이블 생성
```

### 002 마이그레이션 수정 이력 (2026-01-27)

**오류**: `ERROR: 42P01: relation "users" does not exist`
- **원인**: `/web/supabase/schema.sql` 실행 후 002를 실행하면 users 테이블이 없어서 FK 참조 실패
- **해결**: 002에 `DO $$ ... END $$` 블록 추가 - users 테이블 존재 여부 확인 후 없으면 자동 생성
- **추가 개선**: RLS 정책도 `auth` 스키마 존재 여부 체크 후 조건부 생성
- service_role 전체 접근 정책을 message_templates, oauth_sessions에 추가

### Supabase SQL Editor에서 실행

```bash
# 로컬 Supabase CLI 사용 시
supabase db push

# 또는 Supabase 대시보드 SQL Editor에서 직접 실행
# https://app.supabase.com/project/[project-id]/sql/new
```

### 마이그레이션 확인

실행 후 테이블 생성 확인:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

users 테이블 존재 확인:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'users'
);
```
