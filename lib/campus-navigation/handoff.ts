/**
 * Hand off a navigation request to the installed Campus Navigation app.
 *
 * There is no web fallback by design: Campus Navigation is Android + iOS only.
 * When the app cannot be opened the caller shows the store chooser.
 *
 * Detecting "did the app open?" is not directly observable from a browser. The
 * reliable signal is that a successful handoff backgrounds this page, so we
 * race the OS switch against a timer: if the page gets hidden we succeeded, and
 * if the timer wins while we are still visible, nothing handled the scheme.
 */
import { CAMPUS_NAV_HANDOFF_TIMEOUT_MS } from "./config";
import { buildCampusNavAppLink, type CampusNavTarget } from "./deep-link";
import { canAttemptAppHandoff, detectPlatform } from "./platform";

export type HandoffResult = "opened" | "not-installed" | "unsupported-platform";

export async function openInCampusNav(
  target: CampusNavTarget,
): Promise<HandoffResult> {
  const platform = detectPlatform();
  if (!canAttemptAppHandoff(platform)) return "unsupported-platform";
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "unsupported-platform";
  }

  return new Promise<HandoffResult>((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
      window.removeEventListener("blur", onHidden);
    };

    const settle = (result: HandoffResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    // The page losing the foreground is the only reliable "the app opened"
    // signal a browser gets. A bare `blur` counts too: it means an OS
    // "open this app?" prompt took focus, so something handled the scheme.
    function onHidden() {
      settle("opened");
    }

    // Created before the listeners so `cleanup` can always clear it.
    const timer = setTimeout(
      () => settle("not-installed"),
      CAMPUS_NAV_HANDOFF_TIMEOUT_MS,
    );

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    window.addEventListener("blur", onHidden);

    try {
      // Assigning location (rather than window.open) keeps iOS Safari from
      // showing its own "cannot open page" interstitial in most cases, and
      // leaves this tab intact so the install dialog can appear on failure.
      window.location.href = buildCampusNavAppLink(target);
    } catch {
      settle("not-installed");
    }
  });
}
