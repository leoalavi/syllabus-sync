export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

export function matchesBearerToken(
  authorizationHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  if (!authorizationHeader || !expectedToken) {
    return false;
  }

  const expectedHeader = `Bearer ${expectedToken}`;
  return secureCompare(authorizationHeader, expectedHeader);
}
