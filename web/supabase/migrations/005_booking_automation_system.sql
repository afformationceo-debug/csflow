-- ==========================================
-- Human-in-the-Loop 풀자동화 예약 시스템
-- ==========================================

-- 1. 예약 신청 로그 테이블 (1차 예약 요청)
CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- 예약 정보
  requested_date TEXT, -- "2026-02-15", "다음주 월요일" 등
  requested_time TEXT, -- "오전 10시", "14:00" 등
  treatment_type TEXT, -- "라식", "라섹", "스마일라식" 등
  special_requests TEXT, -- 고객의 특별 요청사항

  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'pending_human_approval',
  -- 상태: pending_human_approval (휴먼 승인 대기)
  --      human_approved (휴먼 승인 완료)
  --      needs_rescheduling (일정 조율 필요)
  --      confirmed (CRM 등록 완료)
  --      rejected (거절됨)

  -- 휴먼 응답
  human_response TEXT, -- 휴먼의 응답 메시지
  alternative_dates TEXT[], -- 대안 날짜 배열
  rejection_reason TEXT, -- 거절 사유

  -- CRM 연동
  crm_booking_id TEXT, -- CRM에 등록된 예약 ID
  confirmed_date TIMESTAMPTZ, -- 최종 확정된 예약 날짜/시간

  -- 메타데이터
  metadata JSONB DEFAULT '{}', -- 추가 정보 (언어, 채널, AI 의도 점수 등)

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  human_responded_at TIMESTAMPTZ, -- 휴먼이 응답한 시간
  confirmed_at TIMESTAMPTZ -- CRM 등록 완료 시간
);

-- 인덱스 생성
CREATE INDEX idx_booking_requests_status ON booking_requests(status, created_at DESC);
CREATE INDEX idx_booking_requests_tenant ON booking_requests(tenant_id, status);
CREATE INDEX idx_booking_requests_customer ON booking_requests(customer_id);
CREATE INDEX idx_booking_requests_conversation ON booking_requests(conversation_id);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. 채널별 풀자동화 모드 설정 (기존 channel_accounts에 컬럼 추가)
ALTER TABLE channel_accounts
ADD COLUMN IF NOT EXISTS full_automation_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS automation_config JSONB DEFAULT '{}';

COMMENT ON COLUMN channel_accounts.full_automation_enabled IS '풀자동화 모드 활성화 여부 (RAG 정보 충분한 채널만 true)';
COMMENT ON COLUMN channel_accounts.automation_config IS '자동화 설정 (예약 유도 강도, 알림 채널, CRM 연동 여부 등)';

-- 3. 휴먼 알림 로그 테이블 (카카오톡/슬랙 알림 추적)
CREATE TABLE IF NOT EXISTS human_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,

  -- 알림 정보
  notification_type TEXT NOT NULL, -- 'kakao_alimtalk', 'slack', 'email'
  recipient TEXT NOT NULL, -- 수신자 (전화번호, 슬랙 채널, 이메일)

  -- 알림 내용
  template_code TEXT, -- 카카오 알림톡 템플릿 코드
  message_content TEXT, -- 실제 발송된 메시지

  -- 상태
  status TEXT DEFAULT 'pending', -- pending, sent, failed, responded
  response_action TEXT, -- 'approved', 'needs_rescheduling', 'rejected'

  -- 메타데이터
  metadata JSONB DEFAULT '{}',

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_human_notifications_booking ON human_notifications(booking_request_id);
CREATE INDEX idx_human_notifications_status ON human_notifications(status, created_at DESC);

-- 4. AI 예약 의도 감지 로그 (디버깅 및 학습용)
CREATE TABLE IF NOT EXISTS booking_intent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- 의도 감지 결과
  intent_detected BOOLEAN NOT NULL, -- 예약 의도 감지 여부
  intent_confidence FLOAT, -- 의도 감지 신뢰도 (0.0 ~ 1.0)
  intent_type TEXT, -- 'booking_inquiry', 'booking_request', 'booking_modification', 'booking_cancellation'

  -- 추출된 엔티티
  extracted_entities JSONB, -- { "date": "다음주 월요일", "treatment": "라식", "time": "오전" }

  -- AI 응답
  ai_action TEXT, -- 'send_form', 'ask_details', 'confirm_booking', 'escalate'
  ai_response TEXT, -- AI가 생성한 응답

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_intent_logs_conversation ON booking_intent_logs(conversation_id, created_at DESC);
CREATE INDEX idx_booking_intent_logs_intent ON booking_intent_logs(intent_detected, intent_confidence DESC);

-- 5. RLS 정책 설정
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_intent_logs ENABLE ROW LEVEL SECURITY;

-- booking_requests RLS
DROP POLICY IF EXISTS "Users can view booking requests for their tenants" ON booking_requests;
CREATE POLICY "Users can view booking requests for their tenants"
  ON booking_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND tenant_id = ANY(users.tenant_ids)
    )
  );

DROP POLICY IF EXISTS "Users can update booking requests for their tenants" ON booking_requests;
CREATE POLICY "Users can update booking requests for their tenants"
  ON booking_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND tenant_id = ANY(users.tenant_ids)
    )
  );

-- human_notifications RLS
DROP POLICY IF EXISTS "Users can view notifications for their booking requests" ON human_notifications;
CREATE POLICY "Users can view notifications for their booking requests"
  ON human_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_requests br
      JOIN users u ON u.id = auth.uid()
      WHERE br.id = booking_request_id
      AND br.tenant_id = ANY(u.tenant_ids)
    )
  );

-- booking_intent_logs RLS
DROP POLICY IF EXISTS "Users can view intent logs for their conversations" ON booking_intent_logs;
CREATE POLICY "Users can view intent logs for their conversations"
  ON booking_intent_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN users u ON u.id = auth.uid()
      WHERE c.id = conversation_id
      AND c.tenant_id = ANY(u.tenant_ids)
    )
  );

-- 6. 초기 데이터 삽입 (예시 자동화 설정)
UPDATE channel_accounts
SET
  full_automation_enabled = false, -- 기본값: 비활성화
  automation_config = jsonb_build_object(
    'booking_prompt_intensity', 'medium', -- low, medium, high
    'notification_channels', ARRAY['slack'], -- kakao_alimtalk, slack, email
    'auto_crm_sync', true,
    'require_human_approval', true,
    'business_hours', jsonb_build_object(
      'timezone', 'Asia/Seoul',
      'weekdays', ARRAY['mon', 'tue', 'wed', 'thu', 'fri'],
      'hours', '09:00-18:00'
    )
  )
WHERE channel_type IN ('line', 'kakao', 'whatsapp', 'facebook', 'instagram', 'wechat');

-- 7. 뷰 생성: 대기 중인 예약 요청 (휴먼 대시보드용)
CREATE OR REPLACE VIEW pending_booking_requests AS
SELECT
  br.id,
  br.tenant_id,
  t.name AS tenant_name,
  br.customer_id,
  c.name AS customer_name,
  c.language AS customer_language,
  c.country AS customer_country,
  br.conversation_id,
  br.requested_date,
  br.requested_time,
  br.treatment_type,
  br.special_requests,
  br.status,
  br.metadata,
  br.created_at,
  -- 대기 시간 계산
  EXTRACT(EPOCH FROM (NOW() - br.created_at)) / 60 AS waiting_minutes,
  -- 알림 발송 여부
  (SELECT COUNT(*) FROM human_notifications WHERE booking_request_id = br.id AND status = 'sent') AS notifications_sent,
  -- 고객 채널 정보
  (
    SELECT jsonb_agg(jsonb_build_object(
      'channel_type', ca.channel_type,
      'account_name', ca.account_name
    ))
    FROM customer_channels cc
    JOIN channel_accounts ca ON ca.id = cc.channel_account_id
    WHERE cc.customer_id = br.customer_id
  ) AS customer_channels
FROM booking_requests br
JOIN tenants t ON t.id = br.tenant_id
JOIN customers c ON c.id = br.customer_id
WHERE br.status IN ('pending_human_approval', 'needs_rescheduling')
ORDER BY br.created_at ASC;

-- 8. 함수: 예약 요청 생성 (AI가 호출)
CREATE OR REPLACE FUNCTION create_booking_request(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_conversation_id UUID,
  p_requested_date TEXT,
  p_requested_time TEXT DEFAULT NULL,
  p_treatment_type TEXT DEFAULT NULL,
  p_special_requests TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_booking_request_id UUID;
BEGIN
  INSERT INTO booking_requests (
    tenant_id,
    customer_id,
    conversation_id,
    requested_date,
    requested_time,
    treatment_type,
    special_requests,
    status,
    metadata
  ) VALUES (
    p_tenant_id,
    p_customer_id,
    p_conversation_id,
    p_requested_date,
    p_requested_time,
    p_treatment_type,
    p_special_requests,
    'pending_human_approval',
    p_metadata
  ) RETURNING id INTO v_booking_request_id;

  RETURN v_booking_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 함수: 휴먼 승인 처리
CREATE OR REPLACE FUNCTION approve_booking_request(
  p_booking_request_id UUID,
  p_confirmed_date TIMESTAMPTZ DEFAULT NULL,
  p_alternative_dates TEXT[] DEFAULT NULL,
  p_human_response TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE booking_requests
  SET
    status = CASE
      WHEN p_confirmed_date IS NOT NULL THEN 'human_approved'
      WHEN p_alternative_dates IS NOT NULL THEN 'needs_rescheduling'
      ELSE status
    END,
    human_response = p_human_response,
    confirmed_date = p_confirmed_date,
    alternative_dates = p_alternative_dates,
    human_responded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_request_id
  RETURNING jsonb_build_object(
    'id', id,
    'status', status,
    'customer_id', customer_id,
    'conversation_id', conversation_id,
    'confirmed_date', confirmed_date
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 함수: CRM 예약 등록 완료 처리
CREATE OR REPLACE FUNCTION confirm_booking_to_crm(
  p_booking_request_id UUID,
  p_crm_booking_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE booking_requests
  SET
    status = 'confirmed',
    crm_booking_id = p_crm_booking_id,
    confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_request_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ Human-in-the-Loop 풀자동화 예약 시스템 스키마 생성 완료!';
  RAISE NOTICE '📋 생성된 테이블:';
  RAISE NOTICE '   - booking_requests (예약 신청 로그)';
  RAISE NOTICE '   - human_notifications (휴먼 알림 로그)';
  RAISE NOTICE '   - booking_intent_logs (AI 의도 감지 로그)';
  RAISE NOTICE '🔧 생성된 함수:';
  RAISE NOTICE '   - create_booking_request() (예약 요청 생성)';
  RAISE NOTICE '   - approve_booking_request() (휴먼 승인)';
  RAISE NOTICE '   - confirm_booking_to_crm() (CRM 등록 완료)';
  RAISE NOTICE '👁️ 생성된 뷰:';
  RAISE NOTICE '   - pending_booking_requests (대기 중인 예약)';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계:';
  RAISE NOTICE '1. Supabase SQL Editor에서 이 마이그레이션 실행';
  RAISE NOTICE '2. AI 예약 의도 감지 로직 구현';
  RAISE NOTICE '3. 카카오톡/슬랙 알림 시스템 연동';
  RAISE NOTICE '4. CRM 자동 등록 API 연동';
END $$;
