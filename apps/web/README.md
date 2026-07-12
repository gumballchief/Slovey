# Slovey

Engineering memory for your team. Remembers every decision, warns before a PR violates one.

## Running locally

```bash
cd company-brain
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the next available port).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/demo` | Interactive demo workspace — no install needed |
| `/app` | Overview dashboard |
| `/app/memory` | Searchable decision memory |
| `/app/pull-requests` | Checked PRs with verdict detail |
| `/app/connectors` | Data source connectors by layer |
| `/app/settings` | Confidence threshold and trigger settings |

## Design tokens

All tokens are CSS variables defined in `app/globals.css`:

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#FFFFFF` | `#0A0F1C` |
| `--bg-subtle` | `#F4F8FC` | `#0E1526` |
| `--surface` | `#FFFFFF` | `#111A2E` |
| `--primary` | `#0EA5E9` | `#38BDF8` |
| `--text` | `#0F172A` | `#E6EDF7` |
| `--text-muted` | `#64748B` | `#94A3B8` |
| `--border` | `#E2E8F0` | `#1E293B` |

Typography: **Space Grotesk** (display — h1/h2 + big numbers), **Inter** (body), **JetBrains Mono** (PR numbers, citations, eyebrow labels, stat units — the brand's connective tissue).

## The Memory Core (hero centerpiece)

`components/core/` holds the signature 3D scene, built with `three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`:

- **`MemoryCoreScene.tsx`** — the live scene: an icosahedron core with a custom fresnel-rim shader + sine-noise vertex displacement (breathing), 3 tilted orbital rings, ~160 instanced decision nodes drifting on the orbits (hover for a mono tooltip), a 1.4k-point starfield with cursor parallax, ACES tone-mapping + selective Bloom. A product-moment loop fires every ~6s: a node flies in from the right, the core pulses, then a green "clear" or a coral conflict line snaps to an orbiting decision with a mono callout.
- **`MemoryCore.tsx`** — lazy wrapper: `next/dynamic` (`ssr:false`), an SVG **poster fallback** while loading / under `prefers-reduced-motion` / no WebGL, and an `IntersectionObserver` that pauses the render loop offscreen. `dpr={[1,2]}`.

Motion system: `lenis` smooth scroll (`components/motion/SmoothScroll.tsx`), a power-on intro loader (`IntroLoader.tsx`), scroll reveals (`components/ui/Reveal.tsx`), count-up stats — all gated behind `prefers-reduced-motion`.

Dark mode uses the `dark` class on `<html>`, persisted in a `theme` cookie (SSR-safe, no flash).

## Integration seams

All data is read from **`lib/data.ts`** — the clearly-marked seam where real backends plug in.

| Seam | What plugs in |
|------|--------------|
| `DECISIONS` array | Memory DB query (Postgres/vector store) |
| `CHECKED_PRS` array | GitHub App webhook events + check pipeline |
| `REPOS` array | GitHub App installation list |
| `CONNECTORS` array | OAuth connector status from auth service |
| `Button onClick` on Connect | OAuth redirect to connector auth flow |
| Settings `handleRebuild` | POST to memory rebuild job queue |

The types in `lib/data.ts` match the `brain.json` schema exactly — swap the arrays for real API calls and the UI updates with no changes needed.

## Component library

Located in `components/ui/`:

- `Button` — primary / secondary / ghost / danger variants
- `VerdictPill` — conflict (coral) / clear (green) / pending (amber)
- `Badge` — source labels, status badges
- `SearchInput` — controlled/uncontrolled with clear
- `Toggle` — accessible switch with aria-checked
- `Stat` — metric card with trend
- `EmptyState` — with icon, title, description, action
- `ThemeToggle` — instant client-side dark/light switch

## Tech

- **Next.js 16** (App Router, React Server Components)
- **TypeScript** — strict mode
- **Tailwind CSS v4** — CSS-first config via `@theme`
- **lucide-react** — icons
- **recharts** — area charts on Overview
- **Space Grotesk + JetBrains Mono** via `next/font/google`
