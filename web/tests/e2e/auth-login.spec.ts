import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://csflow.vercel.app";
const TEST_EMAIL = "afformation.ceo@gmail.com";
const TEST_PASSWORD = "afformation1!";

test.describe("인증 및 로그인 플로우", () => {
  test("로그인 페이지 접근 및 UI 확인", async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // 페이지 제목 확인
    await expect(page).toHaveURL(/.*login/);

    // 로그인 폼 요소 확인
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    console.log("✓ 로그인 페이지 UI 정상");
  });

  test("유효한 계정으로 로그인 성공", async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // 로그인 폼 작성
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    // 로그인 버튼 클릭
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // 대시보드로 리다이렉트 확인 (최대 15초 대기)
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });

    // URL이 대시보드인지 확인
    expect(page.url()).toContain("dashboard");

    console.log("✓ 로그인 성공 - 대시보드로 리다이렉트됨");
  });

  test("로그인 후 대시보드 UI 및 데이터 로드", async ({ page }) => {
    // 로그인
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });

    // 대시보드 로드 완료 대기
    await page.waitForLoadState("networkidle");

    // 인사 메시지 확인 (시간대별)
    const greeting = page.locator("h1, h2").first();
    await expect(greeting).toBeVisible({ timeout: 10000 });
    const greetingText = await greeting.textContent();
    console.log("인사 메시지:", greetingText);

    // 통계 카드 확인
    const statsCards = page.locator('[class*="card"]');
    const cardCount = await statsCards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log(`✓ 통계 카드 ${cardCount}개 표시됨`);

    // 네비게이션 메뉴 확인
    const navItems = ["대시보드", "인박스", "고객", "거래처"];
    for (const item of navItems) {
      const navLink = page.locator(`text=${item}`).first();
      if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`✓ 네비게이션: ${item}`);
      }
    }

    console.log("✓ 대시보드 UI 정상 로드");
  });

  test("잘못된 비밀번호로 로그인 실패", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // 잘못된 비밀번호 입력
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', "wrongpassword123");
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 또는 로그인 페이지 유지 확인 (5초 대기)
    await page.waitForTimeout(5000);

    // 여전히 로그인 페이지에 있거나 에러 메시지가 표시되어야 함
    const currentUrl = page.url();
    const isStillOnLogin = currentUrl.includes("login");
    const errorMessage = page.locator('text=/오류|에러|실패|Invalid|Error/i').first();
    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isStillOnLogin || hasError).toBeTruthy();
    console.log("✓ 잘못된 비밀번호 - 로그인 실패 처리됨");
  });

  test("존재하지 않는 이메일로 로그인 실패", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // 존재하지 않는 이메일 입력
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.fill('input[type="password"]', "somepassword");
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 또는 로그인 페이지 유지 확인
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const isStillOnLogin = currentUrl.includes("login");
    const errorMessage = page.locator('text=/오류|에러|실패|Invalid|Error|존재하지 않는/i').first();
    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isStillOnLogin || hasError).toBeTruthy();
    console.log("✓ 존재하지 않는 이메일 - 로그인 실패 처리됨");
  });

  test("로그인 후 세션 유지 확인", async ({ page }) => {
    // 로그인
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });

    // 쿠키/세션 확인
    const cookies = await page.context().cookies();
    const hasAuthCookie = cookies.some(
      (cookie) =>
        cookie.name.includes("auth") ||
        cookie.name.includes("session") ||
        cookie.name.includes("supabase")
    );
    expect(hasAuthCookie).toBeTruthy();
    console.log("✓ 인증 세션 쿠키 설정됨");

    // 다른 페이지로 이동 후에도 인증 유지 확인
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");

    // 로그인 페이지로 리다이렉트되지 않아야 함
    const currentUrl = page.url();
    expect(currentUrl).not.toContain("login");
    console.log("✓ 페이지 이동 후에도 세션 유지");
  });

  test("보호된 페이지 접근 시 로그인 리다이렉트", async ({ page }) => {
    // 로그아웃 상태에서 보호된 페이지 접근
    await page.goto(`${BASE_URL}/tenants`);
    await page.waitForLoadState("networkidle");

    // 로그인 페이지로 리다이렉트되어야 함
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
    console.log("✓ 비인증 상태 - 로그인 페이지로 리다이렉트");
  });
});
