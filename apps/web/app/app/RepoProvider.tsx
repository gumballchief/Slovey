"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchRepos, REPOS } from "@/lib/api-client";
import type { Repo } from "@/lib/data";

interface RepoContextValue {
  repos: Repo[];
  activeRepoId: string;
  activeRepo: Repo;
  setActiveRepoId: (id: string) => void;
  loading: boolean;
}

const RepoContext = createContext<RepoContextValue | null>(null);

/**
 * Holds the repo list + the active repo for the whole dashboard. Seeds with the
 * bundled mock repos for instant first paint, then replaces with live repos from
 * /api/repos when the backend is available.
 */
export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = useState<Repo[]>(REPOS);
  const [activeRepoId, setActiveRepoId] = useState<string>(REPOS[0].id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRepos()
      .then((live) => {
        if (cancelled || live.length === 0) return;
        setRepos(live);
        setActiveRepoId((prev) => (live.some((r) => r.id === prev) ? prev : live[0].id));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? repos[0];

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
