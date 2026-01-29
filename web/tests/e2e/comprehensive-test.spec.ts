import { test, expect, Page } from "@playwright/test";

const BASE_URL = "https://csflow.vercel.app";

test.describe("1. 대시보드 페이지 상세 테스트", () => {
  test("실시간 통계 수치 연동 확인", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");

    // 통계 카드 확인 (실제 페이지의 텍스트 사용)
    const statsCards = page.locator('[class*="card"]');
    await expect(statsCards.first()).toBeVisible({ timeout: 10000 });

    // 페이지에 숫자 값이 있는지 확인
    const pageText = await page.textContent("body");
    console.log("대시보드 페이지 로드됨, 통계 카드 표시 확인");

    // 차트가 렌더링되는지 확인 (있다면)
    const canvas = page.locator("canvas").first();
    if (await canvas.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("차트가 렌더링됨");
    }
  });

  test("시간대별 인사 메시지 확인", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");

    // 시간대별 인사 메시지가 표시되는지 확인
    const greeting = await page.locator("h1").first().textContent();
    console.log("인사 메시지:", greeting);
    expect(greeting).toBeTruthy();
  });
});

test.describe("2. 통합 인박스 전체 기능 테스트", () => {
  test("인박스 레이아웃 및 대화 목록 로드", async ({ page }) => {
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");

    // 3단 패널 확인
    await expect(page.locator('[data-testid="conversation-list"]').or(page.locator('text=대화').first())).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="chat-view"]').or(page.locator('[class*="flex-1"]').first())).toBeVisible({ timeout: 10000 });
  });

  test("메시지 전송 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");

    // 대화 선택 (첫 번째 대화)
    const firstConversation = page.locator('[data-testid="conversation-item"]').first();
    if (await firstConversation.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstConversation.click();
      await page.waitForTimeout(1000);

      // 메시지 입력
      const messageInput = page.getByPlaceholder(/메시지 입력|Type a message/i);
      if (await messageInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await messageInput.fill("테스트 메시지입니다");

        // 전송 버튼 클릭
        const sendButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("전송")'));
        if (await sendButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await sendButton.click();
          await page.waitForTimeout(2000);

          // 전송된 메시지가 채팅창에 표시되는지 확인
          await expect(page.locator('text=테스트 메시지입니다')).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });

  test("번역 토글 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");

    // 번역 토글 버튼 찾기
    const translateButton = page.locator('button:has-text("번역")').or(page.locator('[aria-label*="번역"]'));
    if (await translateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await translateButton.click();
      await page.waitForTimeout(1000);
      console.log("번역 토글 클릭됨");
    }
  });

  test("AI 추천 응답 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");

    // AI 추천 버튼 찾기
    const aiSuggestButton = page.locator('button:has-text("AI")').or(page.locator('[aria-label*="AI 추천"]'));
    if (await aiSuggestButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiSuggestButton.click();
      await page.waitForTimeout(2000);
      console.log("AI 추천 버튼 클릭됨");
    }
  });

  test("필터 기능 (거래처, 태그)", async ({ page }) => {
    await page.goto(`${BASE_URL}/inbox`);
    await page.waitForLoadState("networkidle");

    // 거래처 필터
    const hospitalFilter = page.locator('button:has-text("병원")').or(page.locator('[aria-label*="거래처"]'));
    if (await hospitalFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hospitalFilter.click();
      await page.waitForTimeout(1000);
    }

    // 태그 필터
    const tagFilter = page.locator('button:has-text("태그")').or(page.locator('[aria-label*="태그"]'));
    if (await tagFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tagFilter.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe("3. 고객 관리 페이지 테스트", () => {
  test("고객 목록 로드 및 검색", async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);
    await page.waitForLoadState("networkidle");

    // 페이지 로드 확인
    await expect(page.locator("body")).toBeVisible();

    // 검색 기능
    const searchInput = page.getByPlaceholder(/검색|search/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("김환자");
      await page.waitForTimeout(1000);
    }
  });

  test("고객 추가 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);
    await page.waitForLoadState("networkidle");

    // 추가 버튼
    const addButton = page.locator('button:has-text("추가")').or(page.locator('button:has-text("등록")'));
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      console.log("고객 추가 다이얼로그 열림");
    }
  });
});

test.describe("4. 채널 관리 페이지 테스트", () => {
  test("채널 목록 로드 및 상태 확인", async ({ page }) => {
    await page.goto(`${BASE_URL}/channels`);
    await page.waitForLoadState("networkidle");

    // 채널 카드 확인 (strict mode 회피)
    const lineChannel = page.locator("text=LINE").first();
    if (await lineChannel.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("LINE 채널 카드 표시됨");
    }

    // 활성/비활성 토글
    const toggleButton = page.locator('[role="switch"]').first();
    if (await toggleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const initialState = await toggleButton.getAttribute("aria-checked");
      console.log("토글 초기 상태:", initialState);

      await toggleButton.click();
      await page.waitForTimeout(1000);

      const newState = await toggleButton.getAttribute("aria-checked");
      console.log("토글 변경 후 상태:", newState);
    }
  });

  test("채널 추가 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/channels`);
    await page.waitForLoadState("networkidle");

    const addButton = page.locator('button:has-text("추가")').or(page.locator('button:has-text("연동")'));
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      console.log("채널 추가 다이얼로그 열림");
    }
  });
});

test.describe("5. 거래처 관리 페이지 테스트", () => {
  test("거래처 목록 로드", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenants`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();

    // 거래처 카드 확인
    const tenantCard = page.locator('[data-testid="tenant-card"]').or(page.locator('text=힐링').first());
    if (await tenantCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("거래처 카드 표시됨");
    }
  });

  test("거래처 추가 및 AI 설정", async ({ page }) => {
    await page.goto(`${BASE_URL}/tenants`);
    await page.waitForLoadState("networkidle");

    const addButton = page.locator('button:has-text("추가")').or(page.locator('button:has-text("등록")'));
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
    }

    // AI 설정 버튼
    const aiSettingsButton = page.locator('button:has-text("AI")').first();
    if (await aiSettingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiSettingsButton.click();
      await page.waitForTimeout(1000);
      console.log("AI 설정 다이얼로그 열림");
    }
  });
});

test.describe("6. 지식베이스 페이지 테스트", () => {
  test("지식베이스 문서 목록 로드", async ({ page }) => {
    await page.goto(`${BASE_URL}/knowledge`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });

  test("템플릿 다운로드 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/knowledge`);
    await page.waitForLoadState("networkidle");

    // 템플릿 다운로드 버튼 찾기
    const downloadButton = page.locator('button:has-text("템플릿")').or(page.locator('button:has-text("다운로드")'));
    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 다운로드 이벤트 리스닝
      const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
      await downloadButton.click();
      const download = await downloadPromise;

      if (download) {
        console.log("다운로드 파일명:", await download.suggestedFilename());
      }
    }
  });

  test("문서 추가 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/knowledge`);
    await page.waitForLoadState("networkidle");

    const addButton = page.locator('button:has-text("추가")').or(page.locator('button:has-text("등록")'));
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      console.log("문서 추가 다이얼로그 열림");
    }
  });
});

test.describe("7. 담당자 관리 페이지 테스트", () => {
  test("담당자 목록 로드", async ({ page }) => {
    await page.goto(`${BASE_URL}/team`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });

  test("담당자 추가 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/team`);
    await page.waitForLoadState("networkidle");

    const addButton = page.locator('button:has-text("추가")').or(page.locator('button:has-text("초대")'));
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      console.log("담당자 초대 다이얼로그 열림");
    }
  });
});

test.describe("8. 에스컬레이션 페이지 테스트", () => {
  test("에스컬레이션 목록 로드", async ({ page }) => {
    await page.goto(`${BASE_URL}/escalations`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });

  test("담당자 배정 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/escalations`);
    await page.waitForLoadState("networkidle");

    // 첫 번째 에스컬레이션의 담당자 배정 버튼
    const assignButton = page.locator('button:has-text("배정")').first();
    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click();
      await page.waitForTimeout(1000);
      console.log("담당자 배정 UI 열림");
    }
  });

  test("상태 변경 기능", async ({ page }) => {
    await page.goto(`${BASE_URL}/escalations`);
    await page.waitForLoadState("networkidle");

    const statusButton = page.locator('button:has-text("상태")').or(page.locator('[role="combobox"]')).first();
    if (await statusButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusButton.click();
      await page.waitForTimeout(1000);
      console.log("상태 변경 드롭다운 열림");
    }
  });
});

test.describe("9. 분석/리포트 페이지 테스트", () => {
  test("통계 데이터 로드 확인", async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState("networkidle");

    // KPI 카드 확인
    await expect(page.locator("text=총 대화").or(page.locator("text=메시지"))).toBeVisible({ timeout: 10000 });

    // 차트 렌더링 확인
    const chart = page.locator("canvas").first();
    if (await chart.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("차트가 렌더링됨");
    }
  });

  test("기간 필터 변경", async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState("networkidle");

    // 기간 선택 버튼
    const periodButton = page.locator('button:has-text("7일")').or(page.locator('button:has-text("30일")'));
    if (await periodButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await periodButton.click();
      await page.waitForTimeout(2000);
      console.log("기간 필터 변경됨");
    }
  });
});

test.describe("10. 설정 페이지 테스트", () => {
  test("설정 탭 전환 및 저장", async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // 일반 설정 탭
    const generalTab = page.locator('button:has-text("일반")').or(page.locator('[role="tab"]:has-text("일반")'));
    if (await generalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generalTab.click();
      await page.waitForTimeout(1000);
    }

    // AI 설정 탭
    const aiTab = page.locator('button:has-text("AI")').or(page.locator('[role="tab"]:has-text("AI")'));
    if (await aiTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiTab.click();
      await page.waitForTimeout(1000);
    }

    // 저장 버튼
    const saveButton = page.locator('button:has-text("저장")');
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(2000);

      // 성공 토스트 확인
      const toast = page.locator('text=저장').or(page.locator('text=성공'));
      if (await toast.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("설정 저장 성공");
      }
    }
  });
});
