# Hosted staging acceptance gate — direct Supabase REST/RPC

**Status: not executed until a staging project and real test accounts are configured.** The script probes the actual REST/RPC endpoints; it never uses a service-role key and cannot grant admin roles. It performs only reads and operations deliberately designed to be denied or fail validation. Still run it against a disposable **staging** database, never production.

## Prerequisites

1. Apply the correct migrations in staging (see `ADMIN_SETUP.md`). The latest included migration is `database/20261012_branding_consistency.sql`.
2. Configure email/password login and verified TOTP; provision **distinct test identities** for Owner, Admin, Editor, Viewer and a normal non-admin. Use a verified AAL2 session for each admin role and an AAL1 session for the Owner. These are **user JWTs**, not project secret keys.
3. Seed at least one consent-based session in staging (its UUID can be found through an authorized Admin's session view) and one disposable finance entry. Preserve their UUIDs. The script checks Admin/Owner can actually read those rows, while lesser identities cannot where required; an empty database is **not** proof of correct RLS.
4. Obtain a still-unexpired AAL2 JWT from a former member, then remove that member through trusted Owner controls. Obtain another still-unexpired JWT from a test account whose Supabase Auth session is then revoked through an authorized Auth administration flow. Neither credential must regain protected access.
5. Use local secret injection or protected CI variables. Do **not** write these JWTs into tracked files, `VITE_` vars, issue trackers, terminal command arguments, chat or build logs. The script logs only test labels and pass/fail information.

Required **process environment** variables:

| Name | Meaning |
|---|---|
| `ALLOW_STAGING_SECURITY_TESTS` | Must be literal `YES`, manual approval |
| `STAGING_SUPABASE_URL` | Exact `https://PROJECT_REF.supabase.co` staging API base |
| `STAGING_EXPECTED_PROJECT_REF` | Exact project ref, must match URL |
| `STAGING_SUPABASE_PUBLISHABLE_KEY` | Staging public/publishable key (never `sb_secret_*`) |
| `STAGING_MEMBER_AAL1_JWT` | Ordinary signed-in non-admin user |
| `STAGING_OWNER_AAL1_JWT` | Owner identity before factor challenge |
| `STAGING_OWNER_AAL2_JWT` | Owner with verified TOTP |
| `STAGING_ADMIN_AAL2_JWT` | Admin with verified TOTP |
| `STAGING_EDITOR_AAL2_JWT` | Editor with verified TOTP |
| `STAGING_VIEWER_AAL2_JWT` | Viewer with verified TOTP |
| `STAGING_REMOVED_MEMBER_AAL2_JWT` | Still-unexpired JWT of a now-removed member |
| `STAGING_REVOKED_JWT` | Still-unexpired JWT after session revocation |
| `STAGING_SEEDED_SESSION_ID` | Existing seeded visitor session UUID |
| `STAGING_SEEDED_FINANCE_ID` | Existing seeded finance record UUID |

Run `npm run staging:security` once those variables are securely provided. To combine registry-based local release checks **and** direct hosted probes, run `npm run release:gate:staging`.

**What it checks:** anonymous access denial; nonmember AAL1 denial; Owner AAL1 denial; AAL2 reads for all four roles; Admin/Owner team access; Editor/Viewer team denial; Admin-only raw session access with a nonempty fixture; non-admin fixture finance denial; blocked direct ledger PATCH; blocked Admin Owner-promotion/removal RPCs; published-settings projection; removed-membership JWT and revoked-session JWT denial.

**What it does not prove:** a browser's Google redirect/multistep MFA flow, concurrency and last-Owner races, direct SQL `private.can()` evaluation with unlisted permission names, WAF/atomic IP throttling, Auth provider abuse controls, storage (none exists), media safety (no uploads), payment webhooks (none exist), SQL migration transaction safety against your existing production data, dependency vulnerabilities, or production security headers. Those remain separate release gates. A passing mock test does **not** mean the hosted staging test ran.

The harness intentionally rejects 404 as evidence of access denial; an absent RPC is not a successful security test. It prints no JWTs.

## Official reference material

- [Supabase MFA and RLS enforcement](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase JWT claim types](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase RLS policies](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase security-definer function permissions](https://supabase.com/docs/guides/database/functions)
