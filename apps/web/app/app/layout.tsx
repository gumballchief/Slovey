import { cookies } from "next/headers";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  // Default LIGHT — the app must open looking like the landing page.
  const theme = cookieStore.get("theme")?.value ?? "light";
  const isDark = theme === "dark";

  return <AppShell isDark={isDark}>{children}</AppShell>;
}
