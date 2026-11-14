import type { Metadata } from "next";
import { Connect } from "@/features/connect/Connect";

export const metadata: Metadata = { title: "Connect your agent" };

export default function ConnectPage() {
  return <Connect />;
}
