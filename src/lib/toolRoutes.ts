/** Canonical public routes. Admin and unknown paths never resolve to public tools. */
export function toolPath(id: string): string {
  return `/tools/${encodeURIComponent(id)}/`;
}

export function toolIdFromPath(path: string, knownIds: ReadonlySet<string>): string | null {
  const match = /^\/tools\/([a-z0-9-]+)\/?$/.exec(path);
  return match && knownIds.has(match[1]) ? match[1] : null;
}

export function publicToolDescription(name: string, description: string): string {
  return `${name}: ${description}. Free online utility, available without a subscription or payment.`;
}
