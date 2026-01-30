# Vercel 배포 확인 및 지식베이스 검증 가이드

## 현재 상황

✅ **완료된 작업**:
1. Migration 008 실행 완료 (Database RLS 수정)
2. Frontend 코드 수정 완료 (tenant_id 이슈 해결)
3. GitHub에 커밋 푸시 완료 (`2e433e6`, `2749f2d`)

🔄 **진행 중**:
- Vercel 자동 배포 (GitHub main 브랜치 푸시 시 자동 트리거)

## Vercel 배포 확인 방법

### 1. Vercel 대시보드에서 확인

1. https://vercel.com/dashboard 접속
2. 프로젝트 선택 (`csflow` 또는 해당 프로젝트명)
3. "Deployments" 탭 확인
4. 최신 배포 상태 확인:
   - ✅ **Ready** (녹색) - 배포 완료
   - 🔄 **Building** (파란색) - 배포 진행 중
   - ❌ **Error** (빨간색) - 배포 실패

### 2. 배포 완료 후 브라우저 캐시 클리어

배포가 완료되었더라도 **브라우저 캐시** 때문에 이전 코드가 로드될 수 있습니다.

**하드 새로고침 (캐시 무시) 방법**:
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + F5` 또는 `Ctrl + F5`

또는:
1. 개발자 도구 열기 (F12)
2. Network 탭 선택
3. "Disable cache" 체크박스 활성화
4. 새로고침 (F5)

### 3. 지식베이스 UI 확인

배포 완료 + 하드 새로고침 후:

1. https://csflow.vercel.app/knowledge 접속
2. 로그인: `afformation.ceo@gmail.com / afformation1!`
3. **기대 결과**:
   - ✅ 75개 문서 표시
   - ✅ 카테고리 필터 작동
   - ✅ 검색 기능 작동
   - ✅ Console 오류 없음 (F12 → Console 탭)

### 4. Console 확인

개발자 도구 (F12) → Console 탭에서:

**기대 결과** (오류 없음):
```
[정상] GET https://bfxtgqhollfkzawuzfwo.supabase.co/rest/v1/knowledge_documents?select=*&tenant_id=eq.8d3bd24e-...
```

**이전 오류** (더 이상 나오면 안 됨):
```
❌ GET ...?tenant_id=eq.none&... 400 (Bad Request)
```

## 문제 해결

### Case 1: 배포가 아직 진행 중인 경우
- Vercel 배포는 보통 **1-3분** 소요
- Deployments 탭에서 "Building" 상태 확인
- 완료될 때까지 대기

### Case 2: 배포 완료했지만 여전히 오류 발생
1. **브라우저 캐시 완전 삭제**:
   - Chrome: 설정 → 개인정보 및 보안 → 인터넷 사용 기록 삭제 → 캐시된 이미지 및 파일
   - 또는 시크릿 모드에서 접속

2. **Console 오류 재확인**:
   - F12 → Console 탭
   - `tenant_id=eq.none` 오류가 여전히 나오면 → 배포가 완료되지 않았거나 다른 이슈

3. **Network 탭 확인**:
   - F12 → Network 탭
   - 새로고침
   - `knowledge_documents` 요청 찾기
   - Request URL에 `tenant_id=eq.8d3bd24e...` (정상) vs `tenant_id=eq.none` (오류) 확인

### Case 3: admin.png 404 오류
```
GET https://csflow.vercel.app/avatars/admin.png 404 (Not Found)
```

**이 오류는 지식베이스와 무관합니다** (프로필 이미지 경로 이슈).

무시해도 되지만, 해결하려면:
```bash
# public/avatars/ 폴더 생성 및 기본 이미지 추가
mkdir -p /Users/hyunkeunji/Desktop/csautomation/web/public/avatars
# 기본 admin.png 이미지 추가 (또는 코드에서 경로 수정)
```

## 다음 단계: 풀자동화 Stage 1-2 테스트

### 사전 조건 확인 ✅

1. ✅ Migration 008 실행 완료
2. ✅ Frontend 수정 완료
3. ✅ LINE 풀자동화 활성화:
```sql
UPDATE channel_accounts
SET full_automation_enabled = true
WHERE channel_type = 'line';
```
4. 🔄 지식베이스 UI 75개 문서 표시 (Vercel 배포 후 확인)

### Stage 1 테스트 (고객 인입)

**사용자 액션**: LINE 메시지 전송

**자동 검증 항목**:
1. `customers` 테이블에 신규 고객 자동 등록
2. `conversations` 테이블에 대화 생성
3. LINE webhook → `/api/webhooks/line` 정상 처리

**확인 방법**:
```sql
-- Supabase SQL Editor에서 실행
-- 1. 최근 생성된 고객 확인
SELECT * FROM customers
ORDER BY created_at DESC
LIMIT 5;

-- 2. 최근 대화 확인
SELECT c.*, cu.name as customer_name
FROM conversations c
LEFT JOIN customers cu ON c.customer_id = cu.id
ORDER BY c.created_at DESC
LIMIT 5;

-- 3. 최근 메시지 확인
SELECT m.*, c.id as conversation_id
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
ORDER BY m.created_at DESC
LIMIT 10;
```

### Stage 2 테스트 (AI 자동 응대)

**자동 검증 항목**:
1. 질문 분류 (가격/시술정보/위치/고민/통역)
2. RAG 기반 답변 생성 (지식베이스 + 거래처 정보)
3. 지속적인 예약 유도 프롬프트
4. 예약 의도 감지
5. 예약 양식 전송

**확인 방법**:
1. LINE 앱에서 AI 응답 수신 확인
2. Supabase에서 로그 확인:
```sql
-- AI 응답 로그 확인
SELECT * FROM ai_response_logs
ORDER BY created_at DESC
LIMIT 10;

-- 예약 의도 감지 로그 확인
SELECT * FROM booking_intent_logs
ORDER BY detected_at DESC
LIMIT 10;

-- 예약 요청 생성 확인
SELECT * FROM booking_requests
ORDER BY created_at DESC
LIMIT 5;
```

## Vercel 환경변수 확인 (필요 시)

Vercel 대시보드 → Settings → Environment Variables에서 다음 값들이 설정되어 있는지 확인:

```
NEXT_PUBLIC_SUPABASE_URL=https://bfxtgqhollfkzawuzfwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
DEEPL_API_KEY=...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```

모든 환경변수가 Production, Preview, Development 환경 모두에 설정되어 있어야 합니다.

## 요약

1. ✅ 코드 수정 완료 및 GitHub 푸시
2. 🔄 Vercel 배포 자동 진행 중 (1-3분 소요)
3. 📋 배포 완료 후: 하드 새로고침 + Console 확인
4. ✅ 지식베이스 75개 문서 표시 확인
5. 🚀 Stage 1-2 테스트 진행

**현재 상태**: Vercel 배포 완료 대기 중

**예상 시간**: 2-5분 (배포 1-3분 + 확인 1-2분)
