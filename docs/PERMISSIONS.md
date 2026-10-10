# Universal Calculator — actual feature-to-permission/API/test map

This is **single-workspace utility software**, not an organization/multitenant product or a CMS. All 14 calculators are client-side. No calculations, text, health fields, password-generator output, notes, or QR payloads are sent as analytics.

| Business capability / entity | Public or admin UI | Persistence | Trusted API / RPC | Permission (AAL2 + verified TOTP + live session) | Tests / status |
|---|---|---|---|---|---|
| 14 calculators (calculator, converter, currency, datetime, math, finance, health, programming, text, QR, science, productivity, random, formulas) | Original public app | Local browser state where appropriate | No server for calculation | Public; visibility controlled by published settings | Existing module checks require npm install; syntax local pass |
| Published title, tagline, tool visibility | Admin Settings; public navigation/tool selection | `utility_settings`, versioned | `get_public_utility_settings`, `get_admin_utility_settings`, `update_utility_settings` | read: Viewer+; publish: Editor+ + recent TOTP | Static migration assertions pass; hosted behavior PENDING |
| Anonymous usage sessions | Consent UI; Admin Overview/Live activity | `visitor_sessions`, `tool_usage`, `private.telemetry_quota` | `record_utility_activity`, `get_utility_overview` | Anonymous metrics-only write via capped RPC; aggregate read: Viewer+; raw session/usage read: Owner/Admin only | Mocked/client security tests pass; hosted flood/IP tests PENDING |
| Registered users | Admin Users | `user_profiles` (synced from Supabase Auth) | RLS `SELECT` | own profile or Admin/Owner | RLS execution test PENDING |
| Revenue and expenses | Admin Finance ledger | `finance_entries` with `row_version` and `archived_at` | `write_finance_entry` RPC and constrained RLS `SELECT` | View: Viewer+; edit/archive: Editor+ + recent TOTP | Version checks statically reviewed; concurrent DB test PENDING |
| Owner/Admin/Editor/Viewer memberships | Admin Team | `admin_accounts` | `list_admin_team`, `set_admin_role` | Team read: Admin+; team edit: Owner only + recent TOTP | Last-owner transaction lock statically reviewed; DB concurrency test PENDING |
| Team invitations | Admin Team and unauthorised-sign-in screen | `admin_invites` | `invite_admin`, `accept_admin_invite` | Invite: Owner + recent TOTP; accept: named Auth UID only | Hosted normal-user / invitation tests PENDING |
| Admin authentication | Email/password + Google Authenticator TOTP pages | Supabase Auth (credentials never in app DB) | Password grant `/auth/v1/token`, `/factors/*`, `/user`; JWT/RLS | Password login alone insufficient; all protected data needs AAL2 | Password grant behavior tests; hosted password/TOTP E2E PENDING |
| Admin audit | Admin Audit trail | `admin_audit`, no client INSERT/UPDATE/DELETE | `private.log_admin` from privileged SQL RPCs | Audit view: Admin/Owner | Hosted immutable insert denial PENDING |
| Exports | Users/sessions/finance CSV buttons | Local download (no server copy) | Already authorized readable data; CSV formula escaping | Users export: Admin+; Finance UI export: Admin+; sessions UI export: Owner/Admin only (current loaded page) | Browser/CSV test after dependency install; logs must be private |
| Runtime keys / payment / ads | Status information only | Environment at deploy time | None configured | N/A | NOT CONFIGURED, no fabricated revenue |
| File uploads, bookings, CRM leads, AI, webhooks, multitenancy | No corresponding public feature | Not applicable | **Not implemented (deliberately)** | N/A | N/A |

## Explicit role permission allowlist

- **Owner:** analytics.read, analytics.sessions.read, users.read, users.export, finance.read, finance.write, finance.export, settings.read, settings.write, team.read, team.manage, audit.read.
- **Admin:** same except `team.manage` (Owner-only). No Owner promotion by Admin.
- **Editor:** analytics.read (aggregates only), finance.read/write, settings.read/write; no team/PII exports/audit.
- **Viewer:** analytics.read (aggregates only), finance.read, settings.read only.
- Unknown permission strings are denied by `private.can`. The new `20261011_privacy_permissions.sql` revokes raw visitor/session/usage reads from Editor and Viewer.
- Browser CSV export is limited to the current authorized loaded page. Because browser-side reading allows manual copying, separate export restrictions on the same data cannot be made cryptographically enforceable without dedicated server-side export paths.
- `team.manage` needs TOTP in the last **5 min**; `finance.write`/`settings.write` in the last **10 min** as verified by the JWT AMR TOTP timestamp.
- `admin_accounts` own-role SELECT is intentionally available at AAL1 to support MFA onboarding; it does not allow protected reads.

## Security expectations that need a real database / deployment

Test using distinct actual Supabase identities and **direct REST/RPC calls**, not just hidden frontend buttons: anon, signed-in nonmember, invited unaccepted user, Owner, Admin, Editor, Viewer, AAL1/AAL2, removed membership, unknown permission, attempts at Owner escalation, expired invite, missing factor, removed session, replayed finance update, concurrent Owner change, direct `finance_entries` UPDATE/DELETE, and client attempt to read `admin_audit` or `utility_settings` table. Collect actual HTTP status codes and RLS responses from staging. **These were not executed in this ZIP workspace.**

Also still required for public launch: shared IP-based abuse mitigation at CDN/Edge/WAF, Auth-provider rate limits and bot protection, live password/TOTP sign-in and account-recovery verification, real Chromium email/password + MFA E2E, independent DB backup/restore drills, network/production scans, npm audit from a machine with registry access, and security-advisor review on the target Supabase instance.

## Staging executor

`npm run staging:security` issues real PostgREST requests only with explicitly supplied staging role JWTs and known nonempty fixtures; see `STAGING_TESTS.md`. Mocked harness tests pass locally; **no live staging request has been run here**.
