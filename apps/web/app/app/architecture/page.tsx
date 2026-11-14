import type { Metadata } from "next";
import { Architecture } from "@/features/architecture/Architecture";

export const metadata: Metadata = { title: "Architecture" };

export default function ArchitecturePage() {
  return <Architecture />;
}
