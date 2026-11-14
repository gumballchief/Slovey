import type { Metadata } from "next";
import { Connectors } from "@/features/connectors/Connectors";

export const metadata: Metadata = { title: "Connectors" };

export default function ConnectorsPage() {
  return <Connectors />;
}
