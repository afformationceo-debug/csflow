-- Message Templates Table
-- Stores reusable message templates for various scenarios

-- ============================================
-- Prerequisite: Users table (if not exists)
-- ============================================
-- This migration requires the users table.
-- If you ran /web/supabase/schema.sql instead of 001_initial_schema.sql,
-- the users table may not exist yet. Create it here as a fallback.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'agent', -- 'admin', 'manager', 'agent'
      tenant_ids UUID[] DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Enable RLS for users
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;

    -- Service role full access
    CREATE POLICY "Service role has full access to users"
      ON users FOR ALL
      USING (auth.role() = 'service_role');

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_tenant_ids ON users USING GIN(tenant_ids);

    -- Updated_at trigger
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    RAISE NOTICE 'Created users table (was missing from initial schema)';
  END IF;
END
$$;

-- ============================================
-- Message Templates
-- ============================================
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('greeting', 'faq', 'booking', 'reminder', 'followup', 'promotion', 'notification', 'closing')),
  description TEXT,

  -- Content
  content TEXT NOT NULL,
  content_translations JSONB DEFAULT '{}',  -- { "JA": "...", "EN": "...", "ZH": "..." }
  variables TEXT[] DEFAULT '{}',            -- ["customerName", "bookingDate", ...]

  -- Channel-specific configurations
  channel_configs JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "whatsapp": { "enabled": true, "templateId": "waba_template_123" },
  --   "kakao": { "enabled": true, "templateId": "kakao_template_456" },
  --   "line": { "enabled": true, "quickReplies": [...] }
  -- }

  -- Status and usage
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant ON message_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_status ON message_templates(status);
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant_category ON message_templates(tenant_id, category) WHERE status = 'active';

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role has full access to message_templates"
  ON message_templates FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies (user-level access)
DO $$
BEGIN
  -- Only create user-level RLS policies if auth schema exists (Supabase environment)
  IF EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'auth'
  ) THEN
    CREATE POLICY "Users can view templates for their tenants"
      ON message_templates FOR SELECT
      USING (
        tenant_id IN (
          SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
      );

    CREATE POLICY "Managers can create templates"
      ON message_templates FOR INSERT
      WITH CHECK (
        tenant_id IN (
          SELECT unnest(tenant_ids) FROM users
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Managers can update templates"
      ON message_templates FOR UPDATE
      USING (
        tenant_id IN (
          SELECT unnest(tenant_ids) FROM users
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
      );

    CREATE POLICY "Admins can delete templates"
      ON message_templates FOR DELETE
      USING (
        tenant_id IN (
          SELECT unnest(tenant_ids) FROM users
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END
$$;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE message_templates
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- OAuth Sessions Table (for channel connection flow)
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- 'meta', 'line', 'kakao', etc.
  state VARCHAR(255) NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_type VARCHAR(50),
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at);

-- Enable RLS
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role has full access to oauth_sessions"
  ON oauth_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger for message_templates
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
