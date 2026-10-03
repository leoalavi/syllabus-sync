import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT_FORMS = [
  'app/login/LoginClient.tsx',
  'app/signup/SignupClient.tsx',
  'app/reset-password/reset-password-client.tsx',
  'app/onboarding/OnboardingClient.tsx',
  'app/contact/contact-client.tsx',
];

describe('client-handled forms before hydration', () => {
  it.each(CLIENT_FORMS)('%s uses POST as its native fallback', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    const forms = source.match(/<form\b[^>]*>/gs) ?? [];
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      expect(form).toMatch(/\bmethod="post"/);
    }
  });
});
