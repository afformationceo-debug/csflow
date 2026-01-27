-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Custom types
CREATE TYPE channel_type AS ENUM ('line', 'whatsapp', 'facebook', 'instagram', 'kakao');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_content_type AS ENUM ('text', 'image', 'file', 'audio', 'video', 'location', 'sticker');
CREATE TYPE message_status AS ENUM ('pending', 'processing', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE conversation_status AS ENUM ('active', 'waiting', 'resolved', 'escalated');
CREATE TYPE escalation_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE escalation_status AS ENUM ('pending', 'assigned', 'in_progress', 'resolved');
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'agent');
CREATE TYPE sender_type AS ENUM ('customer', 'agent', 'ai', 'system');
CREATE TYPE knowledge_source_type AS ENUM ('manual', 'escalation', 'import');
CREATE TYPE feedback_type AS ENUM ('positive', 'negative');

-- ============================================
-- 1. Tenants (거래처/병원)
-- ============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    specialty VARCHAR(100),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    ai_config JSONB DEFAULT '{
        "enabled": true,
        "confidence_threshold": 0.75,
        "model": "gpt-4",
        "system_prompt": "",
        "escalation_keywords": [],
        "working_hours": {"start": "09:00", "end": "18:00"}
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Channel Accounts (메신저 계정)
-- ============================================
CREATE TABLE channel_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_type channel_type NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    account_id VARCHAR(500) NOT NULL,
    credentials JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    webhook_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, channel_type, account_id)
);

-- ============================================
-- 3. Customers (고객)
-- ============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id VARCHAR(500),
    name VARCHAR(200),
    phone VARCHAR(50),
    email VARCHAR(255),
    country VARCHAR(100),
    language VARCHAR(10) DEFAULT 'ko',
    profile_image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    crm_customer_id VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Customer Channels (고객-채널 연결)
-- ============================================
CREATE TABLE customer_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel_account_id UUID NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
    channel_user_id VARCHAR(500) NOT NULL,
    channel_username VARCHAR(200),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_account_id, channel_user_id)
);

-- ============================================
-- 5. Conversations (대화)
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status conversation_status DEFAULT 'active',
    assigned_to UUID,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    ai_enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Messages (메시지)
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    customer_channel_id UUID REFERENCES customer_channels(id),
    direction message_direction NOT NULL,
    content_type message_content_type DEFAULT 'text',
    content TEXT NOT NULL,
    media_url TEXT,
    original_language VARCHAR(10),
    translated_content TEXT,
    translated_language VARCHAR(10),
    status message_status DEFAULT 'pending',
    sender_type sender_type NOT NULL,
    sender_id UUID,
    ai_confidence DECIMAL(5,4),
    ai_model VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    external_id VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. Users (관리자/담당자)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'agent',
    tenant_ids UUID[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for conversations.assigned_to
ALTER TABLE conversations ADD CONSTRAINT fk_conversations_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 8. Escalations (에스컬레이션)
-- ============================================
CREATE TABLE escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    priority escalation_priority DEFAULT 'medium',
    status escalation_status DEFAULT 'pending',
    reason TEXT NOT NULL,
    ai_confidence DECIMAL(5,4),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. Knowledge Documents (지식베이스 문서)
-- ============================================
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    source_type knowledge_source_type DEFAULT 'manual',
    source_id UUID,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. Knowledge Embeddings (벡터 임베딩)
-- ============================================
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. Automation Rules (자동화 규칙)
-- ============================================
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',
    actions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. Bookings (예약)
-- ============================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    crm_booking_id VARCHAR(500),
    booking_date DATE NOT NULL,
    booking_time TIME,
    service_type VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. AI Response Logs (AI 응답 로그)
-- ============================================
CREATE TABLE ai_response_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,
    retrieved_docs JSONB DEFAULT '[]',
    feedback feedback_type,
    escalated BOOLEAN DEFAULT false,
    processing_time_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Tenants
CREATE INDEX idx_tenants_name ON tenants(name);

-- Channel Accounts
CREATE INDEX idx_channel_accounts_tenant ON channel_accounts(tenant_id);
CREATE INDEX idx_channel_accounts_type ON channel_accounts(channel_type);
CREATE INDEX idx_channel_accounts_active ON channel_accounts(tenant_id, is_active);

-- Customers
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_crm ON customers(crm_customer_id);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);

-- Customer Channels
CREATE INDEX idx_customer_channels_customer ON customer_channels(customer_id);
CREATE INDEX idx_customer_channels_account ON customer_channels(channel_account_id);

-- Conversations
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_tenant_status ON conversations(tenant_id, status);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_channel ON messages(customer_channel_id);
CREATE INDEX idx_messages_external ON messages(external_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Escalations
CREATE INDEX idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_priority ON escalations(priority);
CREATE INDEX idx_escalations_assigned ON escalations(assigned_to);
CREATE INDEX idx_escalations_pending ON escalations(status, priority) WHERE status IN ('pending', 'assigned');

-- Knowledge Documents
CREATE INDEX idx_knowledge_docs_tenant ON knowledge_documents(tenant_id);
CREATE INDEX idx_knowledge_docs_category ON knowledge_documents(tenant_id, category);
CREATE INDEX idx_knowledge_docs_active ON knowledge_documents(tenant_id, is_active);
CREATE INDEX idx_knowledge_docs_tags ON knowledge_documents USING GIN(tags);

-- Knowledge Embeddings (HNSW for fast similarity search)
CREATE INDEX idx_knowledge_embeddings_document ON knowledge_embeddings(document_id);
CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Automation Rules
CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id);
CREATE INDEX idx_automation_rules_active ON automation_rules(tenant_id, is_active, priority);

-- Bookings
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_reminder ON bookings(booking_date, reminder_sent) WHERE reminder_sent = false;

-- AI Response Logs
CREATE INDEX idx_ai_logs_conversation ON ai_response_logs(conversation_id);
CREATE INDEX idx_ai_logs_tenant ON ai_response_logs(tenant_id);
CREATE INDEX idx_ai_logs_feedback ON ai_response_logs(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX idx_ai_logs_escalated ON ai_response_logs(tenant_id, escalated) WHERE escalated = true;

-- ============================================
-- Functions
-- ============================================

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    p_tenant_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ke.id,
        ke.document_id,
        ke.chunk_text,
        1 - (ke.embedding <=> query_embedding) AS similarity
    FROM knowledge_embeddings ke
    JOIN knowledge_documents kd ON ke.document_id = kd.id
    WHERE kd.tenant_id = p_tenant_id
      AND kd.is_active = true
      AND 1 - (ke.embedding <=> query_embedding) > match_threshold
    ORDER BY ke.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_accounts_updated_at
    BEFORE UPDATE ON channel_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at
    BEFORE UPDATE ON escalations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_documents_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        unread_count = CASE
            WHEN NEW.direction = 'inbound' THEN unread_count + 1
            ELSE unread_count
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_logs ENABLE ROW LEVEL SECURITY;

-- Users can access tenants they belong to
CREATE POLICY "Users can view their tenants" ON tenants
    FOR SELECT USING (
        id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Channel accounts policy
CREATE POLICY "Users can view channel accounts" ON channel_accounts
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage channel accounts" ON channel_accounts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Customers policy
CREATE POLICY "Users can view customers" ON customers
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage customers" ON customers
    FOR ALL USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

-- Conversations policy
CREATE POLICY "Users can view conversations" ON conversations
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage conversations" ON conversations
    FOR ALL USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

-- Messages policy
CREATE POLICY "Users can view messages" ON messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create messages" ON messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );

-- Users policy (self and admin)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Escalations policy
CREATE POLICY "Users can view escalations" ON escalations
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage escalations" ON escalations
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );

-- Knowledge documents policy
CREATE POLICY "Users can view knowledge documents" ON knowledge_documents
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage knowledge documents" ON knowledge_documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Knowledge embeddings policy
CREATE POLICY "Users can view knowledge embeddings" ON knowledge_embeddings
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM knowledge_documents WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );

-- Automation rules policy
CREATE POLICY "Users can view automation rules" ON automation_rules
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage automation rules" ON automation_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Bookings policy
CREATE POLICY "Users can view bookings" ON bookings
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage bookings" ON bookings
    FOR ALL USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

-- AI response logs policy
CREATE POLICY "Users can view AI logs" ON ai_response_logs
    FOR SELECT USING (
        tenant_id = ANY(
            SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
        )
    );

-- Customer channels policy
CREATE POLICY "Users can view customer channels" ON customer_channels
    FOR SELECT USING (
        customer_id IN (
            SELECT id FROM customers WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage customer channels" ON customer_channels
    FOR ALL USING (
        customer_id IN (
            SELECT id FROM customers WHERE tenant_id = ANY(
                SELECT unnest(tenant_ids) FROM users WHERE id = auth.uid()
            )
        )
    );
