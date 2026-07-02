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

/** Price id for the Pro subscription (created in the Stripe dashboard). */
export function proPriceId(): string {
  const id = process.env.STRIPE_PRICE_PRO;
  if (!id) throw new HttpError(503, "Billing is not configured (STRIPE_PRICE_PRO missing)");
  return id;
}

export function webhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new HttpError(503, "Billing is not configured (STRIPE_WEBHOOK_SECRET missing)");
  return s;
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3008";
}
