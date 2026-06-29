"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setTheme(
  theme: "light" | "dark",
  redirectTo?: string
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false, // readable by JS if needed
    sameSite: "lax",
  });
  if (redirectTo) redirect(redirectTo);
}
