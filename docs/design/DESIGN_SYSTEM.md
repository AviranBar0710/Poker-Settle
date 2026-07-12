# Poker Settle — Design System

Dark, inviting, mobile-first. Inspired by the approved Session Card prototype:
near-black navy ground, bold green primary, bold green/red money values,
pill-rounded shapes, subtle card-suit motifs.

---

## 1. Global Color Palette

All colors are exposed as CSS custom properties on `:root`.

### Surfaces

| Token | Value | Usage |
|---|---|---|
| `--color-background` | `#0B1118` | App background (near-black navy) |
| `--color-background-glow` | `#101B26` | Radial glow at top of screens |
| `--color-card-bg` | `#16202C` | Card / sheet surface |
| `--color-card-bg-raised` | `#1C2836` | Gradient top of cards, raised surfaces |
| `--color-inset-bg` | `rgba(11, 17, 24, 0.45)` | Inset tiles inside cards (stats, rows, inputs) |
| `--color-border` | `rgba(220, 239, 228, 0.08)` | Hairline borders on all surfaces |

### Text

| Token | Value | Usage |
|---|---|---|
| `--color-text` | `#DCEFE4` | Headings & primary text (light mint) |
| `--color-text-muted` | `#8294A5` | Secondary text, labels, captions |
| `--color-text-on-primary` | `#0D1A12` | Text on green buttons (dark green-black) |

### Brand & Semantic

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#3DDC84` | Primary actions, active states, links (bold green) |
| `--color-primary-deep` | `#2CB56C` | Gradient bottom of primary buttons |
| `--color-success` | `#3DDC84` | Profit amounts, LIVE badge, positive feedback |
| `--color-danger` | `#FF6B6B` | Loss amounts, destructive actions, errors |
| `--color-success-tint` | `rgba(61, 220, 132, 0.12)` | Success badge/avatar backgrounds |
| `--color-danger-tint` | `rgba(255, 107, 107, 0.12)` | Danger badge/avatar backgrounds |

### Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-card` | `24px` | Cards, bottom sheets, dialogs |
| `--radius-tile` | `16px` | Inset tiles, inputs, list rows |
| `--radius-pill` | `999px` | Buttons, badges, chips, segmented controls |

### Rules

- Money is **always** `--color-success` (positive) or `--color-danger` (negative),
  bold, large, `font-variant-numeric: tabular-nums`.
- Semantic colors (success/danger) are never used for decoration — only for
  meaning (money, live state, errors).
- Card-suit watermarks: `--color-primary` at 5% opacity, oversized, clipped by
  the card's `overflow: hidden`.

---

## 2. Typography

**Font stack** (rounded, friendly — matches the ChipUp reference without webfont
payload):

```css
font-family: ui-rounded, "SF Pro Rounded", Quicksand, Comfortaa, system-ui, -apple-system, sans-serif;
```

| Role | Size / Line | Weight | Notes |
|---|---|---|---|
| H1 / Hero | 32px / 40px | 700 | Screen titles, login headline |
| H2 / Title | 24px / 32px | 700 | Section headers ("Games", "Stats") |
| H3 / Card title | 18px / 26px | 700 | Session name, dialog titles |
| H4 / Subtitle | 16px / 24px | 600 | Row names, form section titles |
| Body | 16px / 24px | 400 | Default text |
| Caption | 14px / 20px | 400–600 | Metadata, helper text (muted color) |
| Label | 11px / 14px | 600–700 | UPPERCASE, `letter-spacing: 0.1em`, muted |
| Money (display) | 20–28px | 800 | Tabular nums, semantic color, `−`/`+` sign always shown |

---

## 3. Global UI Components

### Buttons

All buttons: `--radius-pill`, min-height **48px** (44px touch minimum + padding),
weight 700, pressed state `scale(0.98)` — no hover-dependent states (mobile UX
contract).

| Variant | Style |
|---|---|
| **Primary** | `linear-gradient(160deg, var(--color-primary), var(--color-primary-deep))`, text `--color-text-on-primary`. One per screen. |
| **Ghost** | Transparent bg, `1px solid rgba(61,220,132,0.35)` border, text `--color-primary`. Secondary actions. |
| **Surface** | `--color-card-bg-raised` bg, `--color-border` border, text `--color-text`. Neutral actions (OAuth buttons, cancel). |
| **Destructive** | `--color-danger-tint` bg, text `--color-danger`. Confirm-only contexts. |

### Badges

Pill-shaped, 11–12px bold text, 6px×12px padding, tinted background + matching
25%-opacity border:

- **Live**: success tint + pulsing 7px dot (`animation: pulse 1.8s`, disabled
  under `prefers-reduced-motion`).
- **Settled / neutral**: muted tint, muted text.
- **Role** (owner/admin): primary tint, primary text.

### Card container

- Background: `linear-gradient(160deg, var(--color-card-bg-raised) 0%, var(--color-card-bg) 55%)`
- Border: `1px solid var(--color-border)`; radius `--radius-card`; padding 20px.
- `overflow: hidden` (required for watermarks).
- Tappable cards: `active` state scales to 0.985.

### Inset tile (stat tiles, list rows, inputs)

- Background `--color-inset-bg`, border `--color-border`, radius `--radius-tile`.
- Stat tile: uppercase label (Label style) over bold value.
- List row: 34px round avatar (tinted) + name/subtitle + right-aligned money.

### Inputs

- Inset tile style, min-height 48px, text `--color-text`,
  placeholder `--color-text-muted`.
- Focus: border becomes `--color-primary` (no ring glow).

### Bottom sheets

- Top corners `--radius-card`, drag handle (36×4px pill, muted 30%).
- Primary CTA bottom-aligned and sticky above keyboard.
- No top-right X on mobile (mobile UX contract).

---

## 4. Screen Inventory

Every app screen and the components it is built from. Sketches for all nine
live in the screen-sketches artifact.

| # | Screen | Route(s) | Built from |
|---|---|---|---|
| 1 | Login / Register | `LoginGate`, `LoginDialog` | Suit-cluster hero, Surface buttons (OAuth), Primary button (email) |
| 2 | Home / Dashboard | `app/page.tsx` | Top bar (menu + club pill + profile), stats strip, Session Cards |
| 3 | Profile | `app/profile/page.tsx` | Big avatar, role badge, net-result card (watermark), stat tiles, history rows |
| 4 | Create / Edit Session | dialog → bottom sheet | Sheet, input, segmented currency pills, player chips, Primary CTA |
| 5 | Sessions (all) | `app/sessions/page.tsx` | Filter pills (All/Live/Settled), compact Session Cards |
| 6 | Stats / Leaderboard | `app/stats/*` | Stats strip, ranked rows (rank number + avatar + net), period selector chip |
| 7 | Session Detail (live) | `app/session/[id]` | Stage stepper (progress bars + caption), stats strip, player lines, sticky Primary CTA |
| 8 | Hands Chance | `app/tools/hands-chance` | Felt-green oval table, playing cards, empty card slots, win-% tags, card picker |
| 9 | Club Switcher / Members | `AppShell` menu, `app/club/*` | Sheet, club rows with active check, join-code tile + copy chip, Ghost + Primary CTAs |

Screens 2, 5, 6 share the same top bar; 4 and 9 are bottom sheets over a dimmed
dashboard. The playing-card component (screen 8) is the only place with a light
surface — it keeps white cards for suit legibility.

---

## 5. Motifs & Depth

- **Spade watermark**: oversized `♠` glyph, 5% primary color, rotated −12°,
  anchored to a card corner. Use sparingly — one per screen region.
- **Background glow**: `radial-gradient(1200px 600px at 50% -10%, var(--color-background-glow), var(--color-background) 60%)` on the app body.
- No other textures, illustrations, or gradients (per approved flair level).
