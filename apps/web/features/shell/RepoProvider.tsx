"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, fetchRepos, fetchReviewQueue, type Me } from "@/lib/api-client";
import type { Repo } from "@/lib/data";

type RepoContextValue = {
  repos: Repo[];
  repo: Repo | null;
  repoId: string | null;
  setRepoId: (id: string) => void;
  me: Me | null;
  /** Learned decisions waiting for a human (the Reviews badge). */
  reviewCount: number;
  refreshReviewCount: () => void;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

const RepoContext = createContext<RepoContextValue | null>(null);
const STORE = "slovey.repo";

function readStoredRepo(): string | null {
  try {
    return window.localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

/**
 * The whole dashboard's shared state: who is signed in, their repositories and the
 * one they're looking at (remembered per browser), plus the Reviews count shown in
 * the top nav. Loaded once; every screen reads it through useRepo().
 */
export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoId, setRepoIdState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewTick, setReviewTick] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchRepos(), fetchMe()])
      .then(([r, m]) => {
        if (!live) return;
        setRepos(r);
        setMe(m);
        const stored = readStoredRepo();
        setRepoIdState((prev) => {
          const want = prev ?? stored;
          return want && r.some((x) => x.id === want) ? want : (r[0]?.id ?? null);
        });
      })
      .catch((e: unknown) => {
        if (!live) return;
        // A signed-out visitor lands on /login, keeping where they were going.
        if (e instanceof Error && /^401\b/.test(e.message)) {
          window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        setError(e);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [tick]);

  useEffect(() => {
    if (!repoId) return;
    let live = true;
    fetchReviewQueue(repoId)
      .then((q) => {
        if (live) setReviewCount(q.length);
      })
      .catch(() => {
        if (live) setReviewCount(0);
      });
    return () => {
      live = false;
    };
  }, [repoId, reviewTick]);

  const setRepoId = useCallback((id: string) => {
    setRepoIdState(id);
    try {
      window.localStorage.setItem(STORE, id);
    } catch {
      /* private mode: still works for this tab */
    }
  }, []);

  const value = useMemo<RepoContextValue>(
    () => ({
      repos,
      repo: repos.find((r) => r.id === repoId) ?? null,
      repoId,
      setRepoId,
      me,
      reviewCount,
      refreshReviewCount: () => setReviewTick((t) => t + 1),
      loading,
      error,
      reload: () => setTick((t) => t + 1),
    }),
    [repos, repoId, setRepoId, me, reviewCount, loading, error],
  );

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepo(): RepoContextValue {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error("useRepo must be used inside the dashboard");
  return ctx;
}

/** Short repo name for the switcher: "owner/name" shows just "name". */
export function repoShortName(name: string | undefined): string {
  if (!name) return "";
  const i = name.indexOf("/");
  return i >= 0 ? name.slice(i + 1) : name;
}
