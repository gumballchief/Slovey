# Slovey web

The Next.js 16 app behind slovey.ai: the public site, sign-in, checkout, the dashboard and every HTTP API
(GitHub webhooks, Stripe, the CLI and MCP endpoints). Business logic lives in `@company-brain/core`; this app
is the surface.

## Running locally

```bash
pnpm install
pnpm dev:web
```

Open http://localhost:3000. Without Supabase keys the app runs in single-user dev mode: sign-in is skipped and
you act as the local owner. Without `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` the checkout page explains that
payments are off instead of loading the payment form.

## Layout

| Path | What it holds |
|------|---------------|
| `app/` | Routes only. Each page file imports one feature component and sets metadata. |
| `app/api/` | Route handlers. `lib/server/respond.ts` turns thrown errors into JSON responses. |
| `features/` | One folder per screen: component plus its stylesheet. |
| `features/shell/` | The dashboard frame: floating nav bar, phone tab bar, repo switcher, Ctrl/Cmd+K palette. |
| `features/site/` | Shared pieces of the public pages: nav, footer, art hero band, legal layout. |
| `landing/` | The home page. |
| `ui/` | The design system: `ui.css` (tokens and components, scoped to `.ui`) and `kit.tsx` (React wrappers). |
| `lib/api-client.ts` | Typed fetchers the dashboard uses to call `app/api`. |
| `lib/server/` | Server-only helpers: auth, rate limiting, Stripe, Supabase. |

## Routes

| Route | Screen |
|-------|--------|
| `/` | Landing page |
| `/login` | Sign in with GitHub, Google or email |
| `/checkout`, `/checkout/complete` | Paid-plan checkout for Pro, Team, Business and Scale (Stripe Checkout Sessions, elements mode; plans in `packages/core/src/plans.ts`) |
| `/app` | Today: what changed, what was blocked, what needs you |
| `/app/memory` | The decision graph as a map or a list |
| `/app/review` | Approve or reject learned decisions (A / R / J / K) |
| `/app/ask` | Ask the memory, ask "can I", or plan a change |
| `/app/pull-requests`, `/app/preflight`, `/app/tasks` | Checked PRs, local preflight runs, agent tasks |
| `/app/architecture`, `/app/connectors` | Repository map and connected sources |
| `/app/org`, `/app/profile`, `/app/billing`, `/app/settings` | Account |
| `/docs`, `/mcp`, `/api-reference`, `/integrations`, `/demo` | Product pages |
| `/changelog`, `/about`, `/careers`, `/contact`, `/security`, `/privacy`, `/terms` | Company pages |

## Design

- Type: Bellefair (display caps), Afacad Flux (text), Geist Mono (labels, refs, code). All three are
  self-hosted from `app/fonts/` or the `geist` package, so builds never fetch fonts.
- Colour: deep navy ground (`--bg #06070f`), one blue accent (`--blue #3d7bff`), red reserved for blocks.
- Tokens and components are in `ui/ui.css`; portals (sheets, menus, dialogs) carry `ui-portal` so they get the
  same tokens outside the `.ui` tree.

## Checks

```bash
pnpm --filter @company-brain/web typecheck
pnpm --filter @company-brain/web build
```
