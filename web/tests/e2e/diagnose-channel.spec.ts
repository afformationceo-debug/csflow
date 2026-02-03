import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://csflow.vercel.app";
const TEST_EMAIL = "afformation.ceo@gmail.com";
const TEST_PASSWORD = "afformation1!";

test.describe("채널 진단", () => {
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  }

  test("모든 채널 출력", async ({ page }) => {
    await login(page);

    const response = await page.request.get(`${BASE_URL}/api/channels`);
    console.log(`상태: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log("\n📊 전체 채널 데이터:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log("❌ 채널 API 실패");
      const text = await response.text();
      console.log(text);
    }
  });

  test("모든 거래처 출력", async ({ page }) => {
    await login(page);

    const response = await page.request.get(`${BASE_URL}/api/tenants`);
    console.log(`상태: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log("\n📊 전체 거래처 데이터:");
      console.log(JSON.stringify(data.tenants, null, 2));
    } else {
      console.log("❌ 거래처 API 실패");
    }
  });
});
