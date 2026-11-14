import type { Metadata } from "next";
import { Reviews } from "@/features/review/Reviews";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewPage() {
  return <Reviews />;
}
