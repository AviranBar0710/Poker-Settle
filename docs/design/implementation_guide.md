# Design System — Implementation Guide

How to migrate the new dark design system (see `DESIGN_SYSTEM.md`) into the
existing Next.js / Tailwind / Radix codebase without breaking logic.

## Guiding principle

The codebase already uses semantic CSS variables (`--background`, `--card`,
`--primary`, …) consumed by `tailwind.config.js`. The migration is therefore
**variable-first**: re-skin globally by redefining tokens, then adjust component
variants, then fix stragglers. Do not rewrite page logic.

## Step 1 — Create `app/theme.css`

Add the new tokens alongside the existing shadcn-style names so both naming
schemes resolve to the same values:

```css
:root {
  /* New design-system tokens */
  --color-background: #0b1118;
  --color-card-bg: #16202c;
  /* ... all tokens from DESIGN_SYSTEM.md ... */

  /* Map to existing shadcn HSL variables (Tailwind consumes these) */
  --background: 210 37% 7%;        /* #0b1118 */
  --card: 212 33% 13%;             /* #16202c */
  --primary: 147 69% 55%;          /* #3ddc84 */
  --primary-foreground: 140 33% 8%;/* #0d1a12 */
  --foreground: 140 32% 90%;       /* #dcefe4 */
  --muted-foreground: 210 17% 58%; /* #8294a5 */
  --destructive: 0 100% 71%;       /* #ff6b6b */
  --border: 140 32% 90% / 0.08;
  --radius: 1rem;
}
```

Import it in `app/layout.tsx` (or from `globals.css`) **after** the existing
`:root` block so it wins the cascade. Once stable, delete the old light values.

## Step 2 — Audit hardcoded colors

Search for classes that bypass the token system and will break on dark:

```bash
grep -rn "bg-white\|bg-gray\|text-gray\|text-black\|bg-slate\|border-gray" app components features
```

Replace hits with semantic classes (`bg-card`, `text-muted-foreground`,
`border-border`).

## Step 3 — Update UI primitives (`components/ui/`)

| File | Change |
|---|---|
| `button.tsx` | `rounded-full`, `min-h-[48px]`, primary variant → bold green gradient, add `ghost` (green border) and keep `secondary` as surface style. Add `active:scale-[0.98]`. |
| `badge.tsx` | `rounded-full`, add `live` / `settled` / `role` variants with tinted bg + border. |
| `card.tsx` | Radius 24px, gradient surface, `overflow-hidden`, 1px `border-border`. |
| `input.tsx` | Inset-tile style, 48px min-height, focus = primary border (drop ring). |
| `bottom-sheet.tsx` | Top radius 24px, verify drag handle + sticky CTA (mobile UX contract). |

Because all feature components consume these primitives, most of the app
re-skins automatically.

## Step 4 — Extract and restyle `SessionCard`

Pull the inline session-card markup out of `app/page.tsx` (and `app/sessions/page.tsx`)
into `components/dashboard/SessionCard.tsx`, implementing the approved
prototype (LIVE/SETTLED badge, stat tiles, winner/loser rows, watermark).
Pass data as props; leave all Supabase logic in the page.

## Step 5 — Typography & body background

In `globals.css`:
- Set the rounded font stack on `body`.
- Add the radial background glow.
- Update the `.text-hero`/`.text-title` utility scale to match DESIGN_SYSTEM.md.

## Step 6 — Screen passes (one PR each)

1. Login (`LoginGate`, `LoginDialog`) — suit-cluster hero, stacked auth buttons.
2. Dashboard (`app/page.tsx`, `AppShell`) — club pill header, stats strip, SessionCard list.
3. Profile (`app/profile/page.tsx`) — avatar header, net-result card, history rows.
4. Session create/edit (create dialog → bottom sheet with segmented currency, player chips).
5. Sessions list (`app/sessions/page.tsx`) — filter pills, compact SessionCards.
6. Stats (`app/stats/page.tsx`, `app/stats/player/[profileId]`) — leaderboard rank rows, period selector.
7. Session detail (`app/session/[id]`) — stage stepper bars, player lines, sticky CTA (heaviest screen: PlayerTable, sheets, FinalizationChecklist all live here). Covers all four in-session faces: buy-ins stage, chip entry (balance banner + chip inputs, gate CTA on balance), transactions record (timestamped rows, BUY-IN/CASHOUT badges), and settlement (transfer rows with paid checks, per-player results).
8. Hands Chance (`features/handsChance/*`) — already dark; align greens to `--color-primary`, card picker tiles to the tile radius.
9. Club switcher & members (`AppShell` menu, `app/club/members`, `app/join`) — club rows, join-code tile, role badges + kebab actions, ghost + primary CTAs.
10. Onboarding & invites (`app/join`, `app/session/join/[token]`) — code input, invite hero, session preview card.
11. Admin tools (`app/club/link-players`) — warning banner, member-select pills, sticky save.
12. Player stats detail (`app/stats/player/[profileId]`) — sparkline net card, history rows.
13. Transient auth screens (`app/auth/callback`, `app/auth/logout`) — background glow + muted caption only.

The full screen-to-component mapping is in `DESIGN_SYSTEM.md` § 4.

## Step 7 — Verify each pass

- `npm run build` (type / lint safety).
- `npm run test:e2e` — Playwright asserts on the current UI; update selectors that
  reference restyled markup, not the assertions' intent.
- Manual check against `docs/mobile_ux_contract.md`: 44px targets, one primary
  CTA per screen, bottom sheets on mobile, pressed states.

## Rollout tips

- Keep each step a separate commit on `app-redesign` so regressions bisect cleanly.
- Steps 1–2 flip the whole app dark at once — expect one ugly intermediate
  commit, then primitives (step 3) clean it up.
- The Hands Chance feature is already dark; only swap its greens for
  `--color-primary` where they differ.
