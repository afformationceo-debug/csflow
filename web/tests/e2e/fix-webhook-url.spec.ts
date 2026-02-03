import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://csflow.vercel.app";
const TEST_EMAIL = "afformation.ceo@gmail.com";
const TEST_PASSWORD = "afformation1!";

test.describe("Webhook URL 수정", () => {
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  }

  test("LINE 채널 Webhook URL 수정", async ({ page }) => {
    await login(page);

    console.log("📊 현재 채널 정보 조회...");
    const getResponse = await page.request.get(`${BASE_URL}/api/channels`);
    expect(getResponse.ok()).toBeTruthy();

    const data = await getResponse.json();
    const lineChannel = data.channels?.find((ch: any) => ch.channelType === "line");

    if (!lineChannel) {
      console.log("❌ LINE 채널을 찾을 수 없습니다");
      return;
    }

    console.log("현재 설정:");
    console.log("  Webhook URL:", lineChannel.webhookUrl);
    console.log("  Full Automation:", lineChannel.fullAutomationEnabled);

    // Webhook URL 수정
    const correctWebhookUrl = "https://csflow.vercel.app/api/webhooks/line";

    if (lineChannel.webhookUrl !== correctWebhookUrl) {
      console.log("\n🔧 Webhook URL 수정 중...");

      const patchResponse = await page.request.patch(`${BASE_URL}/api/channels`, {
        data: {
          channelId: lineChannel.id,
          settings: {
            webhook_url: correctWebhookUrl,
          },
        },
      });

      expect(patchResponse.ok()).toBeTruthy();
      console.log("✅ Webhook URL 수정 완료");

      // 확인
      const verifyResponse = await page.request.get(`${BASE_URL}/api/channels`);
      const verifyData = await verifyResponse.json();
      const updated = verifyData.channels?.find((ch: any) => ch.id === lineChannel.id);

      console.log("수정 후 Webhook URL:", updated.webhookUrl);
      expect(updated.webhookUrl).toBe(correctWebhookUrl);
    } else {
      console.log("✅ Webhook URL이 이미 올바르게 설정되어 있습니다");
    }

    // Full Automation 확인 및 수정
    if (!lineChannel.fullAutomationEnabled) {
      console.log("\n🔧 Full Automation 활성화 중...");

      const patchResponse = await page.request.patch(`${BASE_URL}/api/channels`, {
        data: {
          channelId: lineChannel.id,
          settings: {
            full_automation_enabled: true,
          },
        },
      });

      expect(patchResponse.ok()).toBeTruthy();
      console.log("✅ Full Automation 활성화 완료");
    } else {
      console.log("✅ Full Automation이 이미 활성화되어 있습니다");
    }
  });
});
