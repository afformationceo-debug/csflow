# 근본적인 문제 해결 방안 (Fundamental Bug Fixes)

## 발견된 근본 원인 (Root Causes)

### Problem 1: Missing Escalation (에스컬레이션 누락)
**증상**: "My cheeks are a bit sagging..." 메시지 신뢰도 10% (< 75% 임계값) 인데도 에스컬레이션 안되고 AI가 응답함

**근본 원인**:
1. RAG 파이프라인이 `shouldEscalate: true` 반환
2. 하지만 LINE webhook이 **응답을 먼저 보낸 후** 에스컬레이션 체크함
3. `/api/webhooks/line/route.ts` lines 378-408: escalation 생성 로직이 AI 응답 발송과 **동시에** 실행됨
4. 에스컬레이션 체크가 **너무 늦음** - AI가 이미 응답 발송한 후에 escalation 생성

**수정 방법**:
- RAG 파이프라인 결과를 **먼저** 확인
- `shouldEscalate: true`면 **즉시** 에스컬레이션 생성하고 return (AI 응답 발송 안함)
- `shouldEscalate: false`일 때만 AI 응답 발송

### Problem 2: Auto-scroll Issue (자동 스크롤 문제)
**증상**: 인박스에서 대화 위로 스크롤하면 자동으로 다시 밑으로 내려감

**근본 원인**:
- `/inbox/page.tsx` lines 1254-1262: `useEffect` with `dbMessages` dependency
- `dbMessages`가 2초마다 폴링으로 업데이트됨 (line 864-866)
- 메시지 변경될 때마다 `scrollToBottom("instant")` 실행
- 사용자가 위로 스크롤해도 2초마다 강제로 하단 이동

**수정 방법**:
- 스크롤 자동 이동을 **새 메시지가 실제로 추가됐을 때만** 실행
- 사용자가 수동으로 스크롤 중이면 자동 스크롤 **비활성화**
- 이전 메시지 길이와 비교하여 실제 추가된 경우만 스크롤

### Problem 3: Duplicate AI Responses (중복 AI 응답)
**증상**: 같은 고객 메시지에 AI가 2번 응답 (08:23, 08:37)

**근본 원인**:
- `/api/webhooks/line/route.ts` lines 347-363: 중복 방지 체크
- LINE이 webhook을 2번 호출 (재전송 또는 재연결 시)
- 두 webhook이 **동시에** 중복 체크 통과 (AI 응답 저장 전)
- **Race Condition**: 둘 다 "AI 응답 없음" 확인 후 둘 다 응답 발송
- 타임스탬프 기반 체크는 정확하지만 **동시 실행 방지 안됨**

**수정 방법**:
- **Idempotency Key** 사용: 메시지 ID를 키로 Redis에 lock 설정
- 첫 webhook만 통과, 두번째는 즉시 return
- Lock TTL: 5분 (충분히 긴 시간)
- Upstash Redis에 `processing:{conversation_id}:{message_id}` 키 생성

---

## 수정 파일 목록

1. `/api/webhooks/line/route.ts` - Problem 1, 3 수정
2. `/inbox/page.tsx` - Problem 2 수정
3. `/lib/upstash/redis.ts` - Lock 헬퍼 함수 추가 (Problem 3)
