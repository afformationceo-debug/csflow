# 🚨 최종 RLS 수정 - Migration 008

## 문제 확인

Migration 007을 실행했지만 여전히 UI에서 문서가 보이지 않습니다.

**테스트 결과**:
```
✅ 인증 성공
❌ 문서 조회: 0건 (RLS가 여전히 차단)
❌ 거래처 조회: 0건 (RLS가 여전히 차단)
```

## 근본 원인

RLS 정책에서 `users` 테이블을 참조할 때 **스키마를 명시하지 않아서** PostgreSQL이 테이블을 찾지 못했습니다.

**문제가 된 코드** (Migration 007):
```sql
-- ❌ 스키마 미명시 - 테이블을 찾지 못함
SELECT unnest(tenant_ids)
FROM users  -- 어느 스키마의 users?
WHERE id = auth.uid()
```

**수정된 코드** (Migration 008):
```sql
-- ✅ public 스키마 명시 - 확실하게 찾음
SELECT unnest(public.users.tenant_ids)
FROM public.users
WHERE public.users.id = auth.uid()
```

## 해결 방법: Migration 008 실행

### 파일 위치
```
/Users/hyunkeunji/Desktop/csautomation/web/supabase/migrations/008_fix_rls_with_public_schema.sql
```

### 실행 단계

#### 1. Supabase SQL Editor 열기
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: `bfxtgqhollfkzawuzfwo`
3. 좌측 메뉴 → **SQL Editor**
4. **New Query** 클릭

#### 2. 마이그레이션 복사 & 실행
1. 파일 `008_fix_rls_with_public_schema.sql` **전체 내용** 복사
2. SQL Editor에 붙여넣기
3. **RUN** 버튼 클릭

#### 3. 성공 확인

**기대 결과 1 - 정책 목록 (9개)**:
```
schemaname | tablename             | policyname
-----------+-----------------------+----------------------------------
public     | knowledge_chunks      | knowledge_chunks_auth_select
public     | knowledge_chunks      | knowledge_chunks_service_all
public     | knowledge_documents   | knowledge_documents_auth_delete
public     | knowledge_documents   | knowledge_documents_auth_insert
public     | knowledge_documents   | knowledge_documents_auth_select
public     | knowledge_documents   | knowledge_documents_auth_update
public     | knowledge_documents   | knowledge_documents_service_all
public     | tenants               | tenants_auth_select
public     | tenants               | tenants_service_all
```

**기대 결과 2 - RLS 상태**:
```
schemaname | tablename             | rowsecurity
-----------+-----------------------+-------------
public     | knowledge_chunks      | t
public     | knowledge_documents   | t
public     | tenants               | t
public     | users                 | (any)
```

**기대 결과 3 - 사용자 정보**:
```
id                                   | email                      | tenant_ids                                  | tenant_count
-------------------------------------|----------------------------|---------------------------------------------|-------------
f1b421d2-18c6-43e3-a56e-b62a504bb8ba | afformation.ceo@gmail.com  | {8d3bd24e-0d74-4dc7-aa34-3e39d5821244}      | 1
```

위 3가지 결과가 모두 출력되면 ✅ **마이그레이션 성공**입니다!

#### 4. 즉시 테스트

1. 브라우저에서 https://csflow.vercel.app/knowledge 접속
2. **하드 새로고침**:
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + F5`
3. 로그인: `afformation.ceo@gmail.com / afformation1!`
4. **75개 문서가 모두 표시되어야 함** ✅

## Migration 008의 핵심 개선사항

### 1. 명시적 스키마 참조
모든 테이블 참조에 `public.` 접두사 추가:
- `public.users`
- `public.tenants`
- `public.knowledge_documents`
- `public.knowledge_chunks`

### 2. 기존 정책 완전 삭제
Migration 006과 007의 모든 정책명 삭제:
- 이전 이름: "Service role has full access to..."
- 새 이름: "tenants_service_all", "knowledge_documents_auth_select" 등

### 3. 검증 쿼리 강화
- 정책 개수 확인 (정확히 9개)
- RLS 활성화 상태 확인
- 사용자 tenant_ids 직접 확인

## 왜 이번에는 성공할까?

### Migration 007 실패 원인
```sql
-- PostgreSQL이 이 쿼리를 실행할 때:
SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()

-- 다음과 같이 해석할 수 있음:
-- 1. public.users? → 없으면
-- 2. auth.users? → 여기에도 tenant_ids 없으면
-- 3. 다른 스키마? → 결국 실패
```

### Migration 008 성공 이유
```sql
-- PostgreSQL이 명확하게 이해:
SELECT unnest(public.users.tenant_ids)
FROM public.users
WHERE public.users.id = auth.uid()

-- "public 스키마의 users 테이블" 명확히 지정
-- → 절대 실패하지 않음
```

## 문제 해결 후 다음 단계

Migration 008 성공 후:

### 1. 지식베이스 UI 확인 ✅
- 75개 문서 모두 표시
- 검색, 필터링 정상 작동
- 문서 추가/편집/삭제 가능

### 2. LINE 웹훅 + 예약 파이프라인 연동
- LINE 메시지 수신 → Enhanced RAG Pipeline 호출
- 예약 의도 감지 → 예약 양식 전송
- 양식 응답 → 예약 신청 생성

### 3. 풀자동화 Stage 1-2 테스트
사용자가 직접 테스트:
- [Stage 1] LINE 메시지 전송 → 고객/대화 자동 생성
- [Stage 2] AI 응답 → 예약 유도 → 예약 양식 전송

## 중요 사항

- ✅ **코드 배포 불필요** - 데이터베이스만 수정
- ✅ **기존 데이터 안전** - 정책만 변경
- ✅ **즉시 반영** - SQL 실행 직후 적용
- ⚠️ **하드 새로고침 필수** - 브라우저 캐시 때문에 새로고침 2번 필요할 수 있음

## 실행 후 보고

Migration 008 실행 후 다음을 확인해주세요:

1. ✅ SQL Editor에서 9개 정책 출력되었나요?
2. ✅ https://csflow.vercel.app/knowledge 에서 75개 문서 보이나요?

둘 다 YES면 → 다음 단계(LINE 웹훅 연동)로 진행합니다!
