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

## Step 6 — screen passes (done)

- **Login (1)**: `LoginGate` got the suit-cluster hero (♠ primary, ♣/♦ faded)
  and "Let's get started" headline; `LoginDialog` Google button switched
  `outline` → `secondary` (neutral surface per sketch — OAuth is not the
  screen's primary action), divider chip `bg-background` → `bg-card` to sit on
  the new dialog surface.
- **Profile (3)**: avatar hero added (initials derived client-side from
  display name/email — presentation only). **Deviation from sketch:** the
  all-time-net card + win-rate tiles were NOT added; profile page has no stats
  data today and adding Supabase queries is out of scope for a visual pass.
  Flagged as follow-up.
- **Stats (6) / Player stats (17)**: inherit primitives + semantic money
  colors from steps 2–3; no layout change. Sketch-17 sparkline deferred (needs
  per-session series plumbing).
- **Create Session (4) / Login dialog**: mobile bottom-anchored dialogs bumped
  to 24px top radius. **Deviation from sketch:** not converted to the
  `BottomSheet` component — the existing Dialog already implements the
  bottom-sheet behavior (bottom-anchored, scroll-safe, keyboard-safe) and a
  swap would touch tested form logic for zero functional gain.
- **Sessions (5)**: **filter pills NOT added** — the page intentionally
  queries finalized sessions only (`.not("finalized_at","is",null)`); a
  Live/All filter changes the data contract. Needs product decision.
- **Session detail steppers (7/10)**: `Stepper` connectors are now 4px
  primary progress bars; completed steps solid green. The 5-step model
  (Setup/Buy-ins/Cash-outs/Results/Share) was kept — the sketch's 4-bar
  stepper collapses Results+Share, and renaming steps is a product call.
- **Join club (13)**: ♣ suit hero replaces the Users icon, "Join your crew"
  title, code input restyled (56px, centered, mono, 0.3em tracking). Unused
  `Users` import removed.
- **Invite landing (16) / Transactions (11) / Settlement (12) / Members (14)
  / Link players (15)**: inherit primitives; layouts unchanged. Settlement
  "paid" checkmarks from sketch 12 are a new feature — awaiting product OK.

## Verification (step 6 pass)

- `npm run build`: ✓ all 14 routes compile and prerender.

## Layout pass (per layout_guide.md)

### L1 — shared layout components

Created the three shared primitives from layout_guide.md §1:

- `components/layout/StickyCta.tsx` — mobile-only fixed bottom action bar,
  background fade to `--background`, safe-area bottom padding. Pages using it
  must add `pb-28 sm:pb-6`.
- `components/ui/stat-strip.tsx` — one-row inset stat tiles (`rounded-tile`,
  `bg-background/45`, uppercase 11px label over 18px extrabold tabular value).
  Optional `accent: "success" | "danger"` for result-money only.
- `components/ui/list-row.tsx` — 36px tinted avatar circle + title/subtitle +
  right-aligned slot. Renders as `Link` when `href` given, `button` when
  `onClick` given, plain `div` otherwise; only interactive rows get the
  `active:scale-[0.985]` press state.

Deviations from the guide's snippets (all additive, none visual):

- `StickyCta` and `StatStrip` accept an optional `className` for per-screen
  tweaks (e.g. z-index coordination with dialogs).
- `ListRow` gained an `onClick` variant (guide only showed `href`) — needed
  for rows that open sheets/edit states (Profile display-name row, members
  kebab) without wrapping the component in an extra `<button>`.
- `StatStrip` labels get `whitespace-nowrap` and values `truncate` so long
  currency values can't wrap the tile to two heights.
- Not yet done: refactoring `SessionCard`'s internal tiles onto `StatStrip`
  (guide §1 suggests it) — deferred to the dashboard screen pass so the card
  changes once, together with its screen.

Verification: `npm run build` ✓ (components compile; no call sites yet — they
land screen-by-screen in the next passes).

### L2 — Dashboard (layout_guide.md §2)

- **Header**: subtitle removed, title fixed at `text-2xl`; New Session button
  is now `hidden sm:inline-flex` (desktop-only in the header).
- **Stats Overview**: the four full `<Card>` blocks replaced by one
  `<StatStrip>` (Games / Live / Total pot / Avg pot). All four calculations
  untouched. Unused imports dropped (`TrendingUp`, `TrendingDown`,
  `DollarSign`, `Calendar`, `Badge`, `cn`, `CardHeader/Title/Description`).
- **Recent Sessions**: header demoted `text-2xl` → `text-base font-semibold`,
  renamed "Recent games", ghost "See all →" link to `/sessions` added.
- **StickyCta**: mobile New Session button (same handler); page padding is now
  `p-4 pb-28 sm:p-6 sm:pb-6`; `bg-background` removed from the page div so
  the body glow shows through.
- **ActiveSessionBanner** restructured into the hero card: spade watermark
  (the screen's one allowed watermark), name at H3 + Live badge on the title
  row, `StatStrip` (Players / On table / Elapsed), full-width primary
  "Resume Session" inside the card. Elapsed-time logic untouched.
  - **Deviation:** the old side-by-side desktop layout (text left, button
    right) was dropped — the hero is stacked at all breakpoints per sketch 2.
    The `bg-primary/5` tint was dropped in favor of the standard card gradient
    + `border-primary/30` (hero is distinguished by size/watermark, not tint).
- **SessionCard**: internal stat tiles refactored onto `StatStrip`
  (guide §1 note). Visual delta: tile values go `text-base font-bold` →
  `text-lg font-extrabold`, and the strip is a single row app-wide.

Verification: `npm run build` ✓.

### L3 — Profile (layout_guide.md §3, the worked example)

- **Identity hero promoted**: avatar 80px → 96px (`h-24 w-24 text-3xl`), name
  now H2 (`text-2xl font-bold`), and a `role` Badge added under it sourced
  from `useClub().activeClub?.role` (rendered only when a club is active).
- **Net-result card added** via new shared `components/stats/NetResultCard.tsx`
  (spade watermark, ALL-TIME NET label, 28px signed money in success/danger,
  StatStrip: Games / Win rate / Best night). Data comes from the existing
  `lib/stats/calc.ts` loaders + `getSessionHistoryForProfile` filtered to the
  logged-in user — the reuse sanctioned by the guide's data note. Card is
  omitted entirely when there's no active club or no finalized history.
  - Win rate = sessions with positive P/L ÷ sessions played (computed from
    history entries; `PlayerStat` has no win-rate field).
- **Account section**: the form-style Card was deleted; Display name and
  Email are now `ListRow`s under an H4 "Account" header. The display-name
  edit state machine (`isEditing`/`handleSaveEdit`/`saveError`) is unchanged —
  the row swaps to the original edit block (Input + ✓/✕) wrapped in a tile
  shell while editing.
- **Logout demoted**: `variant="destructive"` fill → ghost with
  `text-destructive` + `hover:bg-destructive/10`. It is no longer the loudest
  element on the screen.
- `bg-background` dropped from the page div (body glow).
- **Deviation:** loading/error states moved above the hero as centered
  captions (previously inside the deleted Card); no skeleton for the stats
  card — it simply appears when data lands, per the guide's "no empty-state
  skeleton" instruction.

Verification: `npm run build` ✓.

### L4 — Sessions (layout_guide.md §4)

- **Data contract change (sanctioned by the guide):** the query dropped
  `.not("finalized_at","is",null)` — the page now loads ALL club sessions,
  ordered by `created_at` desc (was `finalized_at` desc, which can't order
  live sessions). Filtering happens client-side.
- **Filter pills** added (All / Live / Settled), pill segmented control,
  default **All**. Active pill: `border-primary/40 bg-primary/15 text-primary`.
- **Header**: "Session History" + subtitle → just "Games" at `text-2xl`
  (root-screen header per guide §1; the pills make "history" wrong anyway).
- Per-pill empty states ("No live games right now" / "No settled games yet");
  the dashboard CTA shows only on the All pill.
- `bg-background` dropped from the page div. Unused `Transaction` import
  removed.

Verification: `npm run build` ✓.
