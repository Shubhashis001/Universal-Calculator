import { useEffect, useState } from 'react';
import type { RegexRequest, RegexResult } from './regexTask';

export function useRegexTask(request: RegexRequest | null) {
  const [state, setState] = useState<{ result: RegexResult | null; error: string; pending: boolean }>({ result: null, error: '', pending: false });
  const mode = request?.mode, pattern = request?.pattern, flags = request?.flags, text = request?.text, replacement = request?.replacement;
  useEffect(() => {
    if (!mode || pattern === undefined || flags === undefined || text === undefined) return;
    let worker: Worker | undefined;
    let deadline: number | undefined;
    setState({ result: null, error: '', pending: true });
    const debounce = window.setTimeout(() => {
      try {
        worker = new Worker(new URL('../workers/regex.worker.ts', import.meta.url), { type: 'module' });
        deadline = window.setTimeout(() => {
          worker?.terminate();
          setState({ result: null, error: 'Pattern timed out. Simplify the pattern or shorten the input.', pending: false });
        }, 1000);
        worker.onmessage = (event: MessageEvent<RegexResult>) => {
          clearTimeout(deadline);
          worker?.terminate();
          setState({ result: event.data, error: event.data.error ?? '', pending: false });
        };
        worker.onerror = () => {
          clearTimeout(deadline);
          worker?.terminate();
          setState({ result: null, error: 'Regex worker could not start. Reload to retry.', pending: false });
        };
        worker.postMessage({ mode, pattern, flags, text, replacement });
      } catch {
        clearTimeout(deadline);
        worker?.terminate();
        setState({ result: null, error: 'Regex processing is unavailable in this browser.', pending: false });
      }
    }, 150);
    return () => { clearTimeout(debounce); clearTimeout(deadline); worker?.terminate(); };
  }, [mode, pattern, flags, text, replacement]);
  return state;
}
