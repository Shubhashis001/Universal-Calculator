import { useCallback, useEffect, useRef, useState } from 'react';
import { backendConfigured, submitUsage } from './launchApi';

const KEY = 'uuh_analytics_consent';
function preference(): 'yes' | 'no' | null {
  try { const saved = localStorage.getItem(KEY); return saved === 'yes' || saved === 'no' ? saved : null; }
  catch { return null; }
}
function stableId(scope: 'local' | 'session', key: string): string {
  // Even accessing localStorage can throw in privacy-restricted browser modes.
  let storage: Storage | undefined;
  try { storage = scope === 'local' ? window.localStorage : window.sessionStorage; }
  catch { /* keep ephemeral tab-local tracking only */ }
  try { const existing = storage?.getItem(key); if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing; }
  catch { /* storage blocked */ }
  const id = crypto.randomUUID();
  try { storage?.setItem(key, id); } catch { /* keep ephemeral ID in the ref */ }
  return id;
}

/** Doesn't collect expressions, fields, text, URLs, passwords, or IP. */
export function useLaunchTracking(activeTool: string) {
  const [consent, setConsent] = useState<'yes' | 'no' | null>(preference);
  const latestTool = useRef(activeTool);
  const previousTool = useRef(activeTool);
  const startedRef = useRef(false);
  const idsRef = useRef<{visitor: string; session: string} | null>(null);
  const ids = useCallback(() => idsRef.current ??= {
    visitor: stableId('local', 'uuh_visitor'),
    session: stableId('session', 'uuh_session'),
  }, []);
  const updateConsent = (choice: 'yes' | 'no') => {
    try { localStorage.setItem(KEY, choice); } catch { /* still respect choice this tab */ }
    if (choice === 'no') {
      idsRef.current = null;
      startedRef.current = false;
      try { localStorage.removeItem('uuh_visitor'); } catch { /* storage blocked */ }
      try { sessionStorage.removeItem('uuh_session'); } catch { /* storage blocked */ }
    }
    setConsent(choice);
  };

  useEffect(() => {
    if (consent !== 'yes' || !backendConfigured) return;
    const { visitor, session } = ids();
    // React StrictMode re-runs effects in development; count the first tool once.
    if (!startedRef.current) {
      startedRef.current = true;
      void submitUsage(session, visitor, 'tool', latestTool.current, 0);
    }
    let last = performance.now();
    let accumulated = 0;
    const flush = (event: 'heartbeat'|'tool', wasVisible = false) => {
      const now = performance.now();
      if (document.visibilityState === 'visible' || wasVisible) accumulated += Math.max(0, (now - last) / 1000);
      last = now;
      const seconds = Math.min(accumulated, 60);
      accumulated = Math.max(0, accumulated - seconds);
      // Hidden/idle tabs produce no useful heartbeat; avoid zero-duration calls.
      if (seconds >= 1 || event === 'tool') void submitUsage(session, visitor, event, latestTool.current, seconds);
    };
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') flush('heartbeat'); }, 60000);
    const visibility = () => { if (document.visibilityState === 'hidden') flush('heartbeat', true); else last = performance.now(); };
    const pagehide = () => flush('heartbeat', document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pagehide); };
  }, [consent, ids]);

  useEffect(() => {
    if (consent !== 'yes' || !backendConfigured) return;
    latestTool.current = activeTool;
    if (previousTool.current === activeTool) return;
    previousTool.current = activeTool;
    const { visitor, session } = ids();
    void submitUsage(session, visitor, 'tool', activeTool, 0);
  }, [activeTool, consent, ids]);

  return { consent, updateConsent, available: backendConfigured };
}
