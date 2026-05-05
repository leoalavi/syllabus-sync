<div align="center">

<!-- Typing animation -->
[![Typing SVG](https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=20&duration=2800&pause=700&color=6366F1&center=true&vCenter=true&width=860&lines=Campus+OS+for+Australian+Universities;Syllabus+PDFs+%E2%86%92+Structured+Data+%E2%86%92+Student+Productivity;Next.js+16+%C2%B7+React+19+%C2%B7+TypeScript+%C2%B7+Supabase;Enterprise+Security+%C2%B7+19+Languages+%C2%B7+WCAG+2.1+AA)](https://readme-typing-svg.demolab.com)

<!-- Badges -->
![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js_16-000?style=for-the-badge&logo=nextdotjs)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/503_Tests-Vitest-6E9F18?style=for-the-badge)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

# Syllabus Sync — Enterprise-Grade Campus OS Blueprint

> **A production-ready, AI-native platform that transforms static university infrastructure into a secure, high-performance, and cohesive student experience.**

Syllabus Sync is a production-grade, security-hardened web platform that unifies academic scheduling, deadline intelligence, campus navigation, and student engagement into a single, cohesive experience. Built on Next.js 16, React 19, and Supabase with strict TypeScript throughout, it delivers the integrated campus infrastructure that universities promise but rarely ship.

Built initially for **Macquarie University**, it is designed to be adaptable to other institutions by swapping academic datasets and configuring environment variables. This project is a comprehensive portfolio piece that shows advanced full-stack engineering, rigorous cybersecurity implementations, and AI-native development workflows.

**[🔗 Live Demo](https://syllabus-sync-mq.vercel.app)** &nbsp;·&nbsp; **[📖 Docs](./docs/README.md)** &nbsp;·&nbsp; **[🔐 Security](./SECURITY.md)** &nbsp;·&nbsp; **[🤝 Contributing](./CONTRIBUTING.md)**

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## 🎯 High-Level Impact & Value Proposition

Traditional university systems are fragmented, leading to missed deadlines, poor campus discoverability, and sub-optimal student experiences. Syllabus Sync solves this by providing:

- **Unified Academic Management:** Seamless integration of enrolled units, class times, and assessment deadlines with stress-aware predictive tracking.
- **Advanced Campus Navigation:** Real-time, fused-heading campus navigation combining OpenStreetMap (Leaflet) and Google Maps Embed APIs, tailored for high-accuracy pedestrian routing.
- **Enterprise-Grade Security:** A defence-in-depth architecture featuring WebAuthn (Passkeys), hardware-backed MFA, Zero-Trust middleware, and strict Row-Level Security (RLS).
- **Gamified Engagement:** Secure, anti-abuse XP and streak mechanics to incentivise academic consistency.

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f172a,30:6366f1,60:22c55e,100:0f172a&height=2" width="100%"/>

<br/>

## Why This Project Matters

University platforms are often decades-old monoliths with bolted-on features and poor mobile experiences. Students deserve better. Syllabus Sync was built to prove three things:

1. **A unified campus experience is technically achievable.** Timetables, assessment deadlines, campus wayfinding, weather-aware planning, and gamified engagement belong in one application -- not scattered across five different portals.
2. **Security and usability are not trade-offs.** This platform implements WebAuthn passkeys, hardware-backed MFA, and Zero-Trust middleware while maintaining sub-second page loads and a frictionless UX.
3. **AI-augmented engineering produces auditable, production-quality software.** Every architectural decision and security hardening is traced through an immutable changelog.

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
║  ⚡  CI/CD via GitHub Actions · 503 tests · Vercel Edge deployment    ║
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

## 🔒 Security Posture & Hardening

Security is a structural constraint, with defence-in-depth across every layer.

- **Authentication:** FIDO2 WebAuthn (Passkeys restricted to platform authenticators), hardware-backed MFA (TOTP), and audited session termination.
- **Authorisation:** Absolute tenant isolation via PostgreSQL Row-Level Security (RLS) at the query execution layer.
- **Data Protection:** Encryption at rest (AES-256), in transit (TLS 1.3), and strict Content Security Policy (CSP).
- **Compliance:** Tamper-evident audit logging for all sensitive system and user operations.

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
tests/              Vitest suites (93 files, 503 tests)
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
# Runs: secrets scan → format → typecheck → lint → 503 tests → build
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
