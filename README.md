# Universal Calculator

**Free, responsive utility website with 14 tools and an optional protected administration workspace (email/password + mobile Google Authenticator TOTP).** No ads, subscriptions, payment SDKs, or paywalls.

## Quick start

Prerequisites: Node.js >= 22.12 and npm >= 10.

```powershell
npm ci
npm run dev -- --strictPort --open
```

Public site: `http://127.0.0.1:5173/` · Admin UI: `http://127.0.0.1:5173/admin`.

Tools: scientific calculator, unit and currency conversion, date/time, mathematics, finance, health, programming, text, QR, science, productivity, random, and formula reference. Tool modules load on demand; most calculations and locally stored notes stay in the browser. The currency tool uses an external exchange-rate service. The app remains useful without Supabase credentials.

## Validate changes

```powershell
npm run check:structure
npm run verify
npm run audit
npm run audit:production
npm run e2e
npm run release:gate
```

`verify` includes typecheck, source lint, tests, SEO/hosting checks, migrations and production build. `release:gate` additionally requires dependency audits and a working Chromium browser. Security-sensitive hosting and database boundaries require staging tests (`npm run staging:security`). See [Deployment](docs/DEPLOYMENT.md).

## Source layout

```text
src/                React application, tool modules, admin UI, shared logic and worker
public/             Host-specific static header/route files
scripts/            Build, SEO, security, CI and browser verification
tests/             Automated behavioral and contract tests
database/          Base schema, additive migrations, and trusted Owner bootstrap
docs/              Current setup, permissions, deployment and security reference
```

## Configuration and documentation

Copy `.env.example` to `.env.local` **only when connecting Supabase**; never put private credentials into browser-exposed `VITE_*` variables.

- [Admin email/password + Google Authenticator setup](docs/ADMIN_SETUP.md)
- [Deployment, SEO and device verification](docs/DEPLOYMENT.md)
- [Security constraints and pending verification](docs/SECURITY.md)
- [Admin roles and feature/permission coverage](docs/PERMISSIONS.md)
- [Direct hosted authorization tests](docs/STAGING_TESTS.md)

All historical SQL migrations are deliberately preserved: renaming/removing already-applied migrations risks drift and inconsistent installations. Historical patch reports were removed as documentation clutter. A ZIP is **not** evidence of a passing live security audit. Production deployment requires the full release gate and external verification.
