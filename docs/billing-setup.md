# Stripe billing — setup

The integration is fully built and env-gated: until the three Stripe variables
are set, billing endpoints return 503 and the app behaves exactly as before
(manual plan switch stays available for free/enterprise).

## How it works

- **Upgrade:** Billing page → "Upgrade" → `POST /api/repos/:id/billing/checkout`
  → Stripe Checkout (subscription, Pro price) → on success the **webhook**
  (`POST /api/billing/webhook`, signature-verified) sets the org's plan to
  `pro` and stores the customer/subscription ids on `organizations`.
- **Manage / cancel:** Billing page → "Manage billing" → Stripe customer
  portal. Cancellation flows back through `customer.subscription.deleted` →
  plan drops to `free`.
- **Gating:** agent runs are metered per org per calendar month
  (`AGENT_RUNS_PER_MONTH`: free 20 · pro 500 · enterprise unlimited) — the
  tasks API returns 402 with an upgrade message at the cap. Repo/decision
  limits were already enforced via `PLAN_LIMITS`.
- Manual PATCH plan-switching to `pro` is blocked once Stripe is configured
  (payments are the only path to paid). Enterprise stays sales-led.

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
