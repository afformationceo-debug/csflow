import { test, expect } from "@playwright/test";

test.describe("Dashboard Pages Render", () => {
  test("inbox page loads with conversation list", async ({ page }) => {
    await page.goto("/inbox");

    // 검색 입력이 렌더링되는지 확인
    await expect(
      page.getByPlaceholder("고객, 메시지 검색")
    ).toBeVisible();
    // 필터가 보이는지 확인
    await expect(page.locator("text=전체").first()).toBeVisible();
  });

  test("dashboard page loads with stats", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
    // 대시보드 페이지가 에러 없이 렌더링되는지
    await expect(page.locator("text=대시보드").first()).toBeVisible();
  });

  test("analytics page loads", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=분석").first()).toBeVisible();
  });

  test("escalations page loads", async ({ page }) => {
    await page.goto("/escalations");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=에스컬레이션").first()).toBeVisible();
  });

  test("knowledge page loads", async ({ page }) => {
    await page.goto("/knowledge");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=지식").first()).toBeVisible();
  });

  test("channels page loads", async ({ page }) => {
    await page.goto("/channels");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=채널").first()).toBeVisible();
  });

  test("tenants page loads", async ({ page }) => {
    await page.goto("/tenants");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=거래처").first()).toBeVisible();
  });

  test("team page loads", async ({ page }) => {
    await page.goto("/team");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=담당자").first()).toBeVisible();
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=설정").first()).toBeVisible();
  });
});
