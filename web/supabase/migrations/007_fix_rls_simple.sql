-- Simplified RLS fix for knowledge base UI
-- Using a more direct approach that avoids potential schema issues

-- ==========================================
-- STEP 1: Disable RLS temporarily to clean up
-- ==========================================
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 2: Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Service role has full access to tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON tenants;

DROP POLICY IF EXISTS "Service role has full access to knowledge_documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can view knowledge_documents for their tenants" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can insert knowledge_documents for their tenants" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can update knowledge_documents for their tenants" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can delete knowledge_documents for their tenants" ON knowledge_documents;

DROP POLICY IF EXISTS "Service role has full access to knowledge_chunks" ON knowledge_chunks;
DROP POLICY IF EXISTS "Users can view knowledge_chunks for their tenants" ON knowledge_chunks;

-- ==========================================
-- STEP 3: Re-enable RLS
-- ==========================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 4: Create SIMPLIFIED policies
-- ==========================================

-- TENANTS: Service role gets everything
CREATE POLICY "tenants_service_all"
ON tenants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- TENANTS: Authenticated users can SELECT their tenants
CREATE POLICY "tenants_auth_select"
ON tenants
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT unnest(tenant_ids)
    FROM users
    WHERE id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Service role gets everything
CREATE POLICY "knowledge_documents_service_all"
ON knowledge_documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- KNOWLEDGE_DOCUMENTS: Authenticated users can SELECT documents for their tenants
CREATE POLICY "knowledge_documents_auth_select"
ON knowledge_documents
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT unnest(tenant_ids)
    FROM users
    WHERE id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Authenticated users can INSERT documents for their tenants
CREATE POLICY "knowledge_documents_auth_insert"
ON knowledge_documents
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT unnest(tenant_ids)
    FROM users
    WHERE id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Authenticated users can UPDATE documents for their tenants
CREATE POLICY "knowledge_documents_auth_update"
ON knowledge_documents
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT unnest(tenant_ids)
    FROM users
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT unnest(tenant_ids)
    FROM users
    WHERE id = auth.uid()
  )
);

-- KNOWLEDGE_DOCUMENTS: Authenticated users can DELETE documents for their tenants
CREATE POLICY "knowledge_documents_auth_delete"
ON knowledge_documents
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT unnest(tenant_ids)
    FROM users
    WHERE id = auth.uid()
  )
);

-- KNOWLEDGE_CHUNKS: Service role gets everything
CREATE POLICY "knowledge_chunks_service_all"
ON knowledge_chunks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- KNOWLEDGE_CHUNKS: Authenticated users can SELECT chunks for documents they have access to
CREATE POLICY "knowledge_chunks_auth_select"
ON knowledge_chunks
FOR SELECT
TO authenticated
USING (
  document_id IN (
    SELECT kd.id
    FROM knowledge_documents kd
    WHERE kd.tenant_id IN (
      SELECT unnest(tenant_ids)
      FROM users
      WHERE id = auth.uid()
    )
  )
);

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Show all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('tenants', 'knowledge_documents', 'knowledge_chunks')
ORDER BY tablename, policyname;

-- Show RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('tenants', 'knowledge_documents', 'knowledge_chunks', 'users')
ORDER BY tablename;
