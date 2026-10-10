import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractToolCatalog, productionOrigin, escapeHtml } from '../scripts/seo-catalog.mjs';
import { loadSource } from './load-source.mjs';

const catalog = extractToolCatalog(readFileSync(new URL('../src/lib/registry.ts', import.meta.url), 'utf8'));

test('all 14 utility destinations have distinct names, descriptions, and safe slugs', () => {
  assert.equal(catalog.length, 14);
  assert.equal(new Set(catalog.map(t => t.id)).size, 14);
  assert.ok(catalog.every(t => t.name.length > 2 && t.description.length > 12 && /^[a-z0-9-]+$/.test(t.id)));
});

test('deep link parser accepts only published registry identifiers and rejects other paths', async () => {
  const { toolPath, toolIdFromPath, publicToolDescription } = await loadSource('src/lib/toolRoutes.ts');
  const known = new Set(catalog.map(t => t.id));
  for (const t of catalog) {
    assert.equal(toolIdFromPath(toolPath(t.id), known), t.id);
    assert.equal(toolIdFromPath(`/tools/${t.id}`, known), t.id);
    assert.match(publicToolDescription(t.name, t.description), /Free online utility/);
  }
  for (const path of ['/admin', '/', '/tools/no-such-tool/', '/tools/%2e%2e/', '/tools/calculator/a', '/TOOLS/calculator/', '/tools/calculator?<script>']) {
    assert.equal(toolIdFromPath(path, known), null, `must reject ${path}`);
  }
});

test('SEO production URL rejects untrusted origins; HTML entities are escaped', () => {
  assert.equal(productionOrigin(undefined), null);
  assert.equal(productionOrigin('https://calculator.example.dev/'), 'https://calculator.example.dev');
  for (const value of ['http://calculator.example.dev', 'https://example.com', 'javascript:alert(1)', 'https://u:p@calculator.example.dev', 'https://calculator.example.dev/path']) {
    assert.throws(() => productionOrigin(value));
  }
  assert.equal(escapeHtml(`<script>"hi"&'`), '&lt;script&gt;&quot;hi&quot;&amp;&#39;');
});

test('SEO builder writes 14 unique, crawlable static HTML pages and a canonical sitemap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uc-seo-'));
  try {
    mkdirSync(join(dir,'dist'), {recursive:true});
    mkdirSync(join(dir,'src/lib'), {recursive:true});
    writeFileSync(join(dir,'src/lib/registry.ts'), readFileSync(new URL('../src/lib/registry.ts', import.meta.url)));
    writeFileSync(join(dir,'dist/index.html'), `<!doctype html><html><head><meta name="description" content="Original" /><title>Original</title></head><body><div id="root"></div></body></html>`);
    execFileSync(process.execPath, [resolve('scripts/generate-seo.mjs')], {cwd:dir,env:{...process.env,PUBLIC_SITE_URL:'https://calculator.example.dev',PUBLIC_ENABLED_TOOLS:''}});
    const sitemap = readFileSync(join(dir,'dist/sitemap.xml'),'utf8');
    const robots = readFileSync(join(dir,'dist/robots.txt'),'utf8');
    assert.equal((sitemap.match(/<loc>/g) ?? []).length, 15);
    // Admin uses X-Robots-Tag: noindex. Don't block crawlers from seeing that header.
    assert.doesNotMatch(robots,/Disallow: \/admin/);
    assert.match(robots,/Sitemap: https:\/\/calculator.example.dev\/sitemap.xml/);
    const home = readFileSync(join(dir,'dist/index.html'),'utf8');
    assert.match(home,/<nav aria-label="Available free tools">/);
    for (const t of catalog) {
      const html = readFileSync(join(dir,'dist','tools',t.id,'index.html'),'utf8');
      assert.ok(html.includes(`<h1>${escapeHtml(t.name)} — Free Online Tool`));
      assert.ok(html.includes(`<link rel="canonical" href="https://calculator.example.dev/tools/${t.id}/"`));
      assert.ok(html.includes('Free online utility, available without a subscription or payment.'));
    }
    // A trusted build operator can align static pages with published admin visibility.
    rmSync(join(dir,'dist','tools'),{recursive:true,force:true});
    writeFileSync(join(dir,'dist/index.html'), `<!doctype html><html><head><meta name="description" content="Original" /><title>Original</title></head><body><div id="root"></div></body></html>`);
    execFileSync(process.execPath, [resolve('scripts/generate-seo.mjs')], {cwd:dir,env:{...process.env,PUBLIC_SITE_URL:'https://calculator.example.dev',PUBLIC_ENABLED_TOOLS:'calculator,qr'}});
    assert.equal((readFileSync(join(dir,'dist/sitemap.xml'),'utf8').match(/<loc>/g) ?? []).length, 3);
    assert.throws(() => readFileSync(join(dir,'dist','tools','converter','index.html')));
    assert.throws(() => execFileSync(process.execPath, [resolve('scripts/generate-seo.mjs')], {cwd:dir,env:{...process.env,PUBLIC_ENABLED_TOOLS:'calculator,unknown-tool'}}));
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('responsive critical CSS covers mobile drawer, tablet admin cards and readable inputs', () => {
  const publicCss = readFileSync(new URL('../src/index.css', import.meta.url),'utf8');
  const adminCss = readFileSync(new URL('../src/admin/admin.css', import.meta.url),'utf8');
  assert.match(publicCss, /100dvh/);
  assert.match(publicCss, /@media \(max-width: 640px\)/);
  assert.match(publicCss, /font-size: 16px/);
  assert.match(publicCss, /visibility: hidden/);
  assert.match(adminCss, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(adminCss, /-webkit-overflow-scrolling: touch/);
});
