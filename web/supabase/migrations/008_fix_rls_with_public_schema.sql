-- Final RLS fix with explicit public schema reference
-- This ensures the policies can find the users table

-- ==========================================
-- STEP 1: Clean slate - disable RLS and drop all policies
-- ==========================================
ALTER TABLE IF EXISTS public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_chunks DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_service_all" ON public.tenants;
DROP POLICY IF EXISTS "tenants_auth_select" ON public.tenants;
DROP POLICY IF EXISTS "knowledge_documents_service_all" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_auth_select" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_auth_insert" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_auth_update" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_auth_delete" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_chunks_service_all" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "knowledge_chunks_auth_select" ON public.knowledge_chunks;

-- Also drop old policy names from migration 006
DROP POLICY IF EXISTS "Service role has full access to tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON public.tenants;
DROP POLICY IF EXISTS "Service role has full access to knowledge_documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can view knowledge_documents for their tenants" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can insert knowledge_documents for their tenants" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can update knowledge_documents for their tenants" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can delete knowledge_documents for their tenants" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Service role has full access to knowledge_chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can view knowledge_chunks for their tenants" ON public.knowledge_chunks;

-- ==========================================
-- STEP 2: Re-enable RLS
-- ==========================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 3: Create policies with EXPLICIT public schema
-- ==========================================

-- TENANTS: Service role
CREATE POLICY "tenants_service_all"
ON public.tenants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- TENANTS: Authenticated users
-- Use explicit public.users table reference
CREATE POLICY "tenants_auth_select"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT unnest(public.users.tenant_ids)
    FROM public.users
    WHERE public.users.id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Service role
CREATE POLICY "knowledge_documents_service_all"
ON public.knowledge_documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- KNOWLEDGE_DOCUMENTS: Authenticated SELECT
CREATE POLICY "knowledge_documents_auth_select"
ON public.knowledge_documents
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT unnest(public.users.tenant_ids)
    FROM public.users
    WHERE public.users.id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Authenticated INSERT
CREATE POLICY "knowledge_documents_auth_insert"
ON public.knowledge_documents
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT unnest(public.users.tenant_ids)
    FROM public.users
    WHERE public.users.id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Authenticated UPDATE
CREATE POLICY "knowledge_documents_auth_update"
ON public.knowledge_documents
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT unnest(public.users.tenant_ids)
    FROM public.users
    WHERE public.users.id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT unnest(public.users.tenant_ids)
    FROM public.users
    WHERE public.users.id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Authenticated DELETE
CREATE POLICY "knowledge_documents_auth_delete"
ON public.knowledge_documents
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT unnest(public.users.tenant_ids)
    FROM public.users
    WHERE public.users.id = auth.uid()
  )
);

-- KNOWLEDGE_CHUNKS: Service role
CREATE POLICY "knowledge_chunks_service_all"
ON public.knowledge_chunks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- KNOWLEDGE_CHUNKS: Authenticated SELECT
CREATE POLICY "knowledge_chunks_auth_select"
ON public.knowledge_chunks
FOR SELECT
TO authenticated
USING (
  document_id IN (
    SELECT kd.id
    FROM public.knowledge_documents kd
    WHERE kd.tenant_id IN (
      SELECT unnest(public.users.tenant_ids)
      FROM public.users
      WHERE public.users.id = auth.uid()
    )
  )
);

-- ==========================================
-- VERIFICATION - Must show 9 policies
-- ==========================================

-- Show all policies (should be 9 total)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'knowledge_documents', 'knowledge_chunks')
ORDER BY tablename, policyname;

-- Show RLS status (all should be 't')
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'knowledge_documents', 'knowledge_chunks', 'users')
ORDER BY tablename;

-- Test query: Show user's tenant_ids (should show the array)
SELECT
  id,
  email,
  tenant_ids,
  array_length(tenant_ids, 1) as tenant_count
FROM public.users
WHERE email = 'afformation.ceo@gmail.com';

-- Expected results:
-- 1. 9 policies listed (3 for tenants, 5 for knowledge_documents, 1 for knowledge_chunks)
-- 2. rowsecurity = 't' for tenants, knowledge_documents, knowledge_chunks
-- 3. User record shows tenant_ids array with 1 element
