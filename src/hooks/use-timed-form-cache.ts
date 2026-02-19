import { useCallback } from "react";

type CacheEntry = {
  data: unknown;
  savedAt: number;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000; // 10分

export function useTimedFormCache<T>(key: string) {
  const restore = useCallback((): T | null => {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.savedAt < TTL_MS) {
      return entry.data as T;
    }
    cache.delete(key);
    return null;
  }, [key]);

  const save = useCallback(
    (data: T) => {
      cache.set(key, { data, savedAt: Date.now() });
    },
    [key]
  );

  const clear = useCallback(() => {
    cache.delete(key);
  }, [key]);

  return { restore, save, clear };
}
