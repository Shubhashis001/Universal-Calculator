# Deployment and SEO

## Requirements

- Node.js >= 22.12 and npm >= 10, a hosting provider with HTTPS and secure response headers, a domain you own, and a **dedicated** Supabase project for admin features.
- This is a free site with no ads, checkout, paid tiers or billing gateway. Finance figures in the optional admin ledger are manually entered, not verified payment revenue.
- All calculator tools function without Supabase; admin analytics and protected controls require hosted configuration.

## Local development

```sh
npm ci
npm run verify
npm run dev -- --strictPort --open
```

For production builds configure in the deployment environment:

```dotenv
PUBLIC_SITE_URL=https://calculator.yourdomain.tld
VITE_SUPABASE_URL=https://YOUR_DEDICATED_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

The `VITE_*` keys are *public to every browser*. Never put server/secret/service-role keys, passwords, tokens or private data in `VITE_*` or source code. `PUBLIC_ENABLED_TOOLS` (build-only CSV) must be reconciled with published admin visibility before each release. Otherwise SEO pages can disagree with runtime publishing settings. 

## Production verification

```sh
npm run check:production-env
npm run release:gate:production
npm run site:smoke
```

`release:gate:production` is intentionally strict: npm audit, full tests, browser E2E, and **explicit staging tokens / fixtures** must pass. It cannot be run truthfully without a real staging Supabase environment. See [Staging tests](STAGING_TESTS.md) and [Admin setup](ADMIN_SETUP.md).

The Vite build creates one static HTML landing page for each of 14 tools. It creates `robots.txt`; it only creates `sitemap.xml` and absolute canonical links if `PUBLIC_SITE_URL` is set to a real HTTPS origin. Submit `https://YOUR_DOMAIN/sitemap.xml` to Google Search Console after deploying. A sitemap does not guarantee ranking or indexing.

Deploy **only `dist/`**, never the project root or `node_modules`. Netlify uses `public/_headers` and `_redirects`; Vercel uses `vercel.json`. Other hosts need equivalent headers, CDN cache policy and SPA fallback for `/admin`. Confirm live headers, especially admin `noindex` and `no-store`, CSP, HSTS, frame denial, and safe CORS. The admin UI isn't the authorization boundary: Supabase RLS/RPC checks are.

Test a 320px phone, standard mobile, tablet and desktop, including keyboard and real iOS Safari / Android Chrome, with `npm run e2e` and physical devices where available. The automated smoke doesn't establish universal compatibility.

Before launch: verify real email/password sign-in and MFA flows; role-based REST/RPC access; reverse proxy/edge atomic rate limits; privacy and retention jobs; security advisor findings; expiry/revocation behavior; backups and recoverability. [Security requirements](SECURITY.md) remain release blockers until tested live.
