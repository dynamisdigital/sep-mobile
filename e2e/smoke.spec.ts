import { expect, test } from '@playwright/test';

test('PWA mobile carrega no /', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-app')).toBeVisible();
});
