# RLS 정책 수정 가이드 (기존 데이터 접근 복구)

## 🚨 문제 상황

로그인 후 기존 데이터가 전부 보이지 않는 문제가 발생했습니다:
- chatdoc ceo와의 대화 목록 없음
- LINE 채널 연결 상태 없음
- 등록된 거래처(병원) 목록 없음

## 🔍 원인 분석

Supabase RLS(Row Level Security) 정책이 `users.tenant_ids` 배열로 데이터를 필터링하는데, `afformation.ceo@gmail.com` 사용자가:
1. `users` 테이블에 레코드가 없거나
2. `tenant_ids` 배열이 비어있음

따라서 모든 SELECT 쿼리가 RLS에 의해 필터링되어 빈 결과를 반환합니다.

## ✅ 해결 방법

### 단계 1: Supabase SQL Editor 접속

1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택: **bfxtgqhollfkzawuzfwo**
3. 좌측 메뉴에서 **SQL Editor** 클릭
4. 우측 상단 **New Query** 버튼 클릭

### 단계 2: SQL 마이그레이션 실행

아래 파일의 전체 내용을 복사하여 SQL Editor에 붙여넣고 **Run** 버튼을 클릭하세요:

**파일 경로**: `/web/supabase/migrations/003_fix_user_tenant_access.sql`

또는 아래 SQL을 직접 복사해도 됩니다:

```sql
-- Fix user access to existing data
-- User: afformation.ceo@gmail.com (f1b421d2-18c6-43e3-a56e-b62a504bb8ba)

DO $$
DECLARE
    all_tenant_ids UUID[];
    user_uuid UUID := 'f1b421d2-18c6-43e3-a56e-b62a504bb8ba';
BEGIN
    -- Get all tenant IDs
    SELECT array_agg(id) INTO all_tenant_ids FROM tenants;

    -- Check if user exists
    IF EXISTS (SELECT 1 FROM users WHERE id = user_uuid) THEN
        -- Update existing user
        UPDATE users
        SET tenant_ids = all_tenant_ids, role = 'admin', updated_at = NOW()
        WHERE id = user_uuid;
        RAISE NOTICE 'Updated existing user with % tenants', array_length(all_tenant_ids, 1);
    ELSE
        -- Insert new user
        INSERT INTO users (id, email, name, role, tenant_ids, is_active, created_at, updated_at)
        VALUES (user_uuid, 'afformation.ceo@gmail.com', 'CEO', 'admin', all_tenant_ids, true, NOW(), NOW());
        RAISE NOTICE 'Created new user with % tenants', array_length(all_tenant_ids, 1);
    END IF;
END $$;

-- Auto-add new tenants to admin users (trigger)
CREATE OR REPLACE FUNCTION add_tenant_to_admin_users()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET tenant_ids = array_append(tenant_ids, NEW.id), updated_at = NOW()
    WHERE role = 'admin' AND NOT (NEW.id = ANY(tenant_ids));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_tenant_to_admins ON tenants;
CREATE TRIGGER add_tenant_to_admins
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION add_tenant_to_admin_users();

-- Verify
SELECT email, role, array_length(tenant_ids, 1) as tenant_count, tenant_ids
FROM users WHERE id = 'f1b421d2-18c6-43e3-a56e-b62a504bb8ba';

SELECT id, name, display_name FROM tenants;
```

### 단계 3: 실행 결과 확인

SQL 실행 후 아래와 같은 결과가 출력되어야 합니다:

#### 1. 알림 메시지 (NOTICE)
```
NOTICE: Created new user with 3 tenants
```
또는
```
NOTICE: Updated existing user with 3 tenants
```

#### 2. 사용자 정보 테이블
| email | role | tenant_count | tenant_ids |
|-------|------|--------------|------------|
| afformation.ceo@gmail.com | admin | 3 | {8d3bd24e-..., ...} |

#### 3. 거래처 목록 테이블
| id | name | display_name |
|----|------|--------------|
| 8d3bd24e-... | default-tenant | 기본 거래처 |
| ... | ... | ... |

### 단계 4: 로그인 테스트

1. https://csflow.vercel.app/login 접속
2. 이메일: `afformation.ceo@gmail.com`
3. 비밀번호: `afformation1!`
4. "로그인" 버튼 클릭
5. 대시보드로 리다이렉트 확인

### 단계 5: 데이터 확인

로그인 후 아래 항목들이 모두 정상적으로 보여야 합니다:
- ✅ 인박스 페이지에서 chatdoc ceo와의 대화 목록
- ✅ 채널 관리 페이지에서 LINE 연결 상태
- ✅ 거래처 관리 페이지에서 등록된 병원 목록
- ✅ 모든 메뉴 및 기능 정상 작동

## 🔧 작동 원리

### 1. users 테이블에 레코드 생성
```sql
INSERT INTO users (
    id,                 -- f1b421d2-18c6-43e3-a56e-b62a504bb8ba
    email,              -- afformation.ceo@gmail.com
    role,               -- admin
    tenant_ids,         -- [모든 거래처 ID]
    ...
)
```

### 2. RLS 정책 작동 방식
```sql
-- conversations 테이블 예시
CREATE POLICY "Users can view conversations" ON conversations
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );
```

이 정책은:
1. 현재 로그인한 사용자(`auth.uid()`)를 users 테이블에서 조회
2. 해당 사용자의 `tenant_ids` 배열을 가져옴
3. `tenant_id`가 배열에 포함된 대화만 SELECT 허용

### 3. 향후 새 거래처 자동 추가
트리거가 설정되어 있어, 새 거래처 추가 시 자동으로 admin 역할 사용자에게 할당됩니다.

## ❓ 문제 해결

### Q1: SQL 실행 시 "relation 'users' does not exist" 에러
**원인**: users 테이블이 생성되지 않음
**해결**:
1. `/web/supabase/migrations/001_initial_schema.sql` 먼저 실행
2. 그 다음 `003_fix_user_tenant_access.sql` 실행

### Q2: SQL 실행 후에도 데이터가 안 보임
**확인 사항**:
1. SQL 실행 결과에서 tenant_count가 0보다 큰지 확인
2. Supabase Auth 세션 초기화: 로그아웃 후 다시 로그인
3. 브라우저 캐시 및 쿠키 삭제 후 재시도

### Q3: "array_length(all_tenant_ids, 1)" 결과가 NULL
**원인**: tenants 테이블이 비어있음 (거래처가 하나도 없음)
**해결**: 먼저 채널 추가 UI에서 채널을 등록하면 자동으로 default tenant가 생성됩니다.

## 📝 참고 문서

- Supabase RLS 정책: `/supabase/migrations/001_initial_schema.sql` (라인 435~549)
- 사용자 테이블 스키마: `/supabase/migrations/001_initial_schema.sql` (라인 230~244)
- claude2.md: 전체 인증 시스템 구축 과정

## 🎯 다음 단계

SQL 실행 후 모든 데이터가 정상적으로 보인다면:
1. ✅ Week 1 (인증 시스템) 완료
2. ➡️ Week 2 (LLM/RAG 파이프라인 고도화) 진행

---

**작성일**: 2026-01-30
**작성자**: Claude Code
**관련 커밋**: ec7adf5
