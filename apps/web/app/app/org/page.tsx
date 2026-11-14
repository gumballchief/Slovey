import type { Metadata } from "next";
import { Team } from "@/features/account/Team";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return <Team />;
}
