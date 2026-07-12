# Implementation Notes — Design System Migration

Journal for the `app-redesign` branch. Records what was done per
`implementation_guide.md` step and every technical deviation from the original
code or from the guide itself.

## Completed

### Step 1 + 5 — Tokens, typography, background

- Created `app/theme.css` with both naming schemes: the design-system tokens
  (`--color-*`, hex) and the shadcn HSL variables Tailwind consumes.
- **Deviation from guide:** the guide suggested importing `theme.css` from
  `globals.css` *after* the `:root` block, but CSS `@import` is only valid
  before other rules. Instead `theme.css` is imported from `app/layout.tsx`
  (the guide's alternate option), and the legacy light-theme `:root` block was
  **deleted** from `globals.css` outright rather than kept as fallback — two
  competing `:root` blocks would make the winner import-order-dependent.
- Body now gets the rounded font stack and the fixed radial glow directly in
  `globals.css` `@layer base` (the glow uses `--color-background-glow` with an
  HSL fallback).
- Added to `tailwind.config.js`: `primary.deep`, `success`, `card.raised`
  colors; `card` (24px) and `tile` (16px) border radii. New HSL variables
  introduced: `--card-raised`, `--primary-deep`, `--success`.
- `--border`/`--input` use the HSL-with-alpha form `145 37% 90% / 0.08`;
  `hsl(var(--border))` resolves correctly in modern browsers.

### Step 3 — UI primitives

- `button.tsx`: pill radius, weight 700, `active:scale-[0.98]`, primary =
  green gradient (`from-primary to-primary-deep`), `outline` = green-border
  ghost per design, `secondary` = raised surface, `destructive` = danger tint
  (was solid fill). Sizes: default 44px, lg 48px, icon 44px (mobile UX
  contract minimums).
  - **Deviation:** the design's "Ghost" button maps to the existing `outline`
    variant so no call sites break; the pre-existing `ghost` variant (used for
    icon-only buttons) keeps its subtle hover style.
- `badge.tsx`: added `live` / `settled` / `role` variants; `success` and
  `destructive` became tinted (bg 10% + border 25%) instead of solid fills.
- `card.tsx`: 24px radius, raised→card gradient, `relative` (anchor for
  watermarks), shadow dropped.
  - **Deviation from design spec:** cards do NOT get `overflow-hidden` by
    default — it would clip popovers/comboboxes rendered inside cards.
    Components with watermarks opt in (`SessionCard` does).
- `input.tsx`: 48px, tile radius, inset background (`bg-background/45`),
  focus = primary border with the focus ring removed.
- `bottom-sheet.tsx`: top radius 24px, card-gradient surface. Structure was
  already contract-compliant (drag handle, no X) — untouched.
- `dialog.tsx` (not in guide's table, needed for consistency): card-gradient
  surface, 24px radius on desktop. Mobile keeps full-screen layout.
- `alert.tsx`: tile radius.

### Step 2 — Hardcoded color sweep

Replaced across `app/` and `components/` (18 files):

| Original | Replacement |
|---|---|
| `text-green-600 [dark:...-500/400]` | `text-success` |
| `text-red-600 [dark:...-500/400]` | `text-destructive` |
| `bg-green-100 [dark:bg-green-900/x]` | `bg-success/10` or `/15` |
| `bg-red-100 dark:bg-red-900/40` | `bg-destructive/15` |
| `bg-green-50/50`, `bg-red-50/50` pairs | `bg-success/5`, `bg-destructive/5` |
| `border-green-200`/`border-red-200` pairs | `border-success/25`, `border-destructive/25` |
| blue accents (stats icons, transfer arrow) | `bg-primary/10`, `text-primary` |
| `text-gray-400/600` | `text-muted-foreground` |
| light-theme amber pairs | dark-safe `amber-500`-based classes |

Deviations / deliberate keeps:

- **Amber kept as the warning color** (StageBanner, missing-buyin markers,
  finalization warnings). The design system has no warning token; danger-red
  for "you still need to do X" would be wrong. Candidate for a future
  `--warning` token.
- **`text-yellow-500` kept** for the rank-1 Crown (stats) and Trophy (session
  results) — gold is the semantic color for first place.
- **Hands Chance untouched** except what the sweep normalized: white playing
  cards, amber selection rings, and the `#0a4d2e` felt are that feature's
  deliberate identity per DESIGN_SYSTEM.md §4.
- `ActiveSessionBanner`: solid green LIVE badge → `variant="live"` with
  success-colored ping dot (was white-on-green).

### Step 4 — SessionCard extraction

- New `components/dashboard/SessionCard.tsx`, presentational only (data via
  props): spade watermark, Live (pulsing dot) / Settled badge, stat tiles
  (Players / On table–Pot / optional Buy-ins), full-width CTA — primary
  "Open Session" when live, outline "View Settlement" when settled.
- `app/page.tsx`: Recent Sessions grid now renders `SessionCard`; the inline
  ~50-line card was removed. Data logic untouched.
- `app/sessions/page.tsx`: list-style rows replaced with the same
  `SessionCard` in a responsive grid.
  - **Deviations:** layout changed from vertical list to grid (matches sketch
    screen 5); the per-session "Currency" column was dropped (symbol already
    shown inside the pot value); unused imports removed, `Button` retained for
    the empty state.

## Verification

- `npm run build` (Next 16 / Turbopack): ✓ compiled, ✓ TypeScript, ✓ all 14
  routes prerendered. Supabase env vars must be present (placeholders fine)
  for prerender — pre-existing requirement, unrelated to the redesign.
- `npm run test:e2e` **not run here**: Playwright needs a running dev server +
  Supabase credentials this environment doesn't have. Run locally; expect
  selector updates if any test targets removed markup (e.g. the old sessions
  list layout).

## Remaining (guide step 6 — screen passes)

Global re-skin is live everywhere via tokens + primitives. Screen-specific
layout work still pending, in sketch order: login suit-cluster hero (1), club
pill header (2), profile net-card + sparkline (3, 17), create-session dialog →
bottom sheet (4), filter pills on sessions (5), leaderboard rank rows (6),
stage stepper bars (7, 10), transactions day-divider layout (11), settlement
transfer rows + paid checkmarks (12 — checkmarks are a new feature, needs
product OK), join/invite heroes (13, 16), members kebab sheet (14), link-player
select pills (15).
