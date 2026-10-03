/** Only the team's public project sites are supported by the header diagnostic. */
const APPROVED_SCAN_HOSTS = new Set(['www.syllabus-sync.app', 'info.syllabus-sync.app']);

export function validateHeaderScanTarget(
  rawUrl: string,
): { valid: true; url: string } | { valid: false; message: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, message: 'Invalid URL format' };
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    !APPROVED_SCAN_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    return {
      valid: false,
      message: 'Only approved Syllabus Sync site origins can be scanned',
    };
  }

  return { valid: true, url: parsed.origin + '/' };
}
