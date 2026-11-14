import type { Metadata } from "next";
import { Connectors } from "@/features/connectors/Connectors";

export const metadata: Metadata = { title: "Sources" };

export default function ConnectorsPage() {
  return <Connectors />;
}
