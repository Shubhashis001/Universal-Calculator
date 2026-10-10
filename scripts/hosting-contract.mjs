#!/usr/bin/env node
/** Local manifest tests, not an HTTP scan of any deployed CDN. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
export function validateHostingContracts(vercel, netlify, redirects) {
  const issues = [];
  const common = Object.fromEntries((vercel.headers?.find(h => h.source === '/(.*)')?.headers ?? []).map(h => [h.key.toLowerCase(),h.value]));
  const directives = ['default-src', 'script-src', 'object-src', 'frame-ancestors', 'base-uri'];
  if (!directives.every(d => common['content-security-policy']?.includes(d))) issues.push('Vercel CSP directives incomplete');
  if (!common['content-security-policy']?.includes("object-src 'none'")) issues.push('Vercel must block plugins');
  for (const h of ['strict-transport-security','referrer-policy','x-content-type-options','x-frame-options','permissions-policy'])
    if (!common[h]) issues.push(`Vercel ${h} missing`);
  if (/Access-Control-Allow-Origin\s*:\s*\*/i.test(netlify) || (vercel.headers ?? []).some(h => h.headers?.some(x => /access-control-allow-origin/i.test(x.key) && x.value === '*')))
    issues.push('Wildcard CORS on hosted application is forbidden');
  for (const path of ['/admin', '/admin/']) {
    const h = vercel.headers?.find(x => x.source === path)?.headers ?? [];
    if (!h.some(x=>x.key === 'X-Robots-Tag' && /noindex/.test(x.value))) issues.push(`${path} noindex header absent`);
    if (!h.some(x=>x.key === 'Cache-Control' && /no-store/.test(x.value))) issues.push(`${path} no-store header absent`);
  }
  if (!netlify.includes('X-Robots-Tag: noindex, nofollow')) issues.push('Netlify admin noindex missing');
  if (!redirects.includes('/admin  /index.html  200') || !redirects.includes('/admin/  /index.html  200'))
    issues.push('Netlify admin rewrites missing');
  return issues;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = validateHostingContracts(JSON.parse(read('vercel.json')),read('public/_headers'),read('public/_redirects'));
  if (failures.length) { failures.forEach(x=>console.error(`FAIL ${x}`)); process.exitCode=1; }
  else console.log('Hosting manifest contract PASS (deployed HTTP response headers still need checking).');
}
