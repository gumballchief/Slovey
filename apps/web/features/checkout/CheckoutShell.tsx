"use client";

import "@/ui/ui.css";
import "./checkout.css";
import { ArrowLeftIcon, LockSimpleIcon } from "@phosphor-icons/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";
import { Toaster } from "sonner";
import { RepoProvider } from "@/features/shell/RepoProvider";
import { Mark } from "@/ui/kit";

/** Focused frame for checkout: logo, a way back, and nothing else to wander off to. */
export function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <RepoProvider>
      <Tooltip.Provider>
        <div className="ui co-shell">
          <header className="co-head">
            <Link href="/app" className="co-brand">
              <Mark size={28} />
              Slovey
            </Link>
            <span className="co-secure">
              <LockSimpleIcon size={14} /> Secure checkout
            </span>
          </header>
          {children}
          <div style={{ textAlign: "center", paddingBottom: 40 }}>
            <Link href="/app/billing" className="ui-btn ui-btn--ghost ui-btn--sm">
              <ArrowLeftIcon size={14} /> Back to Slovey
            </Link>
          </div>
        </div>
      </Tooltip.Provider>
      <Toaster position="bottom-right" toastOptions={{ className: "ui-toast" }} />
    </RepoProvider>
  );
}
