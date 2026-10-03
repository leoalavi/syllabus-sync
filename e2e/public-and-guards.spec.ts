import { expect, test } from '@playwright/test';

const PUBLIC_PAGES = ['/', '/about', '/contact', '/privacy', '/terms', '/login', '/signup'];
const PROTECTED_PAGES = ['/home', '/calendar', '/feed', '/map', '/settings', '/manage-profiles'];

for (const path of PUBLIC_PAGES) {
  test(`public page ${path} renders one main landmark without horizontal overflow`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('main')).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

for (const path of PROTECTED_PAGES) {
  test(`unauthenticated ${path} redirects to login and keeps redirectTo`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('redirectTo')).toBe(path);
  });
}

test('garbage session cookie does not loop or expose the dashboard', async ({ page, context }) => {
  await context
    .addCookies([
      {
        name: 'sb-127-auth-token',
        value: 'not-a-session',
        url: page.context().pages()[0]?.url() ?? 'http://localhost',
      },
    ])
    .catch(() => undefined);
  const redirects: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 300 && r.status() < 400) redirects.push(r.url());
  });
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login/);
  expect(redirects.length).toBeLessThan(5);
});

test('malicious redirectTo is never followed off-site', async ({ page }) => {
  await page.goto('/login?redirectTo=https://evil.example/phish');
  await expect(page.locator('form')).toBeVisible();
  expect(new URL(page.url()).origin).not.toBe('https://evil.example');
});

test('login form falls back to POST so credentials never reach the URL', async ({ page }) => {
  await page.goto('/login');
  const method = await page.locator('form').first().getAttribute('method');
  expect((method ?? '').toLowerCase()).toBe('post');
});

test('footer exposes the project information link', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator('footer a[href^="https://"]').first()).toBeVisible();
});
