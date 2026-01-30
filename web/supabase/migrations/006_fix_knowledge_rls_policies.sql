-- Fix RLS policies for knowledge base UI
-- Problem: knowledge_documents and tenants tables only have service_role policies
-- Solution: Add authenticated user policies that check tenant_ids array

-- ==========================================
-- TENANTS TABLE
-- ==========================================

-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Service role has full access to tenants" ON tenants;

-- Create new policies for tenants table
CREATE POLICY "Service role has full access to tenants"
ON tenants FOR ALL
TO service_role
USING (true);

CREATE POLICY "Users can view tenants they belong to"
ON tenants FOR SELECT
TO authenticated
USING (
  -- User must exist in users table with this tenant in their tenant_ids array
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND tenants.id = ANY(users.tenant_ids)
  )
);

-- ==========================================
-- KNOWLEDGE_DOCUMENTS TABLE
-- ==========================================

-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Service role has full access to knowledge_documents" ON knowledge_documents;

-- Create new policies for knowledge_documents table
CREATE POLICY "Service role has full access to knowledge_documents"
ON knowledge_documents FOR ALL
TO service_role
USING (true);

CREATE POLICY "Users can view knowledge_documents for their tenants"
ON knowledge_documents FOR SELECT
TO authenticated
USING (
  -- User must exist in users table with this document's tenant in their tenant_ids array
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND knowledge_documents.tenant_id = ANY(users.tenant_ids)
  )
);

CREATE POLICY "Users can insert knowledge_documents for their tenants"
ON knowledge_documents FOR INSERT
TO authenticated
WITH CHECK (
  -- User must exist in users table with this document's tenant in their tenant_ids array
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND knowledge_documents.tenant_id = ANY(users.tenant_ids)
  )
);

CREATE POLICY "Users can update knowledge_documents for their tenants"
ON knowledge_documents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND knowledge_documents.tenant_id = ANY(users.tenant_ids)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND knowledge_documents.tenant_id = ANY(users.tenant_ids)
  )
);

CREATE POLICY "Users can delete knowledge_documents for their tenants"
ON knowledge_documents FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND knowledge_documents.tenant_id = ANY(users.tenant_ids)
  )
);

-- ==========================================
-- KNOWLEDGE_CHUNKS TABLE
-- ==========================================

-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Service role has full access to knowledge_chunks" ON knowledge_chunks;

-- Create new policies for knowledge_chunks table
CREATE POLICY "Service role has full access to knowledge_chunks"
ON knowledge_chunks FOR ALL
TO service_role
USING (true);

CREATE POLICY "Users can view knowledge_chunks for their tenants"
ON knowledge_chunks FOR SELECT
TO authenticated
USING (
  -- Join through knowledge_documents to check tenant access
  EXISTS (
    SELECT 1 FROM knowledge_documents kd
    JOIN users u ON u.id = auth.uid()
    WHERE kd.id = knowledge_chunks.document_id
    AND kd.tenant_id = ANY(u.tenant_ids)
  )
);

-- ==========================================
-- VERIFY THE POLICIES
-- ==========================================

-- Show all policies for these tables
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
