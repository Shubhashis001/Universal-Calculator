import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { escapeHtml, extractToolCatalog, productionOrigin } from './seo-catalog.mjs';
import { toolGuides } from './seo-content.mjs';

const output = resolve('dist');
const index = join(output, 'index.html');
if (!existsSync(index)) throw new Error('Build Vite before generating static SEO pages.');
const allTools = extractToolCatalog(readFileSync('src/lib/registry.ts', 'utf8'));
const enabledRaw = process.env.PUBLIC_ENABLED_TOOLS?.trim();
const enabled = enabledRaw ? new Set(enabledRaw.split(',').map(item=>item.trim()).filter(Boolean)) : null;
if (enabled && (!enabled.size || [...enabled].some(id=>!allTools.some(item=>item.id===id)))) {
  throw new Error('PUBLIC_ENABLED_TOOLS must contain only known tool IDs from the registry.');
}
const catalog = enabled ? allTools.filter(item=>enabled.has(item.id)) : allTools;
const origin = productionOrigin(process.env.PUBLIC_SITE_URL?.trim());
const sourceHtml = readFileSync(index, 'utf8');
if (!sourceHtml.includes('<div id="root"></div>')) throw new Error('Unexpected index.html root; update SEO pre-renderer.');
if (Object.keys(toolGuides).length !== allTools.length || allTools.some(tool => !toolGuides[tool.id])) {
  throw new Error('Every published utility must have accurate, unique search landing copy.');
}

function rendered({ title, description, path, links, guide }) {
  const canonical = origin ? `<link rel="canonical" href="${escapeHtml(origin + path)}" />` : '';
  const metadata = [
    `<meta name="robots" content="index,follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    origin ? `<meta property="og:url" content="${escapeHtml(origin + path)}" />` : '',
    canonical,
  ].filter(Boolean).join('\n    ');
  const guideMarkup = guide ? `<section aria-label="How to use this tool"><h2>What you can do</h2><p>${escapeHtml(guide.intro)}</p><h2>Common uses</h2><ul>${guide.cases.map(use => `<li>${escapeHtml(use)}</li>`).join('')}</ul><p>${escapeHtml(guide.note)}</p></section>` : '';
  const catalogMarkup = `<main class="seo-static"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>` +
    (links ? `<nav aria-label="Available free tools"><ul>${catalog.map(t => `<li><a href="/tools/${t.id}/">${escapeHtml(t.name)}</a> — ${escapeHtml(t.description)}</li>`).join('')}</ul></nav>` :
      `${guideMarkup}<p><a href="/">Browse all free tools</a></p>`) + '</main>';
  return sourceHtml.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />\n    ${metadata}`)
    .replace('<div id="root"></div>', `<div id="root">${catalogMarkup}</div>`);
}

const homeDescription = `${catalog.length} completely free browser tools for scientific calculations, unit conversion, finance, math, QR codes, programming, date/time and more. No ads, payments or subscriptions.`;
writeFileSync(index, rendered({title:'Universal Calculator — All-in-one toolkit',description:homeDescription,path:'/',links:true}));
for (const tool of catalog) {
  const path = `/tools/${tool.id}/`;
  const folder = join(output, 'tools', tool.id);
  mkdirSync(folder, {recursive:true});
  const description = `${tool.name}: ${tool.description}. Free online utility, available without a subscription or payment.`;
  writeFileSync(join(folder,'index.html'), rendered({title:`${tool.name} — Free Online Tool | Universal Calculator`,description,path,links:false,guide:toolGuides[tool.id]}));
}
const mapPath = join(output, 'sitemap.xml');
if (origin) {
  const paths = ['/', ...catalog.map(t => `/tools/${t.id}/`)];
  writeFileSync(mapPath, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map(p => `  <url><loc>${escapeHtml(origin + p)}</loc></url>`).join('\n') + '\n</urlset>\n');
} else if (existsSync(mapPath)) rmSync(mapPath);
writeFileSync(join(output,'robots.txt'), `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`);
console.log(`Generated ${catalog.length} distinct static tool pages, robots.txt${origin ? ', sitemap.xml and absolute canonicals' : ' (no domain set; sitemap omitted)'}.`);
