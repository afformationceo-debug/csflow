# 지식베이스 표시 안 됨 - 디버깅 가이드

## 현재 상황

**보고된 문제**: 배포 후 하드 새로고침했는데도 지식베이스가 표시되지 않음

**완료된 수정사항**:
1. ✅ Migration 008 실행 완료 (RLS 정책 수정)
2. ✅ Frontend tenant_id 이슈 수정 (commit 2e433e6)
3. ✅ Middleware API 401 수정 (commit 61a9c22)
4. ✅ GitHub 푸시 완료

## 즉시 확인할 사항 (우선순위 순)

### 1단계: 브라우저 개발자 도구로 실제 API 요청 확인

1. https://csflow.vercel.app/knowledge 접속
2. **F12** 키를 눌러 개발자 도구 열기
3. **Network** 탭 선택
4. **Disable cache** 체크박스 활성화
5. **Cmd + Shift + R** (Mac) 또는 **Ctrl + Shift + F5** (Windows)로 하드 새로고침
6. Network 탭에서 `knowledge_documents` 요청 찾기

### 예상되는 시나리오와 해결 방법

#### 시나리오 A: `tenant_id=eq.none` 오류가 여전히 나옴
```
GET .../knowledge_documents?select=*&tenant_id=eq.none&... 400 (Bad Request)
```

**원인**: Vercel 배포가 완료되지 않았거나 브라우저 캐시 문제

**해결 방법**:
1. Vercel 대시보드 확인: https://vercel.com/dashboard
2. 최신 배포 상태가 ✅ Ready (녹색)인지 확인
3. 배포 완료 시간과 현재 시간 비교
4. 브라우저 캐시 완전 삭제:
   - Chrome: 설정 → 개인정보 및 보안 → 인터넷 사용 기록 삭제
   - 또는 **시크릿 모드**에서 다시 접속

#### 시나리오 B: 401 Unauthorized 오류
```
GET .../knowledge_documents?select=*&tenant_id=eq.8d3bd24e-... 401 (Unauthorized)
```

**원인**: 인증 쿠키가 만료되었거나 로그인이 필요함

**해결 방법**:
1. 로그아웃 후 다시 로그인
2. 이메일: `afformation.ceo@gmail.com`
3. 비밀번호: `afformation1!`
4. 로그인 후 다시 /knowledge 접속

#### 시나리오 C: 200 OK이지만 빈 배열 반환
```
GET .../knowledge_documents?select=*&tenant_id=eq.8d3bd24e-... 200 (OK)
Response: []
```

**원인**: RLS 정책이 데이터를 필터링하고 있음 (DB 문제)

**해결 방법**: `CHECK_KNOWLEDGE_DB.sql` 실행하여 DB 상태 확인

#### 시나리오 D: 200 OK + 75개 문서 반환됨
```
GET .../knowledge_documents?select=*&tenant_id=eq.8d3bd24e-... 200 (OK)
Response: [{ id: "...", title: "...", ... }, ...] (75개 항목)
```

**원인**: API는 정상이지만 React 렌더링 문제

**해결 방법**: Console 탭에서 JavaScript 오류 확인

### 2단계: Console 탭에서 JavaScript 오류 확인

1. 개발자 도구에서 **Console** 탭 선택
2. 빨간색 오류 메시지 확인
3. 특히 다음 오류들 체크:
   - `Cannot read property '...' of undefined`
   - `Unexpected token`
   - `Failed to load resource`

### 3단계: Application 탭에서 인증 쿠키 확인

1. 개발자 도구에서 **Application** 탭 선택
2. 좌측 메뉴에서 **Cookies** → `https://csflow.vercel.app` 선택
3. 다음 쿠키들이 있는지 확인:
   - `sb-<project-id>-auth-token`
   - `sb-<project-id>-auth-token-code-verifier`

**쿠키가 없으면**: 로그아웃 후 재로그인 필요

## DB 상태 확인 (마지막 단계)

위 1-3단계에서 문제를 찾지 못했다면, DB 상태를 확인해야 합니다.

### Supabase SQL Editor에서 실행:

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: `bfxtgqhollfkzawuzfwo`
3. 좌측 메뉴 → **SQL Editor**
4. **New Query** 클릭
5. 아래 SQL 전체 복사 & 붙여넣기 후 **Run** 클릭

```sql
-- 1. 지식베이스 문서 개수 확인
SELECT COUNT(*) as total_documents, tenant_id
FROM knowledge_documents
GROUP BY tenant_id;

-- 2. 사용자 권한 확인
SELECT id, email, tenant_ids
FROM public.users
WHERE email = 'afformation.ceo@gmail.com';

-- 3. RLS 정책 확인
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'knowledge_documents'
  AND definition LIKE '%public.users%';

-- 4. 실제 문서 샘플 조회
SELECT id, title, category, tenant_id, is_active
FROM knowledge_documents
WHERE tenant_id = '8d3bd24e-0d74-4dc7-aa34-3e39d5821244'
ORDER BY created_at DESC
LIMIT 10;
```

### 기대 결과:

1. **Query 1**: 75개 문서 (tenant_id: `8d3bd24e-0d74-4dc7-aa34-3e39d5821244`)
2. **Query 2**: 사용자 존재, `tenant_ids` 배열에 해당 tenant_id 포함
3. **Query 3**: RLS 정책에 `public.users` 포함 확인
4. **Query 4**: 10개 문서 샘플 조회됨

**Query 1에서 0개 반환 시**: 지식베이스에 문서가 없음 → 문서 업로드 필요
**Query 2에서 사용자 없음 시**: 사용자 등록 필요
**Query 2에서 tenant_ids 비어있음 시**: 사용자에게 tenant 권한 부여 필요
**Query 3에서 정책 없음 시**: Migration 008 재실행 필요
**Query 4에서 0개 반환 시**: RLS 정책이 데이터를 차단하고 있음

## 빠른 해결 체크리스트

**5분 안에 해결하기**:

1. ☐ Vercel 대시보드에서 최신 배포 ✅ Ready 확인
2. ☐ 시크릿 모드에서 csflow.vercel.app/knowledge 접속
3. ☐ 로그인: afformation.ceo@gmail.com / afformation1!
4. ☐ F12 → Network 탭 → 새로고침 → `knowledge_documents` 요청 확인
5. ☐ 응답 코드 확인:
   - **400**: Frontend 문제 (tenant_id=eq.none) → Vercel 배포 재확인
   - **401**: 인증 문제 → 재로그인
   - **200 + 빈 배열**: DB RLS 문제 → SQL 실행
   - **200 + 75개 문서**: React 렌더링 문제 → Console 오류 확인

## 최종 수단: 완전 초기화

모든 방법이 실패했다면:

1. **모든 브라우저 캐시 삭제**
2. **모든 쿠키 삭제** (Application 탭에서)
3. **브라우저 완전 종료 후 재시작**
4. **시크릿 모드에서 접속**
5. **다른 브라우저에서 테스트** (Chrome → Firefox)

## 다음 단계

지식베이스가 정상 표시되면:

✅ **풀자동화 Stage 1-2 테스트 진행**
- LINE 메시지 전송 → 고객/대화 자동 생성 확인
- AI RAG 응답 → 예약 의도 감지 → 예약 양식 전송 확인

자세한 내용은 `FULL_AUTOMATION_CHECKLIST.md` 참고
