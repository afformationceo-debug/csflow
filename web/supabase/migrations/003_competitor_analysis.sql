-- Phase 7: Competitor Analysis Tables
-- Run this after phase4-schema.sql

-- ============================================
-- Competitors Table
-- ============================================
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    website TEXT,
    location TEXT,
    specialty TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitors_tenant_id ON competitors(tenant_id);
CREATE INDEX idx_competitors_name ON competitors(name);

-- ============================================
-- Competitor Prices Table
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    price_min DECIMAL(12, 2),
    price_max DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'KRW',
    notes TEXT,
    source TEXT, -- 'web_scraping', 'manual', 'api'
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitor_prices_tenant_id ON competitor_prices(tenant_id);
CREATE INDEX idx_competitor_prices_competitor_id ON competitor_prices(competitor_id);
CREATE INDEX idx_competitor_prices_service_name ON competitor_prices(service_name);
CREATE INDEX idx_competitor_prices_collected_at ON competitor_prices(collected_at);

-- ============================================
-- Price Alerts Table
-- ============================================
CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'price_change', 'new_service', 'price_drop'
    threshold_percent DECIMAL(5, 2), -- Percentage threshold for alerts
    old_price_min DECIMAL(12, 2),
    old_price_max DECIMAL(12, 2),
    new_price_min DECIMAL(12, 2),
    new_price_max DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'KRW',
    is_notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_alerts_tenant_id ON price_alerts(tenant_id);
CREATE INDEX idx_price_alerts_competitor_id ON price_alerts(competitor_id);
CREATE INDEX idx_price_alerts_is_notified ON price_alerts(is_notified);
CREATE INDEX idx_price_alerts_created_at ON price_alerts(created_at);

-- ============================================
-- Fine-tuning Jobs Table (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS fine_tuning_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL, -- OpenAI job ID
    model VARCHAR(100) NOT NULL,
    base_model VARCHAR(100) NOT NULL,
    training_file VARCHAR(255),
    validation_file VARCHAR(255),
    hyperparameters JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL, -- 'pending', 'running', 'succeeded', 'failed', 'cancelled'
    error TEXT,
    trained_tokens INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_fine_tuning_jobs_tenant_id ON fine_tuning_jobs(tenant_id);
CREATE INDEX idx_fine_tuning_jobs_job_id ON fine_tuning_jobs(job_id);
CREATE INDEX idx_fine_tuning_jobs_status ON fine_tuning_jobs(status);
