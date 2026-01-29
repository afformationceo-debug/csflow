import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log("\n=== 1. 에스컬레이션 API 직접 확인 ===");
  await page.goto('https://csflow.vercel.app/escalations');
  await page.waitForTimeout(5000);

  // API 데이터 확인
  const response = await page.evaluate(async () => {
    const res = await fetch('/api/escalations?status=all&limit=5');
    const data = await res.json();
    return data;
  });

  console.log("\nAPI 응답 (첫 3개 에스컬레이션):");
  if (response.escalations) {
    response.escalations.slice(0, 3).forEach((esc, i) => {
      console.log(`\n에스컬레이션 ${i + 1}:`);
      console.log(`  ID: ${esc.id.substring(0, 8)}...`);
      console.log(`  고객: ${esc.customer.name}`);
      console.log(`  고객 질문: ${esc.customerQuestion}`);
      console.log(`  이유: ${esc.reason}`);
    });
  }

  // 화면에 표시된 고객 질문 확인
  await page.waitForTimeout(2000);
  const displayedQuestions = await page.evaluate(() => {
    const questions = [];
    // 고객 질문 섹션 찾기
    const questionSections = Array.from(document.querySelectorAll('*')).filter(el => {
      return el.textContent?.includes('고객 질문') || el.textContent?.includes('Customer Question');
    });

    questionSections.forEach(section => {
      const parent = section.closest('div');
      if (parent) {
        const text = parent.textContent?.replace(/고객 질문|Customer Question/g, '').trim();
        if (text && text.length > 5) {
          questions.push(text.substring(0, 150));
        }
      }
    });

    return questions;
  });

  console.log("\n화면에 표시된 고객 질문:");
  displayedQuestions.forEach((q, i) => {
    console.log(`  ${i + 1}. ${q}`);
  });

  await page.screenshot({ path: '/tmp/escalations-page.png', fullPage: true });
  console.log("\n스크린샷: /tmp/escalations-page.png");

  console.log("\n=== 2. 인박스 페이지 테스트 ===");
  await page.goto('https://csflow.vercel.app/inbox');
  await page.waitForTimeout(5000);

  // 첫 번째 대화 클릭
  const firstConversation = await page.$('[role="button"]');
  if (firstConversation) {
    await firstConversation.click();
    await page.waitForTimeout(3000);

    // 메시지 내용 확인
    const messages = await page.evaluate(() => {
      const msgs = [];
      document.querySelectorAll('[class*="message"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 10) {
          msgs.push({
            text: text.substring(0, 100),
            hasTranslation: text.includes('번역') || text.includes('원문')
          });
        }
      });
      return msgs;
    });

    console.log("\n인박스 메시지 (처음 5개):");
    messages.slice(0, 5).forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.text}`);
      console.log(`     번역 표시: ${msg.hasTranslation ? '있음' : '없음'}`);
    });
  }

  await page.screenshot({ path: '/tmp/inbox-page.png', fullPage: true });
  console.log("\n스크린샷: /tmp/inbox-page.png");

  console.log("\n브라우저 열림 - 60초간 직접 확인하세요...");
  console.log("문제를 발견하면 Ctrl+C로 종료하고 알려주세요.");
  await page.waitForTimeout(60000);

  await browser.close();
})();
