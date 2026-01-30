import { test, expect } from '@playwright/test';

test('Tenant registration flow', async ({ page }) => {
  // 1. Navigate to tenants page
  await page.goto('https://csflow.vercel.app/tenants');

  // 2. Check if redirected to login
  await expect(page).toHaveURL(/.*login/);

  // 3. Login
  await page.fill('input[type="email"]', 'afformation.ceo@gmail.com');
  await page.fill('input[type="password"]', 'afformation1!');
  await page.click('button[type="submit"]');

  // 4. Wait for dashboard redirect
  await page.waitForURL(/.*tenants/, { timeout: 10000 });

  // 5. Click "거래처 추가" button
  await page.click('text=거래처 추가');

  // 6. Wait for dialog to open
  await expect(page.locator('dialog')).toBeVisible();

  // 7. Fill form
  await page.fill('input[placeholder*="healing-eye"]', 'test-clinic');
  await page.fill('input[placeholder*="힐링안과"]', '테스트 클리닉');

  // 8. Select specialty
  await page.click('[role="combobox"]');
  await page.click('text=안과');

  // 9. Click submit button
  const submitButton = page.locator('button:has-text("등록")');
  await expect(submitButton).toBeEnabled();

  // 10. Take screenshot before click
  await page.screenshot({ path: 'before-submit.png' });

  await submitButton.click();

  // 11. Wait for dialog to close
  await expect(page.locator('dialog')).not.toBeVisible({ timeout: 5000 });

  // 12. Take screenshot after submit
  await page.screenshot({ path: 'after-submit.png' });

  // 13. Verify new tenant appears in list
  await expect(page.locator('text=테스트 클리닉')).toBeVisible();
});
