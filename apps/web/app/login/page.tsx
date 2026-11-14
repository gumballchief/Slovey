import type { Metadata } from "next";
import { Suspense } from "react";
import { Login } from "@/features/login/Login";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Slovey with GitHub to give your coding agents your team's memory.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
