import { useCallback, useEffect, useState } from 'react';
import { readStored } from './storageData';

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try { return readStored(key, initial, localStorage); } catch { return initial; }
  });

  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageError('');
    } catch {
      setStorageError('Changes are in memory only. Browser storage is unavailable or full.');
    }
  }, [key, value]);

  return [value, setValue, storageError] as const;
}

export function useFavorites() {
  const [favs, setFavs] = useLocalStorage<string[]>('uuh:favorites', []);
  const toggle = useCallback(
    (id: string) => {
      setFavs((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    },
    [setFavs],
  );
  const isFav = useCallback((id: string) => favs.includes(id), [favs]);
  return { favs, toggle, isFav };
}

export function useRecents() {
  const [recents, setRecents] = useLocalStorage<string[]>('uuh:recents', []);
  const push = useCallback(
    (id: string) => {
      setRecents((prev) => prev[0] === id ? prev : [id, ...prev.filter((r) => r !== id)].slice(0, 8));
    },
    [setRecents],
  );
  return { recents, push };
}
