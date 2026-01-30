# 🚨 URGENT: Knowledge Base UI Fix Instructions

## Problem Identified

The knowledge base UI at https://csflow.vercel.app/knowledge shows no documents because **RLS (Row Level Security) policies are missing**.

### Root Cause Analysis:
✅ All 75 documents exist in Supabase (verified)
✅ User `afformation.ceo@gmail.com` exists with correct `tenant_ids` array (verified)
❌ **RLS policies only allow `service_role` access**
❌ **No policies exist for authenticated users to read `knowledge_documents` or `tenants` tables**

## Fix Required

You must run the SQL migration file manually in Supabase SQL Editor.

### Steps to Fix:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select project: `bfxtgqhollfkzawuzfwo`

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy and Run Migration**
   - Open file: `/Users/hyunkeunji/Desktop/csautomation/web/supabase/migrations/006_fix_knowledge_rls_policies.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "RUN" button

4. **Verify Success**
   - You should see output showing the created policies
   - Look for messages like:
     ```
     DROP POLICY
     CREATE POLICY
     CREATE POLICY
     ...
     ```

5. **Test Immediately**
   - Open https://csflow.vercel.app/knowledge
   - Login with: `afformation.ceo@gmail.com / afformation1!`
   - You should now see all 75 documents

## What This Migration Does

### Creates 3 sets of RLS policies:

1. **`tenants` table** - Allows users to view tenants in their `tenant_ids` array
2. **`knowledge_documents` table** - Allows users to view/create/update/delete documents for their tenants
3. **`knowledge_chunks` table** - Allows users to view embedding chunks for their documents

### Policy Logic:

All policies check:
```sql
EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND [tenant_id] = ANY(users.tenant_ids)
)
```

This ensures:
- User must be authenticated
- User must exist in `users` table
- The resource's `tenant_id` must be in user's `tenant_ids` array

## Expected Result

After running this migration:

✅ Knowledge base UI will display all 75 documents
✅ Documents properly organized by tenant
✅ User can create/edit/delete documents
✅ All RLS security maintained

## Current User Access

User `afformation.ceo@gmail.com` has:
- Auth ID: `f1b421d2-18c6-43e3-a56e-b62a504bb8ba`
- Role: `admin`
- tenant_ids: `["8d3bd24e-0d74-4dc7-aa34-3e39d5821244"]`

This grants access to tenant "CS Command Center" which contains all 75 documents.

## Migration File Location

```
/Users/hyunkeunji/Desktop/csautomation/web/supabase/migrations/006_fix_knowledge_rls_policies.sql
```

---

**IMPORTANT**: This must be run manually in Supabase SQL Editor. The Supabase client cannot execute DDL statements like CREATE POLICY.
