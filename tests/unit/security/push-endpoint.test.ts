import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from '@/lib/security/push-endpoint';

describe('Web Push endpoint boundary', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/token',
    'https://fcmregistrations.googleapis.com/v1/projects/x/registrations/y',
    'https://web.push.apple.com/Q1/token',
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://wns.notify.windows.com/?token=abc',
  ])('accepts a known push service: %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/token',
    'https://localhost/push',
    'https://127.0.0.1/push',
    'https://fcm.googleapis.com.attacker.test/push',
    'https://attacker.test/fcm.googleapis.com/push',
    'https://fcm.googleapis.com:8443/push',
    'https://user:pass@fcm.googleapis.com/push',
  ])('rejects an untrusted destination: %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});
