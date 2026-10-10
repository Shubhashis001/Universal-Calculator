export function safeUrl(value: string): string | undefined {
  // Reject controls and attribute-like destinations before URL normalization.
  if (!value || /[\u0000-\u0020\u007f"<>\\]/.test(value)) return undefined;
  try {
    const url = new URL(value, 'https://preview.invalid/');
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? value : undefined;
  } catch { return undefined; }
}
