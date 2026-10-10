# Security and operational readiness

## Security model

The public calculators are free and mostly browser-local. The optional Supabase-powered admin system is a separate lazy-loaded UI; an admin URL is **not** a security boundary. Direct database access and RPCs must enforce roles and MFA.

- Admin sign-in uses Supabase email/password followed by a Google Authenticator TOTP challenge; password login alone does not grant admin data access.
- Owner, Admin, Editor and Viewer are explicit database memberships. One-time Owner bootstrap is performed by a trusted database operator with approved Auth UUID, locking and audit records.
- Protected reads/writes require a live Auth session, AAL2 and a verified TOTP factor. Sensitive changes additionally require recent TOTP verification.
- Role updates and finance writes go through permissioned RPCs and optimistic version checks. Privileged changes are audited. Raw sessions are limited to Owner/Admin; Editor/Viewer see aggregates.
- RLS controls exposed tables. Backend secrets must not be put in `VITE_*`, source code, browser storage, frontend URLs, or logs. Supabase publishable keys are *public* and must be paired with strict RLS.
- Calculator contents, passwords, personal notes, finance/health inputs and QR payloads are not tracked as analytics. Session/tool telemetry is opt-in. A published privacy policy and a retention job are still required.
- Markdown is rendered without raw HTML execution and with safe URLs; regex runs in a disposable deadline-limited worker; browser inputs and expensive computations have bounds.
- Hosting manifests configure CSP, TLS/HSTS, frame protection, noindex/no-store for `/admin`, caching and content-type/referrer protections. Verify the headers at the **deployed URL**.

## Important limitations (must be resolved before production)

1. Run migrations on an isolated Supabase staging project and test direct API/RPC requests with anonymous, normal, invited, removed-member, Owner/Admin/Editor/Viewer and AAL1/AAL2 identities. Local SQL string assertions cannot prove RLS behavior. See [Staging tests](STAGING_TESTS.md).
2. Add atomic shared IP/action rate limits in the hosting edge/WAF to protect public telemetry and Auth. The per-visitor database quota can be bypassed by rotating visitor IDs. Verify concurrency, 429/Retry-After and outage handling.
3. Audit npm packages online, run the full TypeScript/production build and Chromium smoke, then verify on Android, iOS Safari, tablet and desktop. A build isn't independently verified just because source syntax parses.
4. Configure email/password sign-in and TOTP, provider rate limits, bot protection, controlled recovery and Security Advisor; test first-factor rejection, TOTP enrollment/removal and session-revocation delays live.
5. Review exported data permissions, retention schedules, backups and independent recovery in staging. There is **no** full application restore endpoint; trusted database-operator backups remain separate from admin settings revision restore.
6. Verify deployed CSP, CORS/origin policy, secrets, Git history, service role isolation and authenticated server routes. Source ZIPs do not contain Git history, so their included scanner cannot check earlier commits.
7. Live Sentry/PostHog integrations, actual revenue, payment webhooks, media uploads, bookings, AI endpoints and multi-tenant storage do not exist here. Don't expose misleading admin controls or claim integrations are configured.

## Release checks

```sh
npm ci
npm run check:structure
npm run security:check
npm run verify
npm run audit
npm run audit:production
npm run e2e
npm run release:gate
```

The local checks cover current-source secrets, migration presence/order, lockfile, hosting policies and mocked behavioral tests. The strict production gate also requires real staging credentials/fixtures and post-deploy smoke tests. See [Deployment](DEPLOYMENT.md).

## Access matrix

The application-specific entity, API and permission matrix is in [Permissions](PERMISSIONS.md). Owner is not automatically assigned by the browser-supplied email, and the last Owner cannot be removed via ordinary role controls. There are no browser-accessible privileged keys or full-restore operations.
