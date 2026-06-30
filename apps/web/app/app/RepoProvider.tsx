"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchRepos } from "@/lib/api-client";
import type { Repo } from "@/lib/data";

interface RepoContextValue {
  repos: Repo[];
  activeRepoId: string;
  /** Null until repos load, or when none are connected yet. */
  activeRepo: Repo | null;
  setActiveRepoId: (id: string) => void;
  loading: boolean;
}

const RepoContext = createContext<RepoContextValue | null>(null);

/**
 * Holds the repo list + the active repo for the whole dashboard. Starts empty
 * and loads the real repos from /api/repos — no mock seeding. When no repos are
 * connected, `repos` stays empty and consumers show an empty state.
 */
export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRepos()
      .then((live) => {
        if (cancelled) return;
        setRepos(live);
        if (live.length > 0) {
          setActiveRepoId((prev) => (live.some((r) => r.id === prev) ? prev : live[0]!.id));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? null;

  return (
    <RepoContext.Provider value={{ repos, activeRepoId, activeRepo, setActiveRepoId, loading }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo(): RepoContextValue {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error("useRepo must be used within RepoProvider");
  return ctx;
}
