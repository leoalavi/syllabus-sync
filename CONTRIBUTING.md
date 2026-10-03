# Contributing to Syllabus Sync

Thank you for your interest in contributing to Syllabus Sync. This document describes our development standards, contribution workflow, and quality expectations. Contributions should be correct, secure, maintainable, and small enough to review.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Contribution Workflow](#contribution-workflow)
- [Code Standards](#code-standards)
- [Quality Gate](#quality-gate)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Conventions](#commit-conventions)
- [Architecture Constraints](#architecture-constraints)
- [Security Requirements](#security-requirements)
- [Issue and Discussion Guidelines](#issue-and-discussion-guidelines)
- [AI-Assisted Contributions](#ai-assisted-contributions)

---

## Getting Started

1. **Read first.** Before writing any code, review:
   - [`AGENTS.md`](./AGENTS.md) -- architectural constraints and conventions.
   - [`CHANGELOG.md`](./CHANGELOG.md) -- recent changes and context.
   - [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md) -- system design.

2. **Check existing work.** Search open issues and pull requests to avoid duplicate effort.

3. **Discuss before building.** For non-trivial changes (new features, architectural modifications, database schema changes), open a GitHub Discussion or Issue first. We will help you scope the work and avoid wasted effort.

---

## Development Environment

### Prerequisites

| Requirement  | Version                     |
| ------------ | --------------------------- |
| Node.js      | `>=22 <23`                  |
| npm          | `>=10`                      |
| Supabase CLI | Only needed for schema work |
| Git          | `>=2.40`                    |

### Setup

```bash
git clone https://github.com/leoalavi/syllabus-sync.git
cd syllabus-sync
npm ci
cp .env.example .env.local
# Set the required Supabase values; add optional integration keys only when needed
npm run dev
```

Full environment configuration guide: [`docs/operations/ENVIRONMENT_SETUP.md`](./docs/operations/ENVIRONMENT_SETUP.md).

Use a dedicated test Supabase project. Review migrations before applying them; `npx supabase db push` changes the linked project's schema. Never include credentials, student data, or private security findings in a public issue or PR.

For database work, the minimum safe sequence is:

```bash
npx supabase link --project-ref <your-dev-project-ref>
npx supabase db push
```

Contributor docs intentionally assume **non-production** infrastructure. `npm run build`, `npm run cf:build`, and anonymous Playwright flows can run with dummy public environment values; authenticated local flows need a disposable test account, not production credentials.

---

## Contribution Workflow

We follow a fork-and-branch model.

```
1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes (small, focused commits)
4. Run `npm run check` -- all gates must pass
5. Push your branch and open a Pull Request
6. Address review feedback
7. Maintainer merges after approval
```

### Branch Naming

Use descriptive, prefixed branch names:

| Prefix      | Purpose                               | Example                         |
| ----------- | ------------------------------------- | ------------------------------- |
| `feat/`     | New functionality                     | `feat/offline-calendar-sync`    |
| `fix/`      | Bug fix                               | `fix/auth-race-condition`       |
| `refactor/` | Code improvement (no behavior change) | `refactor/extract-map-hooks`    |
| `docs/`     | Documentation only                    | `docs/api-reference-update`     |
| `test/`     | Test additions or fixes               | `test/notification-integration` |
| `chore/`    | Tooling, dependencies, CI             | `chore/upgrade-vitest`          |

---

## Code Standards

### TypeScript

- **Strict mode is mandatory.** The project enforces `strict: true` in `tsconfig.json`.
- **Zero `any` policy.** Never use `any`. Use `unknown` and narrow with type guards, or define proper interfaces.
- **Explicit return types** on exported functions and API route handlers.

### React and Next.js

- **App Router only.** We use the Next.js App Router exclusively. Do not create `pages/` routes.
- **Server Components by default.** Only add `"use client"` at the leaf node where interactivity is required. Data fetching and layout belong in Server Components.
- **Tailwind CSS only.** Use the project's semantic design tokens (e.g., `bg-mq-card-background`, `text-mq-primary`) defined in `tailwind.config.ts`. Do not use hardcoded hex values or inline `style` attributes.
- **Zustand for global state.** Complex state mutations must use optimistic UI patterns with additive server merging.

### File Organization

- Feature code lives in `features/` (e.g., `features/calendar/`, `features/map/`).
- Shared utilities live in `lib/`.
- Reusable UI components live in `components/`.
- API route handlers live in `app/api/`.

### Code Style

- Prettier handles all formatting. Do not override or disable rules.
- ESLint must return zero errors and zero warnings.
- Maximum component size: aim for under 300 lines. Extract sub-components and custom hooks when files grow beyond this.

---

## Quality Gate

Before opening a PR, you **must** run the full quality pipeline:

```bash
npm run check
```

This executes the following stages in order:

| Stage        | Tool                               | What It Checks                                           |
| ------------ | ---------------------------------- | -------------------------------------------------------- |
| Secrets scan | `tools/security/check-secrets.mjs` | No API keys, tokens, or credentials in source            |
| Format       | Prettier                           | Consistent code style across the entire codebase         |
| Type check   | `tsc --noEmit`                     | Strict TypeScript compliance, zero errors                |
| Lint         | ESLint                             | Code quality rules, zero errors, zero warnings           |
| Test         | Vitest                             | All unit and integration tests pass                      |
| Build        | `next build`                       | Next.js build succeeds; Cloudflare packaging is separate |

**If any stage fails, your PR will not be reviewed.** Fix all issues locally before pushing.

Changes to the Worker or runtime should also pass `npm run cf:build` and `npm run cf:verify-output`. Deployment is maintainer controlled; contributors should not deploy the shared production Worker.

Documentation-only changes should also pass the local link checker:

```bash
node tools/docs/check-local-links.mjs
```

---

## Testing Requirements

Every contribution that changes behavior must include tests.

### What to Test

| Change Type         | Required Testing                                                                  |
| ------------------- | --------------------------------------------------------------------------------- |
| New utility or hook | Unit test covering primary paths and edge cases                                   |
| New API route       | Integration test for success, auth failure, validation failure, and rate limiting |
| Bug fix             | Regression test proving the fix and preventing recurrence                         |
| UI component        | Render test verifying key states (loading, error, empty, populated)               |

### Test Conventions

- Test files live in `tests/` mirroring the source directory structure.
- Use Vitest and Testing Library.
- Mock external dependencies (Supabase, browser APIs) using the patterns established in `tests/setup.ts`.
- Prefer testing behavior over implementation details.
- Name test files `<ModuleName>.test.ts` or `<ComponentName>.test.tsx`.

### Running Tests

```bash
# Run the full suite
npm test

# Run a specific test file
npx vitest run tests/path/to/file.test.ts

# Run tests in watch mode during development
npx vitest tests/path/to/file.test.ts
```

### End-to-End Testing

```bash
# Runs Playwright with the checked-in config
npm run test:e2e
```

- `config/playwright.config.ts` starts a local `next dev` server with dummy public Supabase values when `E2E_BASE_URL` is unset.
- Anonymous flows do not require secrets.
- Authenticated specs are skipped unless `E2E_EMAIL` and `E2E_PASSWORD` are set for a **disposable** test account.
- `E2E_BASE_URL` is optional when you want Playwright to target an already-running non-production environment.

---

## Pull Request Process

### PR Requirements

1. **Title:** Use a conventional commit prefix (e.g., `feat(calendar): add recurring event support`).
2. **Description:** Clearly explain:
   - **What** changed and **why**.
   - How to test or verify the change.
   - Screenshots or recordings for UI changes.
3. **Scope:** Keep PRs focused. One logical change per PR. If you find an unrelated issue while working, file a separate issue.
4. **Quality gate output:** Confirm `npm run check` passes. The CI pipeline will verify this independently.
5. **Changelog:** For significant changes, add an entry to `CHANGELOG.md` describing the scope, files changed, and verification approach.

### Review Process

- At least one maintainer must approve before merge.
- Reviewers will evaluate correctness, security implications, test coverage, and adherence to architectural conventions.
- Address all review comments. If you disagree with feedback, explain your reasoning -- we value constructive technical discussion.
- PRs that go stale for more than 14 days without response may be closed.

### After Merge

- The maintainer team handles deployment.
- If your change requires environment variable additions or database migrations, document them clearly in the PR description.

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | When to Use                                |
| ---------- | ------------------------------------------ |
| `feat`     | New feature or capability                  |
| `fix`      | Bug fix                                    |
| `refactor` | Code restructuring without behavior change |
| `test`     | Adding or updating tests                   |
| `docs`     | Documentation changes                      |
| `chore`    | Build, CI, dependency updates              |
| `perf`     | Performance improvement                    |
| `security` | Security hardening                         |

### Scope

Use the feature area: `auth`, `calendar`, `map`, `feed`, `notifications`, `settings`, `api`, `db`, `ci`, `docs`.

### Examples

```
feat(map): add fused heading for pedestrian navigation
fix(auth): resolve race condition in concurrent signup flow
refactor(calendar): extract deadline computation into custom hook
test(api): add integration coverage for notification preferences endpoint
security(middleware): add CSRF origin validation to mutation routes
```

---

## Architecture Constraints

These constraints are non-negotiable. PRs that violate them will be rejected.

### API Authentication

`middleware.ts` and `lib/proxy.ts` handle page redirects and request-level controls, but deliberately do not resolve users for API requests. Every protected API route must enforce authentication in its own handler with `requireAuth`, `requireAuthWithRateLimit`, or a reviewed inline `getUser()` check. Document intentionally public routes and test both access paths.

In this Cloudflare/OpenNext deployment, `middleware.ts` is the intentional framework entrypoint and `lib/proxy.ts` holds the request logic. Do not rename the entry file to `proxy.ts` or assume proxy-level auth protects new API routes.

### Database Discipline

- **Never modify the database through the Supabase Dashboard UI.** All schema changes must be scripted as idempotent, reversible SQL migrations in `supabase/migrations/`.
- **Row-Level Security (RLS) is mandatory.** Every new table must have RLS enabled with policies scoped to `auth.uid()`.
- **Prefer PostgreSQL RPCs** for multi-table transactions. Use `SECURITY DEFINER` stored procedures over thick API route logic.

### API Security

- All new API routes must use `requireAuth` or `requireAuthWithRateLimit` middleware.
- Input validation via Zod schemas is mandatory for all request bodies.
- Error responses must use sanitized messages -- never expose stack traces, internal paths, or database details.
- The header scanner is restricted to approved first-party project origins; do not expand it into an arbitrary-host fetcher without a reviewed egress design.
- Client IP trust is runtime-specific. The reviewed Cloudflare path trusts `CF-Connecting-IP`; local Node servers and other proxies must be treated separately.

---

## Security Requirements

Security is a first-class concern, not a post-launch consideration.

- **Never commit secrets.** The secrets scanner will block your PR, but verify manually as well. Use `.env.local` for local development.
- **Use private vulnerability reporting.** The public issue tracker is for ordinary bugs. Follow [`SECURITY.md`](./SECURITY.md) for security findings.
- **Never disable security controls** (CSP, rate limiting, RLS policies) to make development easier. If a control blocks your workflow, ask for help.
- **Report vulnerabilities privately.** If you discover a security issue, do not open a public issue. Follow the process in [`SECURITY.md`](./SECURITY.md).
- **Keep security and product claims accurate.** Distinguish implemented behaviour from planned work, and do not imply Macquarie endorsement or multi-university rollout that the repository does not implement.

---

## Issue and Discussion Guidelines

### Bug Reports

Open a GitHub Issue with:

- Steps to reproduce.
- Expected vs. actual behavior.
- Browser/OS/Node version.
- Console errors or network traces, if applicable.

For sensitive security or privacy bugs, use [GitHub private vulnerability reporting](https://github.com/leoalavi/syllabus-sync/security/advisories/new) instead of a public issue.

### Feature Requests

Open a GitHub Discussion with:

- The problem you are trying to solve (not just the solution you want).
- How it fits within the existing architecture.
- Whether you are willing to implement it.

### Questions

Use GitHub Discussions for general questions about the codebase, architecture, or setup.

### Good First Contribution Areas

- Documentation corrections, broken links, and setup clarity
- Translation review for the currently documented English fallback keys
- Small test reliability fixes in Vitest or Playwright
- Publicly verifiable campus data corrections
- CI/documentation hardening that does not weaken security boundaries

---

## AI-Assisted Contributions

We welcome contributions developed with AI assistance (Claude, Copilot, Codex, etc.). AI-assisted contributions are held to the same quality bar as any other contribution. You are responsible for:

- Understanding every line of code you submit.
- Verifying that AI-generated code passes all quality gates.
- Ensuring AI-generated tests actually test meaningful behavior (not just achieving coverage numbers).

When using AI agents in this repository, they must follow the **Leo Change Protocol** defined in `AGENTS.md`: preflight reading, minimal/surgical changes, atomic commits, and postflight changelog updates.

---

## Recognition

All contributors are recognized in the project. Significant contributions are acknowledged in release notes and the changelog.

Thank you for helping build Syllabus Sync into a robust, secure campus platform.
