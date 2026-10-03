# Development dependency advisory status

The production dependency audit (`npm audit --omit=dev --audit-level high`) reports zero vulnerabilities as of 2026-10-03. The full audit reports five high-severity package entries in one development-only chain:

`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`.

The reported `braces` issue is stack exhaustion from deeply nested patterns. These packages run in lint tooling, not in the deployed application bundle. `npm audit fix --force` proposes downgrading the Next.js ESLint plugin and config to 14.2.35, which is a breaking major mismatch with the app's Next.js 16 line. Do not apply that downgrade solely to clear the audit count. Recheck upstream patched versions and the full audit during routine dependency updates.

Vitest and Wrangler were updated to patched releases within their major lines, and the remaining compatible transitive audit fixes were applied. `npm ci` lockfile consistency, tests and both production builds are part of the validation gate.
