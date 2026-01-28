-- Phase 4: Advanced Features Schema
-- Run this after the main schema.sql

-- ============================================
-- Audit Logs
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, error, critical
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================
-- SLA Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS sla_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    targets JSONB NOT NULL DEFAULT '{
        "firstResponseTime": {"target": 5, "warning": 3},
        "resolutionTime": {"target": 240, "warning": 120},
        "aiResponseRate": {"target": 80, "warning": 70},
        "customerSatisfaction": {"target": 4.0, "warning": 3.5},
        "escalationRate": {"target": 20, "warning": 30}
    }',
    business_hours JSONB NOT NULL DEFAULT '{
        "timezone": "Asia/Seoul",
        "schedule": {},
        "holidays": []
    }',
    escalation_policy JSONB NOT NULL DEFAULT '{"levels": []}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SLA Breaches
-- ============================================
CREATE TABLE IF NOT EXISTS sla_breaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    breach_type VARCHAR(50) NOT NULL, -- first_response, resolution, escalation
    target_minutes INTEGER NOT NULL,
    actual_minutes INTEGER NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sla_breaches_tenant_id ON sla_breaches(tenant_id);
CREATE INDEX idx_sla_breaches_conversation_id ON sla_breaches(conversation_id);
CREATE INDEX idx_sla_breaches_is_resolved ON sla_breaches(is_resolved);
CREATE INDEX idx_sla_breaches_created_at ON sla_breaches(created_at);

-- ============================================
-- SSO Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS sso_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- saml, oidc, google, microsoft, okta
    is_enabled BOOLEAN DEFAULT true,
    name VARCHAR(255) NOT NULL,
    saml_config JSONB,
    oidc_config JSONB,
    allowed_domains TEXT[] DEFAULT '{}',
    auto_provision BOOLEAN DEFAULT true,
    default_role VARCHAR(50) DEFAULT 'agent',
    group_mapping JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SSO Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sso_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    session_index VARCHAR(255),
    name_id VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sso_sessions_user_id ON sso_sessions(user_id);
CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions(expires_at);

-- ============================================
-- Whitelabel Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS whitelabel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    branding JSONB NOT NULL DEFAULT '{
        "companyName": "CS Automation",
        "logoUrl": null,
        "logoLightUrl": null,
        "faviconUrl": null,
        "tagline": null
    }',
    theme JSONB NOT NULL DEFAULT '{}',
    custom_domain JSONB DEFAULT '{
        "domain": null,
        "sslEnabled": false,
        "verificationStatus": "pending",
        "verificationToken": null
    }',
    email_config JSONB DEFAULT '{}',
    widget_config JSONB DEFAULT '{
        "enabled": true,
        "position": "bottom-right",
        "primaryColor": "#2563eb",
        "headerText": "How can we help?",
        "showPoweredBy": true
    }',
    features JSONB DEFAULT '{
        "showBrandingInChat": true,
        "customLoginPage": false,
        "whitelabelReports": false,
        "hideSystemBranding": false
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API Keys
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    permissions TEXT[] NOT NULL,
    rate_limit JSONB DEFAULT '{"requestsPerMinute": 60, "requestsPerDay": 10000}',
    allowed_ips TEXT[],
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- ============================================
-- API Request Logs
-- ============================================
CREATE TABLE IF NOT EXISTS api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    client_ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_request_logs_api_key_id ON api_request_logs(api_key_id);
CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at);

-- Partition by time for better performance (optional)
-- CREATE TABLE api_request_logs_2024_01 PARTITION OF api_request_logs
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================
-- Webhooks
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(100) NOT NULL,
    headers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    retry_policy JSONB DEFAULT '{"maxRetries": 3, "retryDelayMs": 5000}',
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status VARCHAR(20),
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant_id ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);

-- ============================================
-- Webhook Deliveries
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending', -- pending, delivered, failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at);

-- ============================================
-- Survey Requests (for satisfaction surveys)
-- ============================================
CREATE TABLE IF NOT EXISTS survey_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    template_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent', -- sent, completed, failed, expired
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_survey_requests_tenant_id ON survey_requests(tenant_id);
CREATE INDEX idx_survey_requests_conversation_id ON survey_requests(conversation_id);
CREATE INDEX idx_survey_requests_status ON survey_requests(status);

-- ============================================
-- Survey Responses
-- ============================================
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    survey_request_id UUID REFERENCES survey_requests(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    responses JSONB DEFAULT '{}',
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_survey_responses_tenant_id ON survey_responses(tenant_id);
CREATE INDEX idx_survey_responses_overall_rating ON survey_responses(overall_rating);
CREATE INDEX idx_survey_responses_completed_at ON survey_responses(completed_at);

-- ============================================
-- Automation Rule Executions
-- ============================================
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_data JSONB,
    actions_executed JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'success', -- success, partial, failed
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_executions_tenant_id ON automation_executions(tenant_id);
CREATE INDEX idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX idx_automation_executions_created_at ON automation_executions(created_at);

-- ============================================
-- Add tenant_id to messages for easier querying
-- ============================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Update existing messages with tenant_id from conversations
UPDATE messages m
SET tenant_id = c.tenant_id
FROM conversations c
WHERE m.conversation_id = c.id
AND m.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);

-- ============================================
-- Add tenant_id to escalations
-- ============================================
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Update existing escalations
UPDATE escalations e
SET tenant_id = c.tenant_id
FROM conversations c
WHERE e.conversation_id = c.id
AND e.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_escalations_tenant_id ON escalations(tenant_id);

-- ============================================
-- Add learned_at and knowledge_document_id to escalations
-- ============================================
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS knowledge_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL;

-- ============================================
-- Add source_type and source_id to knowledge_documents
-- ============================================
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'manual';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source ON knowledge_documents(source_type, source_id);

-- ============================================
-- Add CRM fields to customers
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS crm_external_id VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consultation_tag VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customers_crm_external_id ON customers(crm_external_id);
CREATE INDEX IF NOT EXISTS idx_customers_consultation_tag ON customers(consultation_tag);

-- ============================================
-- Add channel_type to customer_channels
-- ============================================
ALTER TABLE customer_channels ADD COLUMN IF NOT EXISTS channel_type VARCHAR(50);

-- Update channel_type from channel_accounts
UPDATE customer_channels cc
SET channel_type = ca.channel_type
FROM channel_accounts ca
WHERE cc.channel_account_id = ca.id
AND cc.channel_type IS NULL;

-- ============================================
-- Functions
-- ============================================

-- Function to get tenant_id for a conversation
CREATE OR REPLACE FUNCTION get_conversation_tenant_id(conv_id UUID)
RETURNS UUID AS $$
    SELECT tenant_id FROM conversations WHERE id = conv_id;
$$ LANGUAGE SQL STABLE;

-- Function to automatically set tenant_id on messages
CREATE OR REPLACE FUNCTION set_message_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_conversation_tenant_id(NEW.conversation_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set tenant_id
DROP TRIGGER IF EXISTS trigger_set_message_tenant_id ON messages;
CREATE TRIGGER trigger_set_message_tenant_id
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION set_message_tenant_id();

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelabel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all tables (for server-side operations)
CREATE POLICY "Service role full access on audit_logs" ON audit_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sla_configs" ON sla_configs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sla_breaches" ON sla_breaches
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sso_configs" ON sso_configs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sso_sessions" ON sso_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on whitelabel_configs" ON whitelabel_configs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on api_keys" ON api_keys
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on api_request_logs" ON api_request_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on webhooks" ON webhooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on webhook_deliveries" ON webhook_deliveries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on survey_requests" ON survey_requests
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on survey_responses" ON survey_responses
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on automation_executions" ON automation_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- Cleanup old logs (scheduled job)
-- ============================================
-- This should be run via a scheduled job (e.g., pg_cron)
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days' AND severity IN ('info', 'warning');
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '365 days';
-- DELETE FROM api_request_logs WHERE created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL '30 days' AND status = 'delivered';
