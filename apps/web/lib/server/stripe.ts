import Stripe from "stripe";
import { type BillingInterval, type PaidPlan, PLANS, isPaidPlan } from "@company-brain/core/plans";
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

export type { BillingInterval } from "@company-brain/core/plans";

/**
 * Every paid plan has one Stripe product with a fixed id (slovey_plan_<plan>).
 * Prices stay inline (price_data, from the plan catalog) so no dashboard setup
 * is needed, but the fixed product is what lets a subscription move between
 * plans in place, and what tells the webhook which plan a subscription is on.
 */
const PRODUCT_PREFIX = "slovey_plan_";
const ensured = new Set<string>();

export function planProductId(plan: PaidPlan): string {
  return `${PRODUCT_PREFIX}${plan}`;
}

/** The paid plan a Stripe product id belongs to, or null for anything else. */
export function planFromProductId(productId: string | null | undefined): PaidPlan | null {
  if (!productId?.startsWith(PRODUCT_PREFIX)) return null;
  const plan = productId.slice(PRODUCT_PREFIX.length);
  return isPaidPlan(plan) ? plan : null;
}

/** Create the plan's Stripe product the first time it's needed. Safe to call concurrently. */
export async function ensurePlanProduct(plan: PaidPlan): Promise<string> {
  const id = planProductId(plan);
  if (ensured.has(id)) return id;
  const stripe = getStripe();
  try {
    await stripe.products.retrieve(id);
  } catch (e) {
    if ((e as { code?: string }).code !== "resource_missing") throw e;
    try {
      await stripe.products.create({ id, name: `Slovey ${PLANS[plan].name}`, metadata: { plan } });
    } catch (e2) {
      // Another request created it first.
      if ((e2 as { code?: string }).code !== "resource_already_exists") throw e2;
    }
  }
  ensured.add(id);
  return id;
}

/**
 * Price + quantity for one paid plan, from the plan catalog (the same numbers
 * the pricing page shows). Per-seat plans charge per seat; flat plans are one
 * unit for the workspace.
 */
export async function planItem(
  plan: PaidPlan,
  interval: BillingInterval,
  seats: number,
): Promise<{
  price_data: {
    currency: string;
    product: string;
    unit_amount: number;
    recurring: { interval: "year" | "month" };
  };
  quantity: number;
}> {
  const p = PLANS[plan];
  const annual = interval === "annual";
  const perMonth = annual ? p.price!.annual : p.price!.monthly;
  return {
    price_data: {
      currency: "usd",
      product: await ensurePlanProduct(plan),
      // cents per unit per billing period
      unit_amount: perMonth * (annual ? 12 : 1) * 100,
      recurring: { interval: annual ? "year" : "month" },
    },
    quantity: p.billing === "seat" ? seats : 1,
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
