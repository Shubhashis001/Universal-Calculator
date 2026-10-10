/** Extracts public tool metadata from the application registry, avoiding a second source of truth. */
export function extractToolCatalog(source) {
  const items = [...source.matchAll(/\bid:\s*'([a-z0-9-]+)'\s*,\s*name:\s*'([^']+)'\s*,\s*description:\s*'([^']+)'/g)]
    .map(([, id, name, description]) => ({ id, name, description }));
  if (items.length !== 14 || new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error(`SEO tool catalogue changed (${items.length} valid tools); update and verify the route generator before release.`);
  }
  return items;
}

export function productionOrigin(raw) {
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { throw new Error('PUBLIC_SITE_URL must be an HTTPS site origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      /^(localhost|127\.0\.0\.1|example\.com|your-domain\.com)$/i.test(url.hostname)) {
    throw new Error('PUBLIC_SITE_URL must be the actual HTTPS production origin (e.g. https://utility.yourdomain.com)');
  }
  return url.origin;
}

export function escapeHtml(value) {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
