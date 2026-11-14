"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DataState<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  /** Optimistic local update (e.g. after approving a decision). */
  mutate: (next: T | ((prev: T | undefined) => T)) => void;
};

/**
 * Load data for a screen. `key` null means "not ready" (no repo yet): nothing is
 * fetched and the screen stays in its loading state. Data is tagged with the key
 * it was loaded for, so switching repos can never show the previous repo's data,
 * and a slower old request can never overwrite a newer one.
 */
export function useData<T>(key: string | null, load: () => Promise<T>): DataState<T> {
  const [slot, setSlot] = useState<{ key: string | null; data: T | undefined }>({ key: null, data: undefined });
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let live = true;
    setPending(true);
    setError(null);
    loadRef
      .current()
      .then((d) => {
        if (live) setSlot({ key, data: d });
      })
      .catch((e: unknown) => {
        if (live) setError(e);
      })
      .finally(() => {
        if (live) setPending(false);
      });
    return () => {
      live = false;
    };
  }, [key, tick]);

  const data = slot.key === key ? slot.data : undefined;
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const mutate = useCallback((next: T | ((prev: T | undefined) => T)) => {
    setSlot((s) => ({
      key: s.key,
      data: typeof next === "function" ? (next as (p: T | undefined) => T)(s.data) : next,
    }));
  }, []);

  return {
    data,
    error: data === undefined ? error : null,
    loading: key === null || (pending && data === undefined && !error),
    reload,
    mutate,
  };
}
