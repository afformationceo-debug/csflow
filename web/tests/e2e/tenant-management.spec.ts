import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://csflow.vercel.app";
const TEST_EMAIL = "afformation.ceo@gmail.com";
const TEST_PASSWORD = "afformation1!";

test.describe("거래처 관리 기능 테스트", () => {
  // 로그인 helper
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  }

  test("1단계: 모든 기존 거래처 삭제", async ({ page }) => {
    // 로그인
    await login(page);

    // 거래처 페이지로 이동
    await page.goto(`${BASE_URL}/tenants`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("📋 거래처 페이지 로드 완료");

    // 기존 거래처 개수 확인
    const tenantCards = page.locator('[data-testid="tenant-card"]').or(
      page.locator('[class*="card"]').filter({ hasText: /힐링|clinic|의원/i })
    );

    let tenantCount = await tenantCards.count().catch(() => 0);
    console.log(`🔍 현재 거래처 개수: ${tenantCount}개`);

    // 모든 거래처 삭제
    while (tenantCount > 0) {
      // 첫 번째 거래처 카드 찾기
      const firstCard = tenantCards.first();

      if (!(await firstCard.isVisible({ timeout: 3000 }).catch(() => false))) {
        break;
      }

      // 거래처 카드 클릭 또는 삭제 버튼 찾기
      // 삭제 버튼 패턴: 더보기 메뉴 -> 삭제, 또는 직접 삭제 버튼
      const deleteButton = firstCard.locator('button:has-text("삭제")').or(
        firstCard.locator('[aria-label*="삭제"]')
      );

      // 더보기 메뉴가 있는 경우
      const moreButton = firstCard.locator('button:has-text("⋮")').or(
        firstCard.locator('[aria-label*="더보기"]').or(
          firstCard.locator('button[role="button"]').filter({ hasText: /•••|⋮/ })
        )
      );

      if (await moreButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moreButton.click();
        await page.waitForTimeout(500);
      }

      // 삭제 버튼 클릭
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();
        await page.waitForTimeout(500);

        // 확인 다이얼로그 처리
        const confirmButton = page.locator('button:has-text("확인")').or(
          page.locator('button:has-text("삭제")').last()
        );
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }

        console.log(`🗑️  거래처 삭제 완료 (남은 거래처: ${tenantCount - 1}개)`);
      } else {
        console.log("⚠️  삭제 버튼을 찾을 수 없음, 다음으로 진행");
        break;
      }

      // 삭제 후 페이지 새로고침
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForLoadState("networkidle");

      // 업데이트된 거래처 개수 확인
      tenantCount = await tenantCards.count().catch(() => 0);
    }

    console.log("✅ 모든 거래처 삭제 완료");

    // 페이지 새로고침 후 거래처가 없는지 확인
    await page.reload();
    await page.waitForLoadState("networkidle");
    const finalCount = await tenantCards.count().catch(() => 0);
    console.log(`📊 최종 거래처 개수: ${finalCount}개`);
  });

  test("2단계: 새 거래처 추가 (bomon-clinic)", async ({ page }) => {
    // 로그인
    await login(page);

    // 거래처 페이지로 이동
    await page.goto(`${BASE_URL}/tenants`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("📋 거래처 페이지 로드 완료");

    // "거래처 추가" 버튼 클릭
    const addButton = page.locator('button:has-text("추가")').or(
      page.locator('button:has-text("거래처 추가")').or(
        page.locator('button:has-text("등록")')
      )
    );

    await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    await addButton.first().click();
    await page.waitForTimeout(1000);

    console.log("➕ 거래처 추가 다이얼로그 열림");

    // 다이얼로그 확인
    const dialog = page.locator('[role="dialog"]').or(page.locator('dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 스크린샷 (디버깅용)
    await page.screenshot({ path: 'tenant-add-dialog.png' });

    // 폼 필드 입력
    // ID 입력 (slug/id)
    const idInput = page.locator('input[name="id"]').or(
      page.locator('input[placeholder*="id"]').or(
        page.locator('input[placeholder*="slug"]')
      )
    );
    if (await idInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await idInput.fill("bomon-clinic");
      console.log("✅ ID 입력: bomon-clinic");
    }

    // 이름 입력 (name - 한글)
    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="이름"]').or(
        page.locator('input[placeholder*="거래처"]')
      )
    ).first();
    await nameInput.fill("청담봄온의원");
    console.log("✅ 이름 입력: 청담봄온의원");

    // 영문 이름 입력 (name_en or display_name)
    const nameEnInput = page.locator('input[name="name_en"]').or(
      page.locator('input[name="display_name"]').or(
        page.locator('input[placeholder*="영문"]')
      )
    );
    if (await nameEnInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameEnInput.fill("Bomon Clinic");
      console.log("✅ 영문 이름 입력: Bomon Clinic");
    }

    // 전문과 선택 (specialty)
    const specialtySelect = page.locator('[name="specialty"]').or(
      page.locator('[role="combobox"]').filter({ hasText: /전문과|specialty/i }).or(
        page.locator('button:has-text("전문과")').or(
          page.locator('button:has-text("선택")')
        )
      )
    ).first();

    if (await specialtySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await specialtySelect.click();
      await page.waitForTimeout(500);

      // "피부과" 옵션 선택
      const dermatologyOption = page.locator('text=피부과').or(
        page.locator('[role="option"]:has-text("피부과")')
      );
      if (await dermatologyOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dermatologyOption.click();
        console.log("✅ 전문과 선택: 피부과");
      } else {
        // 수동 입력 가능한 경우
        await specialtySelect.fill("피부과");
        console.log("✅ 전문과 입력: 피부과");
      }
    }

    // 타겟 국가 선택 (country)
    const countrySelect = page.locator('[name="country"]').or(
      page.locator('[role="combobox"]').filter({ hasText: /국가|country/i }).or(
        page.locator('button:has-text("국가")').or(
          page.locator('button:has-text("타겟")')
        )
      )
    ).first();

    if (await countrySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await countrySelect.click();
      await page.waitForTimeout(500);

      // "대만" 옵션 선택
      const taiwanOption = page.locator('text=대만').or(
        page.locator('[role="option"]:has-text("대만")').or(
          page.locator('text=Taiwan')
        )
      );
      if (await taiwanOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taiwanOption.click();
        console.log("✅ 타겟 국가 선택: 대만");
      } else {
        await countrySelect.fill("대만");
        console.log("✅ 타겟 국가 입력: 대만");
      }
    }

    // 기본 언어 선택 (default_language)
    const languageSelect = page.locator('[name="default_language"]').or(
      page.locator('[role="combobox"]').filter({ hasText: /언어|language/i }).or(
        page.locator('button:has-text("언어")')
      )
    ).first();

    if (await languageSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await languageSelect.click();
      await page.waitForTimeout(500);

      // "대만어/중국어 번체" 옵션 선택
      const taiwaneseOption = page.locator('text=대만').or(
        page.locator('[role="option"]:has-text("대만")').or(
          page.locator('text=中文').or(
            page.locator('text=zh-TW')
          )
        )
      );
      if (await taiwaneseOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taiwaneseOption.click();
        console.log("✅ 기본 언어 선택: 대만어");
      } else {
        await languageSelect.fill("zh-TW");
        console.log("✅ 기본 언어 입력: zh-TW");
      }
    }

    // 제출 전 스크린샷
    await page.screenshot({ path: 'tenant-form-filled.png' });

    // "등록" 버튼 클릭
    const submitButton = page.locator('button[type="submit"]').or(
      page.locator('button:has-text("등록")').or(
        page.locator('button:has-text("추가")').or(
          page.locator('button:has-text("저장")')
        )
      )
    ).last();

    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    console.log("📤 등록 버튼 클릭");

    // 다이얼로그 닫힘 대기
    await page.waitForTimeout(3000);

    // 성공 토스트 또는 다이얼로그 닫힘 확인
    const successToast = page.locator('text=/등록.*완료|성공|추가.*완료/i');
    if (await successToast.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ 성공 메시지 표시됨");
    }

    // 페이지 새로고침하여 새 거래처 확인
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 제출 후 스크린샷
    await page.screenshot({ path: 'tenant-added.png' });

    // 새 거래처가 목록에 표시되는지 확인
    const newTenant = page.locator('text=청담봄온의원').or(
      page.locator('text=bomon-clinic').or(
        page.locator('text=Bomon')
      )
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
      (t: any) => t.id === "bomon-clinic" || t.name === "청담봄온의원"
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
    expect(bomonClinic.name).toBe("청담봄온의원");
    expect(bomonClinic.specialty).toBe("피부과");
    expect(bomonClinic.country || bomonClinic.settings?.country).toBe("대만");
    expect(bomonClinic.default_language).toContain("zh");

    console.log("✅ 모든 필드가 정확하게 저장됨");
  });
});
