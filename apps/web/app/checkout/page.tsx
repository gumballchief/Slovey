import { Suspense } from "react";
import { Checkout } from "@/features/checkout/Checkout";

export default function CheckoutPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
