import type { Metadata } from "next";
import { Suspense } from "react";
import { Preflight } from "@/features/preflight/Preflight";

export const metadata: Metadata = { title: "Preflight" };

export default function PreflightPage() {
  return (
    <Suspense>
      <Preflight />
    </Suspense>
  );
}
