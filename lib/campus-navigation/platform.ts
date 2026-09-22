/** Which store listing to highlight. `desktop` means neither app can be opened. */
export type MobilePlatform = "ios" | "android" | "desktop";

/**
 * Best-effort platform detection for choosing which store link to emphasise.
 *
 * Only ever used to *highlight* a choice — both store options stay available —
 * so a wrong guess degrades to a slightly odd ordering, never a dead end.
 */
export function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ reports a desktop Safari UA; the touch-point check catches it.
  const iOSLike =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) &&
      typeof document !== "undefined" &&
      navigator.maxTouchPoints > 1);
  if (iOSLike) return "ios";
  return "desktop";
}

/** Whether a custom-scheme handoff is worth attempting at all. */
export function canAttemptAppHandoff(platform: MobilePlatform): boolean {
  return platform === "ios" || platform === "android";
}
