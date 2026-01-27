-- CS 자동화 플랫폼 데이터베이스 스키마
-- Supabase SQL Editor에서 실행

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 거래처 (병원) 테이블
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  specialty TEXT, -- 'ophthalmology', 'dentistry', 'plastic_surgery', 'dermatology', 'general'
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  ai_config JSONB DEFAULT '{
    "enabled": true,
    "model": "gpt-4",
    "confidence_threshold": 0.75,
    "escalation_keywords": [],
    "system_prompt": ""
  }',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 메신저 채널 계정 테이블
CREATE TABLE IF NOT EXISTS channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL, -- 'line', 'whatsapp', 'facebook', 'instagram', 'kakao', 'channel_talk'
  account_id TEXT NOT NULL, -- 각 플랫폼의 계정 ID
  account_name TEXT NOT NULL, -- 표시 이름 (예: "힐링안과 라인")
  credentials JSONB, -- 암호화된 인증 정보
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_type, account_id)
);

-- 4. 고객 테이블
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  language TEXT DEFAULT 'ko', -- 선호 언어
  country TEXT,
  profile_image_url TEXT,
  tags TEXT[] DEFAULT '{}', -- 상담 태그: 가망, 잠재, 1차예약, 확정예약 등
  metadata JSONB DEFAULT '{}',
  crm_customer_id TEXT, -- 외부 CRM 연동 ID
  is_vip BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 고객-채널 연결 테이블
CREATE TABLE IF NOT EXISTS customer_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  channel_account_id UUID REFERENCES channel_accounts(id) ON DELETE CASCADE,
  channel_user_id TEXT NOT NULL, -- 각 플랫폼의 사용자 ID
  channel_username TEXT, -- 플랫폼에서의 사용자명
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_account_id, channel_user_id)
);

-- 6. 대화 테이블
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active', -- 'active', 'waiting', 'resolved', 'escalated'
  priority TEXT DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
  assigned_to UUID, -- 담당자 ID
  ai_enabled BOOLEAN DEFAULT true,
  unread_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 메시지 테이블
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  customer_channel_id UUID REFERENCES customer_channels(id),
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  sender_type TEXT NOT NULL, -- 'customer', 'agent', 'ai', 'system'
  content_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'audio', 'video', 'location'
  content TEXT,
  media_url TEXT,
  original_language TEXT,
  translated_content TEXT,
  translated_language TEXT,
  external_id TEXT, -- 외부 플랫폼 메시지 ID
  status TEXT DEFAULT 'sent', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  ai_confidence FLOAT,
  ai_model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 지식베이스 문서 테이블
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 지식베이스 청크 테이블 (벡터 검색용)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small 차원
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 에스컬레이션 테이블
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id),
  reason TEXT NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'urgent', 'high', 'medium', 'low'
  status TEXT DEFAULT 'pending', -- 'pending', 'assigned', 'in_progress', 'resolved'
  ai_confidence FLOAT,
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AI 응답 로그 테이블
CREATE TABLE IF NOT EXISTS ai_response_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  message_id TEXT,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  confidence FLOAT,
  retrieved_docs JSONB DEFAULT '[]',
  escalated BOOLEAN DEFAULT false,
  processing_time_ms INT,
  feedback TEXT, -- 'positive', 'negative'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 자동화 규칙 테이블
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'message_received', 'booking_confirmed', 'visit_day_before', etc.
  conditions JSONB DEFAULT '{}',
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 내부 메모/코멘트 테이블 (Channel.io 참고)
CREATE TABLE IF NOT EXISTS internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentioned_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. 예약 테이블
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  booking_type TEXT, -- 'consultation', 'surgery', 'follow_up'
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'
  notes TEXT,
  crm_booking_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성

-- 벡터 검색 인덱스 (IVFFlat)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 검색 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant ON knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant ON knowledge_chunks(tenant_id);

-- 풀텍스트 검색 인덱스 (Supabase는 한국어 설정을 지원하지 않으므로 'simple' 사용)
-- 한국어 검색은 pg_bigm 확장이나 별도 검색 엔진(Elasticsearch) 연동 고려
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_fts
ON knowledge_documents USING gin(to_tsvector('simple', content));

-- 벡터 검색 함수
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
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
    kc.id,
    kc.document_id,
    kc.chunk_text,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.tenant_id = p_tenant_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Row Level Security (RLS) 활성화
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 기본 RLS 정책 (서비스 롤은 모든 접근 허용)
-- 실제 운영 시에는 더 세분화된 정책 필요

CREATE POLICY "Service role has full access to tenants"
ON tenants FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to channel_accounts"
ON channel_accounts FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to customers"
ON customers FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to customer_channels"
ON customer_channels FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to conversations"
ON conversations FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to messages"
ON messages FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to knowledge_documents"
ON knowledge_documents FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to knowledge_chunks"
ON knowledge_chunks FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to escalations"
ON escalations FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to ai_response_logs"
ON ai_response_logs FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to automation_rules"
ON automation_rules FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to internal_notes"
ON internal_notes FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to bookings"
ON bookings FOR ALL
USING (auth.role() = 'service_role');

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_accounts_updated_at
    BEFORE UPDATE ON channel_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_documents_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 트리거: 대화의 last_message 업데이트
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        unread_count = CASE
            WHEN NEW.direction = 'inbound' THEN unread_count + 1
            ELSE unread_count
        END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- 초기 테스트 데이터 (선택사항)
-- INSERT INTO tenants (name, name_en, specialty) VALUES
-- ('힐링안과', 'Healing Eye Clinic', 'ophthalmology'),
-- ('스마일치과', 'Smile Dental', 'dentistry'),
-- ('서울성형외과', 'Seoul Plastic Surgery', 'plastic_surgery');
