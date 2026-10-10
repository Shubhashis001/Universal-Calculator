#!/usr/bin/env node
/** Verify actual deployed CDN responses. Safe GET-only probes; no credentials sent. */
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {extractToolCatalog,productionOrigin} from './seo-catalog.mjs';

const tools=extractToolCatalog(readFileSync(new URL('../src/lib/registry.ts',import.meta.url),'utf8'));
export async function checkLiveSite(origin, request = fetch, expectedTools = tools) {
  const target=productionOrigin(origin);
  if (!target) throw new Error('PUBLIC_SITE_URL must be configured to test a real deployed origin.');
  const problems=[];
  const retrieve=async path => {
    const response=await request(target+path,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
    if (response.status!==200) {problems.push(`${path} returned HTTP ${response.status}`);return {response,html:''};}
    const body=await response.text();
    if (body.length > 3_000_000) problems.push(`${path}: unexpectedly large HTML/text response`);
    return {response,html:body};
  };
  const home=await retrieve('/');
  const headers=home.response.headers;
  for (const h of ['content-security-policy','strict-transport-security','x-content-type-options','referrer-policy','x-frame-options']) {
    if (!headers.has(h)) problems.push(`Deployed home is missing ${h}`);
  }
  if (!home.html.includes('Universal Calculator')) problems.push('Home title/branding mismatch');
  if (!home.html.includes(`rel="canonical" href="${target}/"`)) problems.push('Home canonical missing or wrong');
  const robots=await retrieve('/robots.txt');
  if (!robots.html.includes(`Sitemap: ${target}/sitemap.xml`)) problems.push('Live robots.txt must announce exact sitemap URL');
  const sitemap=await retrieve('/sitemap.xml');
  if (!sitemap.html.includes('<urlset')) problems.push('Sitemap is missing a valid urlset tag');
  const expectedPaths=['/',...expectedTools.map(t=>`/tools/${t.id}/`)];
  const locs=[...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
  if (locs.length!==expectedPaths.length || locs.some((loc,i)=>loc!==target+expectedPaths[i]))
    problems.push('Sitemap URLs do not match the published tool list and canonical origin');
  for(const t of expectedTools) {
    const path=`/tools/${t.id}/`;
    const {html}=await retrieve(path);
    if(!html.includes(`<title>${t.name} — Free Online Tool | Universal Calculator</title>`)) problems.push(`${path} missing distinct title`);
    if(!html.includes(`rel="canonical" href="${target+path}"`)) problems.push(`${path} missing distinct canonical`);
    if(!html.includes('<h2>Common uses</h2>')) problems.push(`${path} missing useful crawlable description`);
  }
  for (const path of ['/admin','/admin/']) {
    const {response}=await retrieve(path);
    if (!/noindex/i.test(response.headers.get('x-robots-tag')??'')) problems.push(`${path} not marked noindex at CDN`);
    if (!/no-store/i.test(response.headers.get('cache-control')??'')) problems.push(`${path} can be cached`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const missing=(process.env.PUBLIC_ENABLED_TOOLS??'').trim().split(',').filter(Boolean);
    const chosen=missing.length ? tools.filter(t=>missing.includes(t.id)) : tools;
    const failures=await checkLiveSite(process.env.PUBLIC_SITE_URL,fetch,chosen);
    if(failures.length){failures.forEach(x=>console.error(`FAIL ${x}`));process.exitCode=1;}
    else console.log(`LIVE site smoke PASS: ${chosen.length} tool pages, sitemap, headers and admin noindex. This is NOT a search-ranking or penetration-test guarantee.`);
  } catch(e){console.error(e instanceof Error?e.message:'Live site check failed');process.exitCode=1;}
}
