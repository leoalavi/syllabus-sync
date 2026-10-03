# Syllabus Sync -- Documentation Index

This directory is the central navigation hub for all project documentation. Documents are organized by domain so that engineers, security reviewers, and stakeholders can find what they need without scanning the full repository.

---

## Architecture and System Design

Structural decisions, component interactions, and the technical patterns that power the platform.

| Document                                                    | Description                                                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Architecture Overview](./architecture/ARCHITECTURE.md)     | High-level system architecture, Next.js App Router patterns, and Supabase integration strategy                         |
| [Technical Explanation](../TECHNICAL_EXPLANATION.md)        | Deep-dive into edge middleware, Zero-Trust pipelines, optimistic state management, and the fused-heading map algorithm |
| [Route and File Inventory](./inventory/ROUTE_INVENTORY.md)  | Comprehensive map of Next.js routes, API handlers, and directory structure                                             |
| [Navigation Model](./navigation/ROUTES_AND_NAVIGATION.md)   | How user-visible navigation (sidebar, shells) maps to underlying Next.js routing                                       |
| [Repository Inventory](./reference/REPOSITORY_INVENTORY.md) | Full directory-level inventory of the codebase                                                                         |

## Security and Compliance

Evidence-backed documentation of the project's security posture, suitable for institutional review and audit.

| Document                                                         | Description                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [Security Posture Report](./security/SECURITY_POSTURE.md)        | Executive summary, threat models, and implemented control catalogue                                    |
| [Security Evidence Index](./security/SECURITY_EVIDENCE_INDEX.md) | Direct links from specific security controls (WebAuthn, MFA, CSP, RLS) to their implementation in code |
| [Security Policy](../SECURITY.md)                                | Vulnerability disclosure process and high-level security tenets                                        |
| [Privacy Policy](./policies/privacy-policy.md)                   | Data collection, processing, retention, and user deletion rights                                       |

## API Reference

Documentation for developers interacting with or extending the backend.

| Document                                                                        | Description                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [API Reference](./api/API_REFERENCE.md)                                         | REST API surface (`app/api/**`), authentication requirements, rate limiting, and request/response schemas |
| [University Integration Requirements](./university-integration-requirements.md) | Technical proposal for integration with institutional systems (SSO, timetables, Canvas/iLearn)            |

## Operations and Deployment

Runbooks and checklists for managing the application lifecycle.

| Document                                                                 | Description                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Environment Setup](./operations/ENVIRONMENT_SETUP.md)                   | Prerequisites, local configuration, and required third-party services |
| [Deployment Checklist](./operations/deployment-checklist.md)             | Pre-production quality gates and release verification steps           |
| [Google Maps Platform Setup](./operations/google-maps-platform-setup.md) | Configuration for Google Maps Embed API, Routes API, and Places API   |
| [Legacy Resend and Vercel Setup](./operations/resend-vercel-setup.md)    | Historical Vercel instructions; not the production release path       |
| [Supabase OAuth Setup](./operations/supabase-oauth-setup.md)             | OAuth provider configuration for Supabase Auth                        |

## Project Planning

Roadmap, team structure, and historical context for engineering decisions.

| Document                                                              | Description                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Product Roadmap](../IMPROVEMENTS-ROADMAP.md)                         | Strategic roadmap organized by theme: delivered milestones, current priorities, and future direction |
| [Team Roadmap](./project/team_plan/TEAM_ROADMAP.md)                   | Phase-by-phase tracking of project milestones                                                        |
| [Team Roles](./project/team_plan/TEAM_ROLES.md)                       | Maintainer responsibilities and ownership areas                                                      |
| [Calendar Upgrade Plan](./project/team_plan/Calendar_Upgrade_Plan.md) | Feature plan for calendar system enhancements                                                        |

## Design and Planning Documents

Technical design documents and feature planning artifacts.

| Document                                                                                             | Description                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Notifications, Profiles, and Auth Design](./plans/2026-03-14-notifications-profiles-auth-design.md) | System design for the notification, profile, and auth subsystem overhaul |
| [Notifications, Profiles, and Auth Plan](./plans/2026-03-14-notifications-profiles-auth-plan.md)     | Implementation plan and task breakdown                                   |
| [Restructure Notes](./project/restructure-notes.md)                                                  | Notes from the codebase restructuring effort                             |

## Reports and Post-Mortems

Detailed analyses of system issues and their architectural resolutions.

| Document                                                                          | Description                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Notification Reminder Bug Report](./reports/notification-reminder-bug-report.md) | Root-cause analysis of race conditions in the optimistic UI notification system |

## Presentations

Stakeholder-facing materials.

| Document                                                        | Description                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Industry Deck](./presentations/syllabus-sync-industry-deck.md) | Marp-compatible presentation for industry stakeholders, covering architecture, security, and product strategy |

## Governance

Project-level policies and contributor guidelines (located in the repository root).

| Document                                      | Description                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Contributing Guidelines](../CONTRIBUTING.md) | Development standards, PR process, code conventions, and quality gate requirements  |
| [Code of Conduct](../CODE_OF_CONDUCT.md)      | Contributor Covenant v2.1 -- community standards and enforcement process            |
| [License](../LICENSE)                         | MIT License                                                                         |
| [Changelog](../CHANGELOG.md)                  | Chronological record of all significant changes with scope, files, and verification |

---

## Database

| File                                           | Description                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [Supabase migrations](../supabase/migrations/) | Source-controlled SQL migration history; verify live state separately |

---

## Quick Reference

**For contributors:** Start with [Contributing Guidelines](../CONTRIBUTING.md), then [Environment Setup](./operations/ENVIRONMENT_SETUP.md).

**For security reviewers:** Start with [Security Posture Report](./security/SECURITY_POSTURE.md), then [Security Evidence Index](./security/SECURITY_EVIDENCE_INDEX.md).

**For stakeholders:** Start with [Industry Deck](./presentations/syllabus-sync-industry-deck.md), then [Product Roadmap](../IMPROVEMENTS-ROADMAP.md).

**For API consumers:** Start with [API Reference](./api/API_REFERENCE.md), then [University Integration Requirements](./university-integration-requirements.md).
