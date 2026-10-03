/** Browser push services supported by the application's Web Push sender. */
const PUSH_HOSTS = [
  'push.apple.com',
  'fcm.googleapis.com',
  'fcmregistrations.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
] as const;

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    ) {
      return false;
    }

    return PUSH_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}
