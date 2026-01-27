# CSFlow - CS 자동화 플랫폼

50개 이상의 메신저 채널을 통합 관리하고, LLM RAG 기반 자동 응대와 CRM 연동을 제공하는 해외환자유치 CS 자동화 플랫폼

## 핵심 기능

- **통합 인박스**: LINE, WhatsApp, Facebook, Instagram, 카카오톡 등 모든 메신저를 하나의 인터페이스에서 고객별로 통합 관리
- **자동 번역**: DeepL 기반 14개 언어 실시간 번역 (한/영/일/중/베트남어/태국어 등)
- **AI 자동 응대**: GPT-4 + Claude 혼용 RAG 파이프라인으로 24/7 고객 서비스
- **거래처별 학습**: 병원/클리닉별 지식베이스 분리, 에스컬레이션 기반 점진적 품질 향상
- **CRM 연동**: 고객 프로필, 예약 관리, 자동 리마인드
- **SLA 모니터링**: 응답 시간, 해결율, 고객만족도 실시간 추적
- **만족도 조사**: 다국어 자동 설문 발송 및 통계

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, TypeScript |
| UI | shadcn/ui, Tailwind CSS v4, Radix UI |
| Database | Supabase (PostgreSQL + pgvector) |
| LLM | OpenAI GPT-4, Anthropic Claude |
| 번역 | DeepL API |
| 캐시/큐 | Upstash Redis, QStash |
| 벡터 검색 | Upstash Vector |
| 모니터링 | Sentry |
| CI/CD | GitHub Actions |
| 테스트 | Vitest |

## 프로젝트 구조

```
csautomation/
├── web/                          # Next.js 앱
│   ├── src/
│   │   ├── app/                  # App Router 페이지
│   │   │   ├── (dashboard)/      # 대시보드 레이아웃
│   │   │   └── api/              # API 라우트 (30개)
│   │   ├── components/           # React 컴포넌트
│   │   │   └── ui/               # shadcn/ui 컴포넌트
│   │   ├── hooks/                # React 훅 (7개)
│   │   ├── lib/                  # 라이브러리 설정
│   │   │   ├── supabase/         # Supabase 클라이언트
│   │   │   └── upstash/          # Redis, QStash, Vector
│   │   ├── services/             # 비즈니스 로직 (47개)
│   │   │   ├── ai/               # AI 서비스 (RAG, LLM 등)
│   │   │   ├── channels/         # 채널 어댑터 (LINE, Meta 등)
│   │   │   └── automation/       # 자동화 엔진
│   │   └── test/                 # 테스트 코드
│   ├── sentry.*.config.ts        # Sentry 설정
│   └── vitest.config.ts          # Vitest 설정
├── supabase/
│   └── migrations/               # DB 마이그레이션 (4개)
└── .github/
    └── workflows/ci.yml          # CI/CD 파이프라인
```

## 시작하기

### 사전 요구사항

- Node.js 20+
- npm 9+
- Supabase 프로젝트
- OpenAI API 키
- DeepL API 키

### 설치

```bash
# 레포지토리 클론
git clone https://github.com/afformationceo-debug/csflow.git
cd csflow/web

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일에 실제 키 입력

# 개발 서버 실행
npm run dev
```

### 데이터베이스 설정

Supabase SQL Editor에서 순서대로 실행:

```
1. supabase/migrations/001_initial_schema.sql    # 기본 스키마
2. supabase/migrations/002_message_templates.sql  # 메시지 템플릿
3. web/supabase/phase4-schema.sql                 # Phase 4 확장
```

> `schema.sql`을 먼저 실행한 경우 002가 자동으로 누락된 users 테이블을 생성합니다.

### 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npm run lint         # ESLint 검사
npm test             # 테스트 실행
npm run test:watch   # 테스트 워치 모드
npm run test:coverage # 커버리지 리포트
```

## 환경변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 서비스 롤 키 |
| `OPENAI_API_KEY` | ✅ | OpenAI API 키 |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API 키 |
| `DEEPL_API_KEY` | ✅ | DeepL 번역 API 키 |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis 토큰 |
| `QSTASH_TOKEN` | ❌ | QStash 작업 큐 토큰 |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | Sentry DSN |
| `LINE_CHANNEL_ACCESS_TOKEN` | ❌ | LINE 채널 토큰 |
| `META_APP_SECRET` | ❌ | Meta 앱 시크릿 |
| `CRM_API_BASE_URL` | ❌ | CRM API 기본 URL |

## 서비스 아키텍처

```
메신저 채널              통합 레이어                 AI 서비스
┌──────────┐
│  LINE    │─┐
│ WhatsApp │─┤     ┌──────────────┐     ┌──────────────────┐
│ Facebook │─┼────▶│ 웹훅 핸들러   │────▶│ RAG 파이프라인     │
│Instagram │─┤     │ + 정규화      │     │ GPT-4 + Claude   │
│ 카카오톡  │─┘     └──────────────┘     └──────────────────┘
└──────────┘              │                        │
                          ▼                        ▼
                  ┌──────────────┐       ┌──────────────────┐
                  │ 통합 인박스    │       │ 에스컬레이션/학습  │
                  │ (실시간 UI)   │       │ (점진적 개선)     │
                  └──────────────┘       └──────────────────┘
```

## CI/CD

GitHub Actions로 자동화:

- **PR**: Lint → Test → Build → Preview 배포
- **main 푸시**: Lint → Test → Build → Production 배포

## 라이선스

Private - All rights reserved
