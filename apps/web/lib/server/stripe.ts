import Stripe from "stripe";
import { HttpError } from "./respond";

let _stripe: Stripe | null = null;

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazy Stripe client. Throws a clean 503 when billing isn't configured yet. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(503, "Billing is not configured (STRIPE_SECRET_KEY missing)");
  _stripe = new Stripe(key);
  return _stripe;
}

export type BillingInterval = "annual" | "monthly";

/**
 * Pro subscription line item, built inline (price_data) so no Stripe-dashboard
 * product/price setup is required. $19/user/mo billed annually, or $24/user/mo
 * billed monthly — keep in sync with the landing pricing card.
 */
export function proLineItem(interval: BillingInterval): {
  price_data: {
    currency: string;
    product_data: { name: string };
    unit_amount: number;
    recurring: { interval: "year" | "month" };
  };
  quantity: number;
  adjustable_quantity: { enabled: boolean; minimum: number; maximum: number };
} {
  const annual = interval === "annual";
  return {
    price_data: {
      currency: "usd",
      product_data: {
        name: annual ? "Slovey Team — annual ($19/user/mo, billed yearly)" : "Slovey Team — monthly ($24/user/mo)",
      },
      unit_amount: annual ? 22800 : 2400, // cents per seat per period
      recurring: { interval: annual ? "year" : "month" },
    },
    quantity: 1,
    adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 },
  };
}

export function webhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new HttpError(503, "Billing is not configured (STRIPE_WEBHOOK_SECRET missing)");
  return s;
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3008";
}
