import type { Metadata } from "next";
import { Suspense } from "react";
import { Memory } from "@/features/memory/Memory";

export const metadata: Metadata = { title: "Memory" };

export default function MemoryPage() {
  return (
    <Suspense>
      <Memory />
    </Suspense>
  );
}
