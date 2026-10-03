import { expect, test } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('authenticated journeys (need E2E_EMAIL and E2E_PASSWORD for a disposable test account)', () => {
  test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD not set');

  test('sign in honours redirectTo, persists across reload, and signs out', async ({ page }) => {
    await page.goto('/login?redirectTo=/calendar');
    await page.getByLabel(/email/i).fill(email!);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(password!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/calendar/, { timeout: 20_000 });

    await page.reload();
    await expect(page).toHaveURL(/\/calendar/);

    for (const path of ['/home', '/feed', '/map', '/settings']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('main')).toHaveCount(1);
    }

    await page.context().clearCookies();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/);
  });
});
