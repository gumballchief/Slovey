import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutComplete } from "@/features/checkout/CheckoutComplete";

export const metadata: Metadata = { title: "Payment received" };

export default function CheckoutCompletePage() {
  return (
    <Suspense>
      <CheckoutComplete />
    </Suspense>
  );
}
