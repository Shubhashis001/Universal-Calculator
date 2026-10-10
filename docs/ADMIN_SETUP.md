# Universal Calculator — admin deployment & Owner setup

## Installation and local validation (Node >= 22.12; Node 24 preferred)

```powershell
npm ci
npm run check:lockfile
npm run check:migration-order
npm run typecheck
npm run lint
npm test
npm run security:check
npm run build
npm run audit
npm run audit:production
npm run e2e
npm run release:gate
npm run dev -- --strictPort --open
```

Only use scripts actually present in package.json. `e2e` is **Chromium public/admin route smoke** (Chrome on PATH, or set `E2E_BROWSER_BIN`), not a hosted Google/MFA E2E. `npm run release:gate` must fail rather than quietly skip missing dependencies, security checks, audit results or a missing browser. CI has the same gate. For a private preview without Supabase, `.env.local` can be omitted.

## Supabase email/password authentication + Google Authenticator TOTP

**No Google OAuth client or Google Cloud credentials are necessary.** Google Authenticator is a TOTP mobile application, not a social sign-in provider. Passwords are sent over HTTPS to Supabase Auth; Supabase handles password hashing and verification. The React app never persists the password.

1. Create a **dedicated** Supabase project. Open SQL Editor using trusted project-owner access.
2. For a **NEW** project, run `database/launch_admin.sql`, `database/20261010_admin_core.sql`, `database/20261011_privacy_permissions.sql`, and `database/20261012_branding_consistency.sql`, in that order. Skip 20261009 on new installs (already included in base). On an **EXISTING** installed schema back up data and apply only missing migrations, including 20261009 if not applied.
3. In **Authentication → Sign In / Providers**, enable **Email** and password login, require email confirmation where appropriate, and disable public sign-ups if administration accounts must be invitation-only. You do **not** need to enable Google sign-in.
4. In **Authentication → Multi-Factor Authentication**, enable **TOTP / Authenticator App**, and configure provider-side login limits and bot protection. The authenticator verification is a required second step for privileged data (AAL2).
5. In **Authentication → Users**, provision the approved Owner's **email/password identity** using trusted administrator controls (or invite the Owner to set a password). Verify the identity, and note the actual `auth.users.id`. A previously Google-only identity needs to be provisioned for password login safely; never assume Google sign-in automatically created a password.
6. Copy `.env.example` to `.env.local`, set the public Supabase project URL and publishable key. Do not put passwords, database keys or TOTP secrets in env files.
7. Visit `/admin`: enter email/password. First-time users may be shown **Account not authorized** until Owner setup is completed. Select **Enroll authenticator for owner setup**, scan the QR code using Google Authenticator (mobile), and enter the current six-digit code. An unverified factor grants no admin data access.

## One-time Owner bootstrap (manual trusted DB operator)

1. After the approved account enrolls and verifies TOTP, independently confirm its exact `auth.users.id` from **Supabase Authentication → Users**.
2. Review `database/bootstrap_owner.sql`, replace the zero UUID with the verified existing Auth UUID, and execute in trusted SQL Editor. It is locked, audited, and refuses to run if an Owner exists. **Never expose bootstrap to the browser**.
3. Sign out; sign in again with email/password. The **Google Authenticator** code screen must appear. After entering a valid current code, authorized dashboard access should open.
4. To add other administrators, provision their accounts in Supabase Auth, invite the approved Auth UUID in Team & roles, and require TOTP enrollment/challenge. Never assign roles by user-provided email or metadata.
5. A fresh TOTP challenge is required at least every 5 minutes for team mutations and every 10 minutes for finance/publishing writes. No self-service MFA bypass exists; lost-factor recovery must be controlled by a verified Auth administrator.
6. Configure the exact site URL and allowlisted recovery redirect URLs in Supabase **if you later enable password recovery**, and use a tested protected recovery flow. No password reset form is shipped in this build.

## Direct staging security tests

After you have configured real staging accounts, a session/finance fixture and still-unexpired revoked/removed JWTs, follow **`STAGING_TESTS.md`**. Run `npm run staging:security` to test direct HTTP RLS/RPC boundaries; run `npm run release:gate:staging` for local release checks + these hosted probes. **These do not run automatically without credentials and must not be claimed as verified.** The visitor and finance fixture IDs must refer to real rows in staging.

## Privacy & deployment

- The existing site asks visitors before activity telemetry. It tracks pseudonymous IDs, tool selections and approximate visible session time, not calculation contents. Publish a privacy/retention statement before launch. Apply a scheduled 90-day retention job; the SQL comments include example retention queries.
- Use provider-side **atomic shared IP rate limiting** in Cloudflare/Vercel/Netlify Edge or another controlled gateway on `/rest/v1/rpc/record_utility_activity`. Do not trust visitor UUID alone. Cap request body size, honor proxies only when trusted, and return 429 with Retry-After; fail closed for high-risk actions on backend outages.
- Verify `vercel.json` or `public/_headers` security headers at the actual production URL (other hosts need equivalent config); enforce no-store on `/admin` and no source-map publishing. Review CSP for any newly added providers.
- Keep Auth and runtime secrets in provider vaults and server environment, not `VITE_*`. Use database operator backups and immutable copies of audit logs; **full-restore UI is intentionally unavailable** until a separately audited restore service exists.
- Configure a private error tracking system only after redaction rules and account access are approved. There is no preconfigured Sentry/PostHog integration and no invented event data.
- Check Supabase Security Advisor, migration logs, data grants, RLS behavior, hosted browser flows, Chrome route smoke, dependency scans and WAF tests. Deploy only after the release gate and staging approval both pass.

## Troubleshooting

- `vite not recognized` after extracting: run `npm ci` then `npm run dev`.
- `Missing script`: run `npm run` and compare with package.json.
- Email/password sign-in succeeds but `/admin` says not authorized: no admin membership or migration not applied. It must not grant Admin automatically.
- AAL1 after login: use authenticator challenge. AAL2 with protected-write rejection: use **Re-verify TOTP** (recent AMR requirement) or check role changes and session validity.
- Financial conflict: another client updated the entry; refresh and reapply.
- Supabase errors after migration: inspect migrations and grants in SQL Editor, don't disable RLS as a shortcut.

## Production deployment requirements

See [Deployment](DEPLOYMENT.md). Set `PUBLIC_SITE_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting build environment. Run `npm run check:production-env` before deploying, `npm run release:gate:production` with isolated staging test credentials and `npm run site:smoke` after deploying to the real domain. Database migrations are not applied automatically by the source download.
