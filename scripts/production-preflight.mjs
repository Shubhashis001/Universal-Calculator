#!/usr/bin/env node
/** Fail-closed production configuration gate. Run in CI/deployment with real environment. */
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { extractToolCatalog, productionOrigin } from './seo-catalog.mjs';

const catalog = extractToolCatalog(readFileSync(new URL('../src/lib/registry.ts', import.meta.url), 'utf8'));
const allowedToolIds = new Set(catalog.map(item => item.id));

export function validateProductionConfig(env) {
  const problems = [];
  const origin = (() => {
    try { return productionOrigin(env.PUBLIC_SITE_URL); }
    catch { problems.push('PUBLIC_SITE_URL must be a real HTTPS origin, with no path, query, fragment or credentials.'); return null; }
  })();
  if (!origin) problems.push('PUBLIC_SITE_URL is required for production canonical URLs and sitemap.xml.');
  const supabaseUrl = env.VITE_SUPABASE_URL ?? '';
  const projectMatch = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(supabaseUrl);
  if (!projectMatch || /^(?:your_project|replace_me)$/i.test(projectMatch?.[1] ?? ''))
    problems.push('VITE_SUPABASE_URL must be the actual https://<project>.supabase.co URL.');
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publicKey) || /REPLACE_ME/i.test(publicKey))
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY must contain only the valid public publishable key.');
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_')) continue;
    if (/(SECRET|SERVICE_ROLE|PASSWORD|PRIVATE_KEY|SENTRY_AUTH_TOKEN|ACCESS_TOKEN)/i.test(name)) {
      problems.push(`Unsafe browser-exposed environment variable: ${name}`); continue;
    }
    if (typeof value === 'string' && (/sb_secret_[A-Za-z0-9_-]{20,}/.test(value) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)))
      problems.push(`Possible confidential value in ${name}`);
  }
  const selection = env.PUBLIC_ENABLED_TOOLS;
  if (selection !== undefined && selection.trim()) {
    const ids = selection.split(',').map(s=>s.trim());
    if (!ids.length || ids.some(id => !allowedToolIds.has(id)) || new Set(ids).size !== ids.length)
      problems.push('PUBLIC_ENABLED_TOOLS contains an unknown or repeated tool ID.');
  }
  if (env.NODE_ENV === 'development' || env.VITE_ENABLE_DEBUG === 'true')
    problems.push('Debug/development mode is not valid for production.');
  return { ok: problems.length === 0, problems, origin };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateProductionConfig(process.env);
  if (result.ok) console.log('Production environment preflight PASS (configuration shape only; hosted authorization still untested).');
  else { for (const problem of result.problems) console.error(`FAIL ${problem}`); process.exitCode = 1; }
}
