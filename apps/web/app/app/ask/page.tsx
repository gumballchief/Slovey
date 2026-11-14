import type { Metadata } from "next";
import { Suspense } from "react";
import { Ask } from "@/features/ask/Ask";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return (
    <Suspense>
      <Ask />
    </Suspense>
  );
}
