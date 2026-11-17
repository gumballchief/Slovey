# Stripe billing — setup

The integration is fully built and env-gated: until the three Stripe variables
are set, billing endpoints return 503 and the app behaves exactly as before
(manual plan switch stays available for free/enterprise).

## How it works

- **Plans:** every name, price and limit lives in one file,
  `packages/core/src/plans.ts` (Starter, Pro, Team, Business, Scale,
  Enterprise). The pricing page, checkout, Stripe line items, webhook and
  usage gates all read it. Change a price there and everything follows.
- **Upgrade:** pricing page or Billing → `/checkout?plan=<id>` →
  `POST /api/repos/:id/billing/checkout` with `{ plan, interval, seats }`
  → Stripe Checkout (inline price, `plan` written to session + subscription
  metadata) → on success the **webhook** (`POST /api/billing/webhook`,
  signature-verified) sets the org's plan to that `plan` (subscriptions with
  no `plan` metadata predate the catalog and count as `pro`) and stores the
  customer/subscription ids on `organizations`.
- **Manage / cancel:** Billing page → "Manage billing" → Stripe customer
  portal. Cancellation flows back through `customer.subscription.deleted` →
  plan drops to `free`. Switching between paid plans is done by hand for now
  (Billing page "Change plan" emails support).
- **Gating:** repos, decisions and agent runs per calendar month are capped
  per plan from the catalog (`PLAN_LIMITS`, `AGENT_RUNS_PER_MONTH`); the APIs
  return 402 with an upgrade message at the cap.
- Manual PATCH plan-switching to any paid plan is blocked once Stripe is
  configured (payments are the only path to paid). Enterprise stays sales-led.

## One-time setup (dashboard steps — owner only)

1. **Create the Stripe account** at dashboard.stripe.com (start in **Test
   mode**).
2. **Product:** Products → Add product → name "Company Brain Pro" → price
   **$20.00 USD, recurring monthly** → save → copy the **Price ID**
   (`price_…`) → `STRIPE_PRICE_PRO`.
3. **API key:** Developers → API keys → copy the **Secret key** (`sk_test_…`)
   → `STRIPE_SECRET_KEY`.
4. **Webhook:** Developers → Webhooks → Add endpoint →
   `https://company-brain-web-u04w.onrender.com/api/billing/webhook`
   → events: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`
   → copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.
5. Put all three in the local `.env` **and** the Render env group
   (`company-brain`), then redeploy.
6. **Test:** Billing page → Upgrade → pay with Stripe's test card
   `4242 4242 4242 4242` (any future date/CVC) → you should land back on
   `/app/billing?checkout=success` and the plan flips to Pro within seconds.
7. For local webhook testing use the Stripe CLI:
   `stripe listen --forward-to localhost:3008/api/billing/webhook` (it prints a
   temporary `whsec_…` for your local `.env`).
8. Going live later: switch the dashboard out of Test mode, repeat steps 2–4
   for live keys, replace the three env values.
