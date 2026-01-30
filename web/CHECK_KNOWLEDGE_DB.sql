-- 지식베이스 DB 상태 전체 진단 SQL

-- ==========================================
-- 1. 지식베이스 문서 개수 확인
-- ==========================================
SELECT
  '지식베이스 문서' as check_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count,
  tenant_id
FROM knowledge_documents
GROUP BY tenant_id
ORDER BY total_count DESC;

-- ==========================================
-- 2. 거래처(tenant) 목록 확인
-- ==========================================
SELECT
  'Tenants' as check_type,
  id,
  name,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 10;

-- ==========================================
-- 3. RLS 정책 확인 (knowledge_documents)
-- ==========================================
SELECT
  'RLS 정책' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'knowledge_documents'
ORDER BY policyname;

-- ==========================================
-- 4. Users 테이블 확인 (RLS 권한 체크)
-- ==========================================
SELECT
  'Users' as check_type,
  id,
  email,
  role,
  tenant_ids,
  array_length(tenant_ids, 1) as tenant_count
FROM public.users
WHERE email = 'afformation.ceo@gmail.com';

-- ==========================================
-- 5. 특정 tenant의 지식베이스 문서 샘플 확인
-- ==========================================
SELECT
  'Sample Documents' as check_type,
  id,
  tenant_id,
  title,
  category,
  is_active,
  created_at
FROM knowledge_documents
WHERE tenant_id = '8d3bd24e-0d74-4dc7-aa34-3e39d5821244'
ORDER BY created_at DESC
LIMIT 10;

-- ==========================================
-- 6. RLS가 활성화되어 있는지 확인
-- ==========================================
SELECT
  'RLS 활성화 상태' as check_type,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('knowledge_documents', 'tenants', 'users')
  AND schemaname = 'public';

-- ==========================================
-- 7. 실제 API 쿼리 시뮬레이션 (SERVICE ROLE)
-- ==========================================
-- Service Role로 실행하면 RLS를 우회하므로 모든 데이터가 보임
SELECT
  'Service Role 쿼리' as check_type,
  COUNT(*) as total_count
FROM knowledge_documents
WHERE tenant_id = '8d3bd24e-0d74-4dc7-aa34-3e39d5821244';

-- ==========================================
-- 8. 실제 사용자 권한으로 쿼리 시뮬레이션
-- ==========================================
-- 이 쿼리는 RLS 정책이 적용되므로,
-- afformation.ceo@gmail.com 사용자가 볼 수 있는 데이터만 반환됨
--
-- 주의: 이 쿼리는 Supabase SQL Editor에서는 Service Role로 실행되므로
-- 실제 사용자 권한을 테스트하려면 애플리케이션에서 확인해야 함

-- ==========================================
-- 9. Migration 008이 제대로 실행되었는지 확인
-- ==========================================
SELECT
  'Migration 008 검증' as check_type,
  policyname,
  definition
FROM pg_policies
WHERE tablename = 'knowledge_documents'
  AND definition LIKE '%public.users%';

-- ==========================================
-- 실행 방법
-- ==========================================
-- 1. Supabase Dashboard 접속 (https://supabase.com/dashboard)
-- 2. 프로젝트 선택 (bfxtgqhollfkzawuzfwo)
-- 3. 좌측 메뉴 > SQL Editor
-- 4. New Query 클릭
-- 5. 이 파일 내용 전체 복사 & 붙여넣기
-- 6. Run 버튼 클릭
-- 7. 9개 결과 테이블이 차례로 출력됨

-- ==========================================
-- 기대 결과
-- ==========================================
-- 1. 지식베이스 문서: 75개 (또는 유사한 숫자)
-- 2. Tenants: 1개 이상
-- 3. RLS 정책: 여러 개 (migration 008의 정책들)
-- 4. Users: afformation.ceo@gmail.com 존재, tenant_ids 배열 포함
-- 5. Sample Documents: 10개 문서 샘플
-- 6. RLS 활성화: knowledge_documents = true
-- 7. Service Role 쿼리: 75개
-- 8. Migration 008 검증: public.users 포함된 정책 있음
