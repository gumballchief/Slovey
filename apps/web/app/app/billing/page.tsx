import type { Metadata } from "next";
import { Suspense } from "react";
import { Billing } from "@/features/billing/Billing";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}
