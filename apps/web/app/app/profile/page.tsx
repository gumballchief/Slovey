import type { Metadata } from "next";
import { Profile } from "@/features/account/Profile";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return <Profile />;
}
