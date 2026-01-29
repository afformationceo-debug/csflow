-- Create test data for verifying the system works
-- This will create sample conversations and messages to test the RLS policies

DO $$
DECLARE
    v_tenant_id UUID := '8d3bd24e-0d74-4dc7-aa34-3e39d5821244';
    v_channel_account_id UUID;
    v_customer_id UUID;
    v_conversation_id UUID;
BEGIN
    -- Get the existing LINE channel account ID
    SELECT id INTO v_channel_account_id
    FROM channel_accounts
    WHERE tenant_id = v_tenant_id
    AND channel_type = 'line'
    LIMIT 1;

    -- Create a test customer (chatdoc ceo)
    INSERT INTO customers (
        id,
        tenant_id,
        name,
        language,
        country,
        tags,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'chatdoc ceo',
        'ko',
        'KR',
        ARRAY['VIP', '가망'],
        jsonb_build_object(
            'source', 'LINE',
            'first_contact', '2026-01-20'
        ),
        NOW() - INTERVAL '9 days',
        NOW() - INTERVAL '2 days'
    ) RETURNING id INTO v_customer_id;

    -- Create a customer_channel link
    INSERT INTO customer_channels (
        id,
        customer_id,
        channel_account_id,
        channel_user_id,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_customer_id,
        v_channel_account_id,
        'U_chatdoc_ceo_line_id',
        NOW() - INTERVAL '9 days'
    );

    -- Create a conversation (conversations 테이블에는 channel_account_id가 없음 - customer_channels를 통해 연결)
    INSERT INTO conversations (
        id,
        customer_id,
        tenant_id,
        status,
        priority,
        last_message_at,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_customer_id,
        v_tenant_id,
        'active',
        'normal',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '9 days'
    ) RETURNING id INTO v_conversation_id;

    -- Add some test messages
    INSERT INTO messages (
        id,
        conversation_id,
        direction,
        sender_type,
        content_type,
        content,
        original_content,
        original_language,
        translated_content,
        metadata,
        created_at
    ) VALUES
    -- Customer's first message (in Korean)
    (
        gen_random_uuid(),
        v_conversation_id,
        'inbound',
        'customer',
        'text',
        '안녕하세요! 라식 수술에 대해 문의드립니다.',
        '안녕하세요! 라식 수술에 대해 문의드립니다.',
        'ko',
        'Hello! I would like to inquire about LASIK surgery.',
        jsonb_build_object('channel', 'LINE'),
        NOW() - INTERVAL '9 days'
    ),
    -- AI response
    (
        gen_random_uuid(),
        v_conversation_id,
        'outbound',
        'ai',
        'text',
        '안녕하세요! 힐링안과입니다. 라식 수술에 관심 가져주셔서 감사합니다. 무엇을 도와드릴까요?',
        '안녕하세요! 힐링안과입니다. 라식 수술에 관심 가져주셔서 감사합니다. 무엇을 도와드릴까요?',
        'ko',
        'Hello! This is Healing Eye Clinic. Thank you for your interest in LASIK surgery. How can I help you?',
        jsonb_build_object(
            'ai_model', 'gpt-4',
            'ai_confidence', 0.92,
            'channel', 'LINE'
        ),
        NOW() - INTERVAL '9 days' + INTERVAL '30 seconds'
    ),
    -- Customer's follow-up
    (
        gen_random_uuid(),
        v_conversation_id,
        'inbound',
        'customer',
        'text',
        '비용이 얼마나 드나요? 그리고 회복 기간은 어느 정도인가요?',
        '비용이 얼마나 드나요? 그리고 회복 기간은 어느 정도인가요?',
        'ko',
        'How much does it cost? And how long is the recovery period?',
        jsonb_build_object('channel', 'LINE'),
        NOW() - INTERVAL '8 days'
    ),
    -- Recent message (1 hour ago)
    (
        gen_random_uuid(),
        v_conversation_id,
        'inbound',
        'customer',
        'text',
        '예약 가능한 날짜 알려주세요.',
        '예약 가능한 날짜 알려주세요.',
        'ko',
        'Please let me know the available appointment dates.',
        jsonb_build_object('channel', 'LINE'),
        NOW() - INTERVAL '1 hour'
    );

    -- Create another customer (Japanese patient)
    INSERT INTO customers (
        id,
        tenant_id,
        name,
        language,
        country,
        tags,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        '田中太郎',
        'ja',
        'JP',
        ARRAY['잠재', '인플루언서'],
        jsonb_build_object(
            'source', 'LINE',
            'first_contact', '2026-01-25',
            'interest', 'スマイルLASIK'
        ),
        NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '1 day'
    ) RETURNING id INTO v_customer_id;

    -- Create customer_channel link
    INSERT INTO customer_channels (
        id,
        customer_id,
        channel_account_id,
        channel_user_id,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_customer_id,
        v_channel_account_id,
        'U_tanaka_line_id',
        NOW() - INTERVAL '4 days'
    );

    -- Create conversation (두 번째 고객)
    INSERT INTO conversations (
        id,
        customer_id,
        tenant_id,
        status,
        priority,
        last_message_at,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_customer_id,
        v_tenant_id,
        'active',
        'normal',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '4 days'
    ) RETURNING id INTO v_conversation_id;

    -- Add messages
    INSERT INTO messages (
        id,
        conversation_id,
        direction,
        sender_type,
        content_type,
        content,
        original_content,
        original_language,
        translated_content,
        metadata,
        created_at
    ) VALUES
    (
        gen_random_uuid(),
        v_conversation_id,
        'inbound',
        'customer',
        'text',
        'スマイルLASIKの費用を教えてください。',
        'スマイルLASIKの費用を教えてください。',
        'ja',
        '스마일라식 비용을 알려주세요.',
        jsonb_build_object('channel', 'LINE'),
        NOW() - INTERVAL '4 days'
    ),
    (
        gen_random_uuid(),
        v_conversation_id,
        'outbound',
        'ai',
        'text',
        'スマイルLASIKの費用は両目で約150万ウォン（約15万円）です。',
        'スマイルLASIKの費用は両目で約150万ウォン（約15万円）です。',
        'ja',
        '스마일라식 비용은 양안 기준 약 150만원입니다.',
        jsonb_build_object(
            'ai_model', 'gpt-4',
            'ai_confidence', 0.88,
            'channel', 'LINE'
        ),
        NOW() - INTERVAL '4 days' + INTERVAL '1 minute'
    );

    RAISE NOTICE 'Test data created successfully!';
    RAISE NOTICE 'Created 2 customers with conversations';
    RAISE NOTICE 'Tenant ID: %', v_tenant_id;
END $$;

-- Verify the test data
SELECT
    'customers' as table_name,
    COUNT(*) as count
FROM customers
UNION ALL
SELECT
    'conversations' as table_name,
    COUNT(*) as count
FROM conversations
UNION ALL
SELECT
    'messages' as table_name,
    COUNT(*) as count
FROM messages;

-- Show conversations with customer info
SELECT
    c.id as conversation_id,
    cu.name as customer_name,
    cu.language,
    c.status,
    c.created_at,
    c.last_message_at,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
FROM conversations c
JOIN customers cu ON c.customer_id = cu.id
ORDER BY c.last_message_at DESC;
