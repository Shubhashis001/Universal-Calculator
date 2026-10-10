import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProductionConfig } from '../scripts/production-preflight.mjs';
import { validateHostingContracts } from '../scripts/hosting-contract.mjs';
import { toolGuides } from '../scripts/seo-content.mjs';
import { extractToolCatalog } from '../scripts/seo-catalog.mjs';

const validEnv = () => ({
  NODE_ENV: 'production', PUBLIC_SITE_URL: 'https://calculator.example.dev',
  VITE_SUPABASE_URL: 'https://abcde12345.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
});

test('production refuses placeholder origin, incomplete backend and exposed secrets', () => {
  assert.equal(validateProductionConfig(validEnv()).ok, true);
  for (const overrides of [
    {PUBLIC_SITE_URL: ''}, {PUBLIC_SITE_URL:'http://calculator.example.dev'},
    {VITE_SUPABASE_URL:'https://evil.invalid'},
    {VITE_SUPABASE_PUBLISHABLE_KEY:'sb_'+'secret_ThisIsNotAPublishableKey123456'},
    {['VITE_SUPABASE_'+'SECRET']:'abc'}, {VITE_ENABLE_DEBUG:'true'},
    {PUBLIC_ENABLED_TOOLS:'calculator,unknown'}, {PUBLIC_ENABLED_TOOLS:'calculator,calculator'},
  ]) {
    assert.equal(validateProductionConfig({...validEnv(),...overrides}).ok,false,JSON.stringify(overrides));
  }
});

test('hosting manifests enforce admin privacy and reject wildcard CORS', () => {
  const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  const netlify=readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
  const redirects=readFileSync(new URL('../public/_redirects',import.meta.url),'utf8');
  assert.deepEqual(validateHostingContracts(vercel,netlify,redirects),[]);
  assert.ok(validateHostingContracts(vercel,netlify+'\nAccess-Control-Allow-Origin: *',redirects).length);
  const missing=JSON.parse(JSON.stringify(vercel));
  missing.headers=missing.headers.filter(x=>x.source!=='/admin');
  assert.ok(validateHostingContracts(missing,netlify,redirects).length);
});

test('SEO guide content covers every actual tool with distinct useful copy', () => {
  const registry=readFileSync(new URL('../src/lib/registry.ts',import.meta.url),'utf8');
  const catalog=extractToolCatalog(registry);
  assert.deepEqual(Object.keys(toolGuides).sort(),catalog.map(t=>t.id).sort());
  for(const tool of catalog){
    const guide=toolGuides[tool.id];
    assert.ok(guide.intro.length>=65);
    assert.ok(guide.cases.length>=3);
    assert.ok(guide.cases.every(c=>c.length>15));
    assert.ok(guide.note.length>=30);
  }
  assert.equal(new Set(Object.values(toolGuides).map(g=>g.intro)).size,catalog.length);
});

test('branding migration does not overwrite owner custom title', () => {
  const sql=readFileSync(new URL('../database/20261012_branding_consistency.sql',import.meta.url),'utf8');
  assert.match(sql,/where id = 1 and title = 'Universal Utility Hub'/);
  assert.doesNotMatch(sql,/delete\s+from\s+public\.admin_accounts/i);
});

test('SEO generator produces unique pages, safe sitemap and readable per-tool instructions', async () => {
  const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join,resolve}=await import('node:path');
  const {execFileSync}=await import('node:child_process');
  const root=mkdtempSync(join(tmpdir(),'universal-seo-contract-'));
  try {
    mkdirSync(join(root,'src/lib'),{recursive:true});
    mkdirSync(join(root,'dist'),{recursive:true});
    writeFileSync(join(root,'src/lib/registry.ts'),readFileSync(new URL('../src/lib/registry.ts',import.meta.url)));
    writeFileSync(join(root,'dist/index.html'), '<!doctype html><html><head><title>Original</title><meta name="description" content="Original" /></head><body><div id="root"></div></body></html>');
    execFileSync(process.execPath,[resolve('scripts/generate-seo.mjs')],{
      cwd:root,env:{...process.env,PUBLIC_SITE_URL:'https://calculator.example.dev',PUBLIC_ENABLED_TOOLS:''},stdio:'pipe'});
    const robots=readFileSync(join(root,'dist/robots.txt'),'utf8');
    const sitemap=readFileSync(join(root,'dist/sitemap.xml'),'utf8');
    assert.match(robots,/Sitemap: https:\/\/calculator\.example\.dev\/sitemap\.xml/);
    assert.equal((sitemap.match(/<loc>/g)||[]).length,15);
    assert.doesNotMatch(sitemap,/<loc>[^<]*\/admin/);
    for (const id of Object.keys(toolGuides)) {
      const html=readFileSync(join(root,'dist','tools',id,'index.html'),'utf8');
      assert.match(html,/<h2>What you can do<\/h2>/);
      assert.match(html,/<h2>Common uses<\/h2>/);
      assert.ok(html.includes(toolGuides[id].intro));
      assert.ok(html.includes(`rel="canonical" href="https://calculator.example.dev/tools/${id}/"`));
      assert.equal((html.match(/<li>/g)||[]).length,toolGuides[id].cases.length);
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('live-site smoke fails if deployed admin noindex is missing', async () => {
  const {checkLiveSite}=await import('../scripts/site-smoke.mjs');
  const origin='https://calculator.example.dev';
  const fakeRequest = async url => {
    const path=url.slice(origin.length);
    const headers=new Headers({
      'Content-Security-Policy':"default-src 'self'",'Strict-Transport-Security':'max-age=31536000',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
      'Cache-Control':path.startsWith('/admin')?'private,no-store':'no-cache',
      'X-Robots-Tag':path.startsWith('/admin')?'noindex':'',
    });
    let body='';
    if(path==='/')body=`<title>Universal Calculator</title><link rel="canonical" href="${origin}/" />`;
    else if(path==='/robots.txt')body=`User-agent: *\nSitemap: ${origin}/sitemap.xml`;
    else if(path==='/sitemap.xml')body=`<urlset><loc>${origin}/</loc><loc>${origin}/tools/calculator/</loc></urlset>`;
    else if(path==='/tools/calculator/')body=`<title>Calculator — Free Online Tool | Universal Calculator</title><link rel="canonical" href="${origin}${path}" /><h2>Common uses</h2>`;
    return {status:200,headers,text:async()=>body};
  };
  const sample=[{id:'calculator',name:'Calculator'}];
  assert.deepEqual(await checkLiveSite(origin,fakeRequest,sample),[]);
  const tampered=async url=>{
    const response=await fakeRequest(url);
    if(url.endsWith('/admin'))response.headers.delete('X-Robots-Tag');
    return response;
  };
  assert.ok((await checkLiveSite(origin,tampered,sample)).some(x=>x.includes('/admin not marked noindex')));
});
