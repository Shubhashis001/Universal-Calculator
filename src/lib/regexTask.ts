export interface RegexRequest { mode: 'match' | 'replace'; pattern: string; flags: string; text: string; replacement?: string; }
export interface RegexResult { matches: string[]; output?: string; error?: string; }
export function runRegexTask(request: RegexRequest): RegexResult {
  if (request.pattern.length > 500 || request.text.length > 100000 || (request.replacement?.length ?? 0) > 10000) return { matches: [], error: 'Input exceeds the regex tool limits.' };
  try {
    const regex = new RegExp(request.pattern, request.flags);
    if (request.mode === 'replace') {
      const output = request.text.replace(regex, request.replacement ?? '');
      return output.length <= 200000 ? { matches: [], output } : { matches: [], error: 'Replacement output is too large.' };
    }
    const matches = request.text.match(regex);
    return { matches: matches ? (regex.global ? matches.slice(0, 1000) : [matches[0]]) : [] };
  } catch (error) { return { matches: [], error: error instanceof Error ? error.message : 'Invalid regular expression' }; }
}
