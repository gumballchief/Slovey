import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: "Slovey — The intelligence layer beneath your AI coding agents",
  description:
    "AI writes great code — it just doesn't know your company. Slovey gives it your context: your codebase, decisions, and history, so mistakes are caught before code is ever committed.",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // OAuth-code rescue: when a Supabase redirect URL isn't allowlisted, Supabase
  // falls back to the Site URL, so the `?code=` lands here on `/` instead of at
  // `/auth/callback`. Route it to the callback so sign-in actually completes.
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;
  if (code) {
    const next = typeof params.next === "string" ? params.next : "/app";
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
  }
  return <Landing />;
}
