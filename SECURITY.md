# Security policy

Syllabus Sync is an independent student platform. This policy covers the web application at `www.syllabus-sync.app`, its API, and first-party code in this repository. The separate Sylla, Campus Navigation, information-site, and Astronomy Open Night projects have their own implementation boundaries; report a finding about a specific project through that project's channel when available.

## Supported version

Security fixes are directed at the current `main` branch and production deployment. Historical releases are not maintained as separate supported branches.

## Report a vulnerability privately

**Email [leo@leoalavi.dev](mailto:leo@leoalavi.dev?subject=Syllabus%20Sync%20security%20report)** with the subject “Syllabus Sync security report”. GitHub private vulnerability reporting is currently disabled for this repository. Do not open a public issue, discussion, or pull request containing exploit details, credentials, or personal information.

Include the affected URL or component, steps to reproduce, impact, and a safe proof of concept where possible. Do not send real user data or secrets unless essential, and redact them before sharing.

We will acknowledge reports and coordinate triage and disclosure with the reporter. Response and remediation times depend on the impact and available evidence; no fixed service-level guarantee is implied.

## Research boundaries

Please avoid disrupting production, accessing other users' data, or publishing an unpatched finding. Report accidental exposure promptly through the private channel. Good-faith research within these boundaries is welcome.

## Implementation references

The [current architecture guide](./docs/architecture/ARCHITECTURE.md) explains the Cloudflare/OpenNext runtime, route-level API authentication, Supabase RLS, and the restricted use of service-role clients. The [historical security evidence index](./docs/security/SECURITY_EVIDENCE_INDEX.md) is a starting point for review, not proof that every listed control remains current. Verify a security claim against code and the deployed configuration before relying on it.
