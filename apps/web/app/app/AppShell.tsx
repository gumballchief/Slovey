"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { usePathname } from "next/navigation";
import { RepoProvider } from "./RepoProvider";

const PAGE_TITLES: Record<string, string> = {
  "/app": "Overview",
  "/app/ask": "Ask Brain",
  "/app/memory": "Memory",
  "/app/review": "Review",
  "/app/architecture": "Architecture",
  "/app/pull-requests": "Pull Requests",
  "/app/connectors": "Connectors",
  "/app/org": "Organization",
  "/app/billing": "Billing",
  "/app/profile": "Profile",
  "/app/settings": "Settings",
};

export function AppShell({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Company Brain";

  return (
    <RepoProvider>
      <div className="flex h-dvh overflow-hidden bg-[var(--bg)]">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar title={title} isDark={isDark} onMenuOpen={() => setMobileOpen(true)} />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto bg-[var(--bg-subtle)]"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </RepoProvider>
  );
}
