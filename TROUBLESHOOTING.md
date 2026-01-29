# LINE 연동 트러블슈팅 가이드

## 현재 상황
- ✅ LINE Webhook URL 설정 완료
- ✅ `.env.local`에 모든 환경변수 설정 완료
- ✅ channel_accounts 테이블에 LINE 채널 등록됨
- ❌ conversations 테이블 비어있음 (실제 메시지 주고받았음에도)

## 문제 진단 체크리스트

### 1. Vercel 환경변수 확인
**위치**: https://vercel.com/dashboard → csflow → Settings → Environment Variables

**필수 환경변수**:
```
✅ SUPABASE_SERVICE_ROLE_KEY (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)
✅ LINE_CHANNEL_ACCESS_TOKEN (R/D3uGLWq0G4VBRF8NJTx0w4...)
✅ LINE_CHANNEL_SECRET (4d6ed56d04080afca0d60e42464ec49b)
✅ LINE_CHANNEL_ID (2008754781)
✅ LINE_BOT_BASIC_ID (@246kdolz)
✅ NEXT_PUBLIC_SUPABASE_URL (https://bfxtgqhollfkzawuzfwo.supabase.co)
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)
✅ OPENAI_API_KEY (sk-...)
✅ DEEPL_API_KEY (...)
```

**확인 방법**:
1. Vercel Dashboard에서 각 변수 확인
2. 누락된 변수가 있다면 추가
3. 환경변수 추가/수정 후 **반드시 Redeploy** 필요

### 2. LINE Developers Console 설정 확인
**위치**: https://developers.line.biz/ → 채널 선택

**Webhook 설정**:
1. **Messaging API** 탭
2. **Webhook settings**:
   - Webhook URL: `https://csflow.vercel.app/api/webhooks/line`
   - Use webhook: **ON** (토글 활성화)
   - Verify 버튼 클릭 → "Success" 확인
3. **Bot settings**:
   - Auto-reply messages: **Disabled** (중요!)
   - Greeting messages: **Disabled** (중요!)

### 3. Webhook 로그 확인
**Vercel 로그**:
1. https://vercel.com/dashboard → csflow → Deployments
2. 최신 배포 클릭 → **Runtime Logs** 탭
3. LINE 메시지 전송 후 로그 확인

**예상 로그**:
```
[LINE] Received message from user U...
[LINE] Created conversation: uuid...
[LINE] Saved message: uuid...
```

**오류 로그 예시**:
```
Error: Missing required environment variable: LINE_CHANNEL_ACCESS_TOKEN
Error: Invalid LINE webhook signature
Error: Supabase query failed: insert or update on table "conversations" violates RLS policy
```

### 4. 수동 테스트 (cURL)
로컬에서 직접 webhook 테스트:

```bash
# 1. 개발 서버 실행
cd web
npm run dev

# 2. 다른 터미널에서 테스트 메시지 전송
curl -X POST http://localhost:3000/api/webhooks/line \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{
    "destination": "U...",
    "events": [{
      "type": "message",
      "message": {
        "type": "text",
        "id": "test123",
        "text": "테스트 메시지"
      },
      "source": {
        "type": "user",
        "userId": "Utest123"
      },
      "replyToken": "test",
      "timestamp": 1234567890
    }]
  }'
```

### 5. DB 직접 확인
**Supabase SQL Editor**:

```sql
-- 1. 모든 대화 확인 (RLS 무시)
SELECT * FROM conversations;

-- 2. 모든 메시지 확인
SELECT * FROM messages;

-- 3. LINE 채널 확인
SELECT * FROM channel_accounts WHERE channel_type = 'line';

-- 4. 고객 확인
SELECT * FROM customers;

-- 5. RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'conversations';
```

## 해결 방법

### 방법 1: Vercel 환경변수 설정 후 Redeploy
가장 흔한 문제입니다. 로컬에서는 `.env.local`을 사용하지만, Vercel 배포 환경에서는 별도로 설정해야 합니다.

1. Vercel Dashboard → Settings → Environment Variables
2. 위 "필수 환경변수" 모두 추가
3. Production, Preview, Development 모두 체크
4. Deployments → Redeploy

### 방법 2: LINE Webhook 재검증
1. LINE Developers → Messaging API → Webhook settings
2. Webhook URL 다시 입력: `https://csflow.vercel.app/api/webhooks/line`
3. **Verify** 버튼 클릭
4. "Success" 확인

### 방법 3: 테스트 데이터 생성 (임시 해결책)
실제 webhook이 작동하지 않는다면, 일단 테스트 데이터로 시스템 동작 확인:

**Supabase SQL Editor에서 실행**:
```sql
-- 004_create_test_data.sql 파일 내용 (이전에 제공)
```

## 다음 단계

1. ✅ Vercel 환경변수 확인 및 설정
2. ✅ Redeploy 후 LINE 메시지 전송 테스트
3. ✅ Vercel Runtime Logs에서 오류 확인
4. ✅ 오류 발견 시 로그 복사하여 공유

---

**작성일**: 2026-01-30
**관련 파일**:
- `/web/src/app/api/webhooks/line/route.ts`
- `/web/src/lib/supabase/server.ts`
- `/supabase/migrations/001_initial_schema.sql`
