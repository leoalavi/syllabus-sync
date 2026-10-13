import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

// One sign-in per browser project, reused by every test below, keeps a full run
// to a handful of attempts (the login limiter allows 50 per 15 min per
// IP + email). The account must be a disposable, email-verified test account
// without MFA. Sign-out runs last because it ends the shared session.
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, redirectTo = '/home') {
  await page.goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel(/email/i).fill(email!);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(password!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

test.describe('authenticated journeys (need E2E_EMAIL and E2E_PASSWORD for a disposable test account)', () => {
  test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD not set');

  let page: Page;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`${new URL(page.url()).pathname}: ${m.text()}`);
    });
    page.on('response', (r) => {
      const url = new URL(r.url());
      if (r.status() >= 400 && url.origin === new URL(page.url()).origin) {
        failedRequests.push(`${r.status()} ${url.pathname}`);
      }
    });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('wrong password is rejected with a generic error and no session', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/login');
    await p.getByLabel(/email/i).fill(email!);
    await p
      .getByLabel(/password/i)
      .first()
      .fill(`${password}-definitely-wrong`);
    await p.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(p.getByText('Invalid email or password')).toBeVisible({ timeout: 20_000 });
    await expect(p).toHaveURL(/\/login/);
    const me = await (await p.request.get('/api/auth/user')).json();
    expect(me.data.user).toBeNull();
    await ctx.close();
  });

  test('sign in honours redirectTo and persists across reload', async () => {
    await signIn(page, '/calendar');
    await expect(page).toHaveURL(/\/calendar/, { timeout: 20_000 });

    await page.reload();
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('main pages load for a signed-in user', async () => {
    for (const path of ['/home', '/calendar', '/feed', '/map', '/settings', '/manage-profiles']) {
      await page.goto(path);
      await expect(page, `${path} should not bounce to login`).not.toHaveURL(/\/login/);
      await expect(page.locator('main')).toHaveCount(1);
    }
  });

  test('signed-in users are sent past the main, login and signup pages', async () => {
    for (const path of ['/', '/login', '/signup']) {
      await page.goto(path);
      await expect(page, `${path} should lead to /home`).toHaveURL(/\/home/, { timeout: 20_000 });
    }
  });

  test('authenticated APIs return this user’s data', async () => {
    const me = await (await page.request.get('/api/auth/user')).json();
    expect(me.data.user?.email?.toLowerCase()).toBe(email!.toLowerCase());

    for (const path of [
      '/api/profiles',
      '/api/units',
      '/api/deadlines',
      '/api/todos',
      '/api/events',
      '/api/notifications',
      '/api/user-preferences',
      '/api/gamification',
      '/api/auth/mfa/status',
      '/api/auth/sessions',
    ]) {
      const res = await page.request.get(path);
      expect(res.status(), `${path} should succeed when signed in`).toBe(200);
    }

    const gamification = await (await page.request.get('/api/gamification')).json();
    expect(gamification.data.isDemo, 'signed-in users should get real, not demo, data').toBeFalsy();

    const weather = await page.request.get('/api/weather?lat=-33.7738&lon=151.1126');
    expect(weather.status()).toBe(200);
  });

  test('signed-in pages produce no console errors or failed requests', async () => {
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    expect(failedRequests, failedRequests.join('\n')).toEqual([]);
  });

  test('Sign out from the header ends the session on this device', async () => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Open profile menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    const me = await (await page.request.get('/api/auth/user')).json();
    expect(me.data.user).toBeNull();
    expect((await page.request.get('/api/todos')).status()).toBe(401);

    await page.goto('/home');
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fhome/);
  });
});
