<div align="center">

<!-- Typing animation -->
[![Typing SVG](https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=20&duration=2800&pause=700&color=6366F1&center=true&vCenter=true&width=860&lines=Student+Experience+Platform+for+Macquarie+University;Academic+Planning+%C2%B7+Deadlines+%C2%B7+Navigation+%C2%B7+Engagement;Next.js+16+%C2%B7+React+19+%C2%B7+TypeScript+%C2%B7+Supabase;Security-Focused+%C2%B7+19+Languages+%C2%B7+WCAG+2.1+AA)](https://readme-typing-svg.demolab.com)

<!-- Badges -->
![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js_16-000?style=for-the-badge&logo=nextdotjs)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/Vitest-Tests-6E9F18?style=for-the-badge)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

# Syllabus Sync — Student Experience Platform

> **A full-stack, security-focused student experience platform that brings academic planning, deadlines, campus support, and engagement tools into one cohesive interface.**

Syllabus Sync is an independent full-stack student experience platform built for Macquarie University students. It brings academic planning, assessment deadlines, campus support, navigation-related information, and student engagement features into one cohesive interface. Built on Next.js 16, React 19, and Supabase with strict TypeScript throughout, it demonstrates applied full-stack engineering, security implementation, and modern CI/CD practices.

Built initially for **Macquarie University**, it is designed to be adaptable to other institutions by swapping academic datasets and configuring environment variables. This project is a comprehensive portfolio piece showcasing advanced full-stack engineering, security-focused architecture, accessibility, and internationalisation.

**[🔗 Live Demo](https://syllabus-sync-mq.vercel.app)** &nbsp;·&nbsp; **[📖 Docs](./docs/README.md)** &nbsp;·&nbsp; **[🔐 Security](./SECURITY.md)** &nbsp;·&nbsp; **[🤝 Contributing](./CONTRIBUTING.md)**

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## 🎯 Problem & Value Proposition

University tools are often fragmented — timetables, deadlines, campus maps, and support resources scattered across multiple portals. Syllabus Sync addresses this by providing:

- **Unified Academic Management:** Enrolled units, class times, and assessment deadlines with workload tracking in one place.
- **Campus Navigation:** Dual-engine campus navigation combining OpenStreetMap (Leaflet) and Google Maps Embed APIs, tailored for pedestrian routing.
- **Security-Focused Architecture:** A defence-in-depth approach featuring WebAuthn (Passkeys), TOTP-based MFA, Zero-Trust middleware, rate limiting, and strict Row-Level Security (RLS).
- **Gamified Engagement:** Anti-abuse XP and streak mechanics to encourage academic consistency.

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Why This Project Matters

Student tools often lag behind modern web standards — outdated UIs, poor mobile experiences, and no single place to manage academic life. Syllabus Sync was built to demonstrate three things:

1. **A unified campus experience is technically achievable.** Timetables, assessment deadlines, campus wayfinding, weather-aware planning, and gamified engagement belong in one application — not scattered across five different portals.
2. **Security and usability are not trade-offs.** This project implements WebAuthn passkeys, TOTP-based MFA, Zero-Trust middleware, and row-level security while maintaining a fast and accessible UX.
3. **Portfolio-quality software is built with process.** Every architectural decision is documented, every change is tracked through a structured changelog, and every CI run validates secrets, formatting, types, linting, tests, and a production build.

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Screenshots

<div align="center">

| Dashboard | Calendar |
|:---:|:---:|
| <img width="400" alt="Dashboard" src="https://github.com/user-attachments/assets/837072a4-ee98-4d6f-9157-1fdf8ed56a6c"/> | <img width="400" alt="Calendar" src="https://github.com/user-attachments/assets/77548321-6501-4569-9ddf-b9b2bdfce841"/> |

| Campus Map (Leaflet) | Campus Map (Google Maps) |
|:---:|:---:|
| <img width="400" alt="Campus map" src="https://github.com/user-attachments/assets/fde5eae3-c08a-4d07-a4b1-f9fae80383d2"/> | <img width="400" alt="Google map" src="https://github.com/user-attachments/assets/ecf4f6e9-a341-4467-b54e-1c476bff5c49"/> |

</div>

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Key Features

```text
╔══════════════════════════════════════════════════════════════════════╗
║  📄  Syllabus PDF → Structured JSON/Markdown via OCR + LLM pipeline  ║
║  🗓  Intelligent calendar with automated workload & stress analysis  ║
║  🗺  Dual-engine navigation: Leaflet + Google Maps, real-time GPS    ║
║  🔐  MFA (TOTP + WebAuthn/Passkey), RLS, CSRF, and rate limiting     ║
║  🌍  19 languages · Full RTL · WCAG 2.1 AA · 360px–2560px            ║
║  🎮  Gamification: XP, leaderboards, streaks, achievement system     ║
║  🔔  Context-aware notifications with multi-channel delivery         ║
║  ⚡  CI/CD via GitHub Actions · Comprehensive Vitest test suite · Vercel Edge deployment    ║
╚══════════════════════════════════════════════════════════════════════╝
```

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## 🏗️ Technical Architecture Overview

Syllabus Sync is built on a modern, edge-ready tech stack designed for scalability, type safety, and zero-trust security.

### Runtime Stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4, Radix UI, Framer Motion |
| **State** | Zustand (persistent storage, SWR-like caching) |
| **Database & Auth** | Supabase PostgreSQL with enforced Row-Level Security (RLS) |
| **Infrastructure** | Vercel (Edge Middleware, Serverless Functions) |
| **Rate Limiting** | Upstash Redis (distributed) |
| **Error Tracking** | Sentry (client, server, edge) |

### Key Architectural Decisions

- **Edge-First Security Middleware:** All routing passes through Vercel Edge Middleware. Auth state, email verification gates, CSRF protection, and rate limiting are enforced at the edge.
- **Distributed Rate Limiting:** Uses Upstash Redis and explicitly fails closed in production if Redis is unconfigured, preventing bypass attacks during autoscaling events.
- **Database-Level Atomicity:** Critical operations (e.g., profile creation) are handled via PostgreSQL triggers to guarantee integrity.
- **Optimistic UI with Additive Server Sync:** Complex state uses optimistic updates backed by an additive merge strategy to eliminate race conditions.
- **Proxy Middleware Auth Gate:** All `/api/*` routes require authentication by default, ensuring security-by-default for new endpoints.

> **Deep Dive:** [Technical Explanation](./TECHNICAL_EXPLANATION.md) | [Architecture Reference](./docs/architecture/ARCHITECTURE.md)

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## 🔒 Security-Focused Architecture

Security is a structural constraint, with defence-in-depth across every layer.

- **Authentication:** FIDO2 WebAuthn (Passkeys restricted to platform authenticators), TOTP-based MFA, and audited session termination.
- **Authorisation:** Tenant isolation via PostgreSQL Row-Level Security (RLS) at the query execution layer.
- **Transport & Policy:** HTTPS-enforced deployment, strict Content Security Policy (CSP), and CSRF protection.
- **Audit Logging:** Structured, audit-oriented logging for sensitive system and user operations.

> **For Security Reviewers:** [Security Posture Report](./docs/security/SECURITY_POSTURE.md) | [Security Evidence Index](./docs/security/SECURITY_EVIDENCE_INDEX.md)

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## 🎯 Project Governance

### License
Released under the **MIT License** — an OSI-approved, permissive open-source license.

### Roadmap & Priorities
- **P0:** Standalone `@syllabus-sync/extractor` package for LLM OCR pipelines.
- **P1:** Reference dataset forks for USYD and UNSW.
- **P1:** MCP (Model Context Protocol) server for direct agent integration.
- **P2:** Federated identity via institution SSO (SAML/OIDC).

### Maintainers
| Name | Role |
| --- | --- |
| Pouya Alavi Naeini | Lead maintainer — architecture, infrastructure |
| Raouf Abedini |  Co-maintainer — security, backend |

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Repository Layout

```text
app/                Next.js routes, layouts, 65 API route handlers
components/         Shared UI and layout components
config/             ESLint, Next, Prettier, Sentry, Tailwind, TS, Vitest, Lighthouse
data/               Static academic data (unit catalogue, building maps)
docs/               Architecture, operations, API, policy, security, reference docs
features/           Feature-first client modules (home, calendar, map, settings, auth)
infra/              Docker assets
lib/                Stores, hooks, services, security, utilities, Supabase clients
locales/            35 locale dictionaries
public/             Static assets, icons, map tiles, overlays, service worker
supabase/           Canonical migration history and configuration
tests/              Vitest test suites (93 test files)
tools/              Repo utilities (i18n, security, exports, load testing)
```

> **Full Inventory:** [Repository Inventory](./docs/reference/REPOSITORY_INVENTORY.md)

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Quick Start

### Prerequisites
- Node.js `>=22 <23`
- npm `>=10`
- Supabase project and Upstash Redis instance

### Setup
```bash
# Clone and install
git clone https://github.com/mrpouyaalavi/syllabus-sync.git
cd syllabus-sync
npm install

# Configure environment
cp .env.example .env.local

# Initialise database
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# Start development
npm run dev
```

### Quality Assurance
```bash
npm run check
# Runs: secrets scan → format → typecheck → lint → tests → build
```

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Documentation Map

| Document | Path |
| --- | --- |
| Architecture | [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) |
| Technical Explanation | [TECHNICAL_EXPLANATION.md](./TECHNICAL_EXPLANATION.md) |
| API Reference | [docs/api/API_REFERENCE.md](./docs/api/API_REFERENCE.md) |
| Environment Setup | [docs/operations/ENVIRONMENT_SETUP.md](./docs/operations/ENVIRONMENT_SETUP.md) |
| Deployment Checklist | [docs/operations/deployment-checklist.md](./docs/operations/deployment-checklist.md) |
| Docs Index | [docs/README.md](./docs/README.md) |
| Security Policy | [SECURITY.md](./SECURITY.md) |

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Acknowledgements

Built with the support of the open-source community. This project benefits from:

- [Supabase](https://supabase.com/) — Open-source backend with RLS.
- [Vercel](https://vercel.com/) — Edge deployment infrastructure.

<br/>

<div align="center">

### `> ping --authors`

```text
> Authors    : Pouya Alavi Naeini — Software Engineer | Mohammad Raouf Abedini — Back-End Developer
> University : Macquarie University, Sydney, NSW
> Status     : [●] ONLINE — open to grad & junior opportunities
```

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-6366f1?style=for-the-badge&logo=linkedin&logoColor=ffffff&labelColor=0f172a)](https://www.linkedin.com/in/pouya-alavi/)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-22c55e?style=for-the-badge&logo=github&logoColor=ffffff&labelColor=0f172a)](https://github.com/mrpouyaalavi)
[![Email](https://img.shields.io/badge/Email-Contact-f59e0b?style=for-the-badge&logo=gmail&logoColor=09090b&labelColor=0f172a)](mailto:pouya@pouyaalavi.dev)

<br/>

*Syllabus Sync is an independent open-source project and is not officially affiliated with Macquarie University.*

</div>
