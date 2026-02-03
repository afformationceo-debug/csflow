import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://csflow.vercel.app";
const TEST_EMAIL = "afformation.ceo@gmail.com";
const TEST_PASSWORD = "afformation1!";

// 실제 LINE 채널 정보
const LINE_CHANNEL_ID = "2008754781";

// 순차 실행
test.describe.configure({ mode: "serial" });

test.describe("LINE Webhook 실시간 테스트", () => {
  // 로그인 helper
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  }

  test("1단계: 최근 메시지 확인 (hello 메시지)", async ({ page }) => {
    await login(page);

    console.log("📊 통합 인박스로 이동...");
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 스크린샷
    await page.screenshot({ path: 'inbox-status.png', fullPage: true });

    // LINE 채널 메시지 확인
    const lineMessages = page.locator('text=/hello/i');
    const messageCount = await lineMessages.count();

    console.log(`📬 "hello" 메시지 개수: ${messageCount}`);

    if (messageCount > 0) {
      console.log("✅ 메시지가 인박스에 표시됨");

      // 첫 번째 메시지 클릭
      await lineMessages.first().click();
      await page.waitForTimeout(1000);

      // 대화 상세 확인
      await page.screenshot({ path: 'conversation-detail.png', fullPage: true });
    } else {
      console.log("❌ 메시지가 인박스에 표시되지 않음");
    }
  });

  test("2단계: API로 고객 및 대화 확인", async ({ page }) => {
    await login(page);

    console.log("📊 API로 고객 데이터 확인...");

    // 고객 목록 조회
    const customersResponse = await page.request.get(`${BASE_URL}/api/customers`);
    console.log(`고객 API 상태: ${customersResponse.status()}`);

    if (customersResponse.ok()) {
      const customersData = await customersResponse.json();
      console.log(`고객 수: ${customersData.customers?.length || 0}`);

      if (customersData.customers && customersData.customers.length > 0) {
        // 최근 고객 출력
        const recentCustomer = customersData.customers[0];
        console.log("최근 고객 정보:", {
          id: recentCustomer.id,
          name: recentCustomer.name,
          channel: recentCustomer.channel_type,
          created_at: recentCustomer.created_at
        });
      }
    }

    // 대화 목록 조회
    const conversationsResponse = await page.request.get(`${BASE_URL}/api/conversations`);
    console.log(`대화 API 상태: ${conversationsResponse.status()}`);

    if (conversationsResponse.ok()) {
      const conversationsData = await conversationsResponse.json();
      console.log(`대화 수: ${conversationsData.conversations?.length || 0}`);

      if (conversationsData.conversations && conversationsData.conversations.length > 0) {
        // 최근 대화 출력
        const recentConversation = conversationsData.conversations[0];
        console.log("최근 대화 정보:", {
          id: recentConversation.id,
          status: recentConversation.status,
          ai_enabled: recentConversation.ai_enabled,
          last_message: recentConversation.last_message_preview,
          last_message_at: recentConversation.last_message_at
        });
      }
    }
  });

  test("3단계: API로 메시지 확인", async ({ page }) => {
    await login(page);

    console.log("📊 API로 메시지 확인...");

    // 대화 목록 먼저 조회
    const conversationsResponse = await page.request.get(`${BASE_URL}/api/conversations`);

    if (conversationsResponse.ok()) {
      const conversationsData = await conversationsResponse.json();

      if (conversationsData.conversations && conversationsData.conversations.length > 0) {
        const conversationId = conversationsData.conversations[0].id;

        // 해당 대화의 메시지 조회
        const messagesResponse = await page.request.get(
          `${BASE_URL}/api/conversations/${conversationId}/messages`
        );

        console.log(`메시지 API 상태: ${messagesResponse.status()}`);

        if (messagesResponse.ok()) {
          const messagesData = await messagesResponse.json();
          console.log(`메시지 수: ${messagesData.messages?.length || 0}`);

          if (messagesData.messages && messagesData.messages.length > 0) {
            console.log("\n📨 메시지 목록:");
            messagesData.messages.forEach((msg: any, idx: number) => {
              console.log(`\n메시지 ${idx + 1}:`, {
                direction: msg.direction,
                sender_type: msg.sender_type,
                content: msg.content,
                ai_confidence: msg.ai_confidence,
                created_at: msg.created_at
              });
            });

            // AI 응답 확인
            const aiMessages = messagesData.messages.filter(
              (msg: any) => msg.sender_type === "ai"
            );

            if (aiMessages.length > 0) {
              console.log("\n✅ AI 응답 발견!");
              console.log("AI 응답 내용:", aiMessages[0].content);
            } else {
              console.log("\n❌ AI 응답 없음");
            }
          }
        }
      }
    }
  });

  test("4단계: 채널 계정 풀자동화 설정 확인", async ({ page }) => {
    await login(page);

    console.log("📊 채널 계정 설정 확인...");

    const channelsResponse = await page.request.get(`${BASE_URL}/api/channels`);

    if (channelsResponse.ok()) {
      const channelsData = await channelsResponse.json();

      const lineChannel = channelsData.channels?.find(
        (ch: any) => ch.channelType === "line" && ch.accountId === LINE_CHANNEL_ID
      );

      if (lineChannel) {
        console.log("LINE 채널 설정:", {
          id: lineChannel.id,
          accountName: lineChannel.accountName,
          isActive: lineChannel.isActive,
          tenantId: lineChannel.tenantId,
          tenantName: lineChannel.tenantName
        });

        // 거래처 AI 설정 확인
        const tenantsResponse = await page.request.get(`${BASE_URL}/api/tenants`);

        if (tenantsResponse.ok()) {
          const tenantsData = await tenantsResponse.json();

          const tenant = tenantsData.tenants?.find(
            (t: any) => t.id === lineChannel.tenantId
          );

          if (tenant) {
            console.log("\n거래처 AI 설정:", {
              auto_response_enabled: tenant.ai_config?.auto_response_enabled,
              preferred_model: tenant.ai_config?.preferred_model,
              confidence_threshold: tenant.ai_config?.confidence_threshold,
              enabled: tenant.ai_config?.enabled
            });

            if (tenant.ai_config?.auto_response_enabled === false) {
              console.log("\n⚠️  문제 발견: auto_response_enabled가 false입니다!");
            }

            if (tenant.ai_config?.enabled === false) {
              console.log("\n⚠️  문제 발견: AI가 비활성화되어 있습니다!");
            }
          }
        }
      } else {
        console.log("❌ LINE 채널을 찾을 수 없습니다");
      }
    }
  });

  test("5단계: Webhook URL 확인", async ({ page }) => {
    console.log("📊 Webhook endpoint 테스트...");

    // GET 요청으로 endpoint 활성화 상태 확인
    const webhookResponse = await page.request.get(
      `${BASE_URL}/api/webhooks/line`
    );

    console.log(`Webhook GET 응답 상태: ${webhookResponse.status()}`);

    if (webhookResponse.ok()) {
      const data = await webhookResponse.json();
      console.log("Webhook 응답:", data);
    }
  });
});
