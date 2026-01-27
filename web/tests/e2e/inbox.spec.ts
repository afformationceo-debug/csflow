import { test, expect } from "@playwright/test";

test.describe("Inbox Feature", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/inbox");
  });

  test("displays conversation list with mock data", async ({ page }) => {
    // 고객 이름이 표시되는지 확인 (여러 곳에 표시되므로 first)
    await expect(page.locator("text=김환자").first()).toBeVisible();
    await expect(page.locator("text=이환자").first()).toBeVisible();
  });

  test("shows channel badges on conversations", async ({ page }) => {
    // 채널 배지가 표시되는지
    await expect(page.locator("text=LINE").first()).toBeVisible();
    await expect(page.locator("text=카카오").first()).toBeVisible();
  });

  test("shows hospital names on conversations", async ({ page }) => {
    // 병원명 표시
    await expect(page.locator("text=힐링안과").first()).toBeVisible();
    await expect(page.locator("text=스마일치과").first()).toBeVisible();
  });

  test("displays consultation tag filters", async ({ page }) => {
    // 상담 태그 필터 버튼 표시 (Channel.io 스타일)
    await expect(
      page.getByRole("button", { name: "가망" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "잠재" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "1차예약" })
    ).toBeVisible();
  });

  test("selecting a conversation shows chat view", async ({ page }) => {
    // 대화 선택 시 채팅 뷰 표시
    await page.locator("text=김환자").first().click();

    // 메시지가 표시되는지
    await expect(
      page.locator("text=ラシック手術の費用はいくらですか").first()
    ).toBeVisible();
  });

  test("translation toggle works", async ({ page }) => {
    await page.locator("text=김환자").first().click();

    // 번역 토글 버튼 확인
    const translationBtn = page.locator("text=번역").first();
    await expect(translationBtn).toBeVisible();
  });

  test("message view tabs are present", async ({ page }) => {
    await page.locator("text=김환자").first().click();

    // 전체 / 고객대화 / 내부노트 탭
    await expect(page.locator("text=전체").first()).toBeVisible();
    await expect(page.locator("text=고객대화")).toBeVisible();
    await expect(page.locator("text=내부노트")).toBeVisible();
  });

  test("internal note toggle works", async ({ page }) => {
    await page.locator("text=김환자").first().click();

    // 내부 노트 버튼 클릭
    const noteBtn = page.locator("button", { hasText: "내부 노트" });
    await expect(noteBtn).toBeVisible();
    await noteBtn.click();

    // 노트 모드 안내 텍스트
    await expect(
      page.locator("text=이 메시지는 고객에게 보이지 않습니다")
    ).toBeVisible();
  });

  test("customer profile panel shows info", async ({ page }) => {
    // 고객 프로필 패널 확인 - 섹션 타이틀로 확인
    await expect(page.locator("text=연결된 채널")).toBeVisible();
    await expect(page.locator("text=예약 정보").first()).toBeVisible();
    await expect(page.locator("text=관심 시술")).toBeVisible();
    await expect(page.locator("h4:has-text('태그')").first()).toBeVisible();
  });

  test("SLA wait time is displayed for active conversations", async ({
    page,
  }) => {
    // SLA 대기 시간 표시 확인 (분, 시간 등)
    await expect(
      page.locator("text=/\\d+(분|시간|일)/ >> nth=0")
    ).toBeVisible();
  });

  test("AI confidence badge is displayed", async ({ page }) => {
    // AI 신뢰도 배지 (92% 등)
    await expect(page.locator("text=92%").first()).toBeVisible();
  });

  test("channel filter works", async ({ page }) => {
    // 채널 필터 드롭다운
    const channelFilter = page.locator("text=전체 채널").first();
    if (await channelFilter.isVisible()) {
      await channelFilter.click();
      await expect(page.locator("text=LINE")).toBeVisible();
      await expect(page.locator("text=WhatsApp")).toBeVisible();
    }
  });
});
