import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: "Company Brain — The intelligence layer beneath your AI coding agents",
  description:
    "AI writes great code — it just doesn't know your company. Company Brain gives it your context: your codebase, decisions, and history, so mistakes are caught before code is ever committed.",
};

export default function LandingPage() {
  return <Landing />;
}
