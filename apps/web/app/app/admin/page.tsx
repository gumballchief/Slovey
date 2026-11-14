import type { Metadata } from "next";
import { Admin } from "@/features/account/Admin";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <Admin />;
}
