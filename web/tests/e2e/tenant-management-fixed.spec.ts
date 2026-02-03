import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://csflow.vercel.app";
const TEST_EMAIL = "afformation.ceo@gmail.com";
const TEST_PASSWORD = "afformation1!";

// 순차 실행을 위해 serial 모드 사용
test.describe.configure({ mode: "serial" });

test.describe("거래처 관리 기능 - 수정된 테스트", () => {
  // 로그인 helper
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  }

  test("1단계: API로 모든 거래처 삭제", async ({ page }) => {
    // 로그인
    await login(page);

    // API로 모든 거래처 조회
    const response = await page.request.get(`${BASE_URL}/api/tenants`);
    const data = await response.json();

    console.log(`📊 현재 거래처 개수: ${data.tenants?.length || 0}개`);

    if (data.tenants && data.tenants.length > 0) {
      // 모든 거래처 삭제
      for (const tenant of data.tenants) {
        await page.request.delete(`${BASE_URL}/api/tenants?id=${tenant.id}`);
        console.log(`🗑️  거래처 삭제: ${tenant.name || tenant.id}`);
      }
    }

    // 삭제 확인
    const checkResponse = await page.request.get(`${BASE_URL}/api/tenants`);
    const checkData = await checkResponse.json();
    console.log(`✅ 삭제 후 거래처 개수: ${checkData.tenants?.length || 0}개`);

    expect(checkData.tenants?.length || 0).toBe(0);
  });

  test("2단계: 새 거래처 추가 (bomon-clinic)", async ({ page }) => {
    // 로그인
    await login(page);

    // 거래처 페이지로 이동
    await page.goto(`${BASE_URL}/tenants`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("📋 거래처 페이지 로드 완료");

    // "거래처 추가" 버튼 클릭 (거래처가 없을 때는 2개의 버튼이 있으므로 첫 번째 선택)
    const addButton = page.locator('button:has-text("거래처 추가")').or(
      page.locator('button:has-text("첫 거래처 추가하기")')
    );
    await addButton.first().click();
    await page.waitForTimeout(1000);

    console.log("➕ 거래처 추가 다이얼로그 열림");

    // 다이얼로그 확인
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 1. 거래처 ID (영문) 입력
    const nameLabel = page.locator('label:has-text("거래처 ID")');
    const nameInput = page.locator('input[placeholder*="healing-eye"]');
    await nameInput.fill("bomon-clinic");
    console.log("✅ 거래처 ID 입력: bomon-clinic");

    // 2. 표시 이름 입력
    const displayNameInput = page.locator('input[placeholder*="힐링안과"]');
    await displayNameInput.fill("청담봄온의원");
    console.log("✅ 표시 이름 입력: 청담봄온의원");

    // 3. 진료과목 선택 (Select 컴포넌트)
    const specialtySelect = dialog.locator('[role="combobox"]').first();
    await specialtySelect.click();
    await page.waitForTimeout(500);

    // "피부과" 옵션 선택 (value="dermatology")
    const dermatologyOption = page.locator('[role="option"]').filter({ hasText: "피부과" });
    await dermatologyOption.click();
    console.log("✅ 진료과목 선택: 피부과");
    await page.waitForTimeout(500);

    // 4. 국가 입력
    const countryInput = page.locator('input[placeholder*="일본, 대만, 베트남"]');
    await countryInput.fill("대만");
    console.log("✅ 국가 입력: 대만");

    // 5. 기본 언어 선택 (Select 컴포넌트)
    // 두 번째 combobox (첫 번째는 진료과목, 두 번째는 기본 언어)
    const languageSelect = dialog.locator('[role="combobox"]').nth(1);
    await languageSelect.click();
    await page.waitForTimeout(500);

    // "中文 (台灣)" 옵션 선택 (value="zh-tw")
    const taiwaneseOption = page.locator('[role="option"]').filter({ hasText: /台灣|臺灣/ });
    await taiwaneseOption.click();
    console.log("✅ 기본 언어 선택: 中文 (台灣)");
    await page.waitForTimeout(500);

    // 스크린샷 (디버깅용)
    await page.screenshot({ path: 'tenant-form-completed.png', fullPage: true });

    // "등록" 버튼 클릭
    const submitButton = dialog.locator('button[type="submit"]').or(
      dialog.locator('button:has-text("등록")')
    );
    await submitButton.click();
    console.log("📤 등록 버튼 클릭");

    // 다이얼로그 닫힘 대기
    await page.waitForTimeout(3000);

    // 성공 메시지 확인
    const successToast = page.locator('text=/등록.*완료|성공|추가.*완료/i');
    if (await successToast.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("✅ 성공 메시지 표시됨");
    }

    // 페이지 새로고침
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 스크린샷
    await page.screenshot({ path: 'tenant-list-after-add.png', fullPage: true });

    // 새 거래처가 목록에 표시되는지 확인
    const newTenant = page.locator('text=청담봄온의원').or(
      page.locator('text=bomon-clinic')
    );

    await expect(newTenant.first()).toBeVisible({ timeout: 10000 });
    console.log("✅ 새 거래처 '청담봄온의원' 목록에서 확인됨");
  });

  test("3단계: Supabase 데이터 확인 (API 통해)", async ({ page }) => {
    // 로그인
    await login(page);

    // API를 통해 거래처 데이터 확인
    const response = await page.request.get(`${BASE_URL}/api/tenants`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    console.log("📊 API 응답:", JSON.stringify(data, null, 2));

    expect(data.tenants).toBeDefined();

    // bomon-clinic 거래처 찾기
    const bomonClinic = data.tenants.find(
      (t: any) => t.name === "bomon-clinic" || t.display_name === "청담봄온의원"
    );

    expect(bomonClinic).toBeDefined();
    console.log("✅ Supabase에 거래처 데이터 확인됨:");
    console.log({
      id: bomonClinic?.id,
      name: bomonClinic?.name,
      display_name: bomonClinic?.display_name,
      specialty: bomonClinic?.specialty,
      country: bomonClinic?.country,
      default_language: bomonClinic?.default_language,
    });

    // 필드 검증
    expect(bomonClinic.name).toBe("bomon-clinic");
    expect(bomonClinic.display_name).toBe("청담봄온의원");
    expect(bomonClinic.specialty).toBe("dermatology");
    expect(bomonClinic.country).toBe("대만");
    expect(bomonClinic.default_language).toBe("zh-tw");

    console.log("✅ 모든 필드가 정확하게 저장됨");
  });
});
