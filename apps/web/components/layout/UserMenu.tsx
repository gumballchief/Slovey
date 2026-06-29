"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Loading: a quiet placeholder so layout doesn't jump.
  if (status === "loading") {
    return <div className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] animate-pulse" />;
  }

  // Signed out → a clear sign-in affordance.
  if (status !== "authenticated") {
    return (
      <button
        onClick={() => signIn("github")}
        className="inline-flex items-center gap-1.5 label-mono px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
      >
        <LogIn size={13} />
        Sign in
      </button>
    );
  }

  const user = session.user as { name?: string | null; email?: string | null; login?: string; image?: string | null };
  const label = user.login || user.name || user.email || "you";
  const initial = (label[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-expanded={open}
        className="w-7 h-7 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-xs font-semibold cursor-pointer overflow-hidden"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={label} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 z-50 card shadow-lg overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="px-3 py-2.5 border-b border-[var(--border)]">
            <p className="text-sm font-medium text-[var(--cb-text)] truncate">{label}</p>
            {user.email && (
              <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-[var(--cb-text)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <LogOut size={14} className="text-[var(--text-muted)]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
