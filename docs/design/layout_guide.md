# Layout Implementation Guide — Structural Redesign

**Audience:** the coding model implementing the next pass on the `app-redesign`
branch.
**Scope:** this guide covers *layout and hierarchy* — how to reorganize the DOM
of each core screen so it matches the approved sketches. Colors, tokens, and
primitives are already done (see `implementation_notes.md`); do **not** re-touch
them. Every instruction here is about *structure*: what wraps what, what order
things appear in, what is promoted or demoted visually.

**Golden rule:** never change data fetching, state, handlers, or routing.
Every change below is a re-arrangement of already-rendered data. If a change
seems to require a new query, stop and flag it (see "Out of scope" at the end).

---

## 0. The five hierarchy principles

Apply these to every screen. They are the difference between "inherited the
theme" and "was designed":

1. **One hero per screen.** The most important object (active game, net
   result, join code) gets a full-width card at the top with the largest type
   on the screen. Everything else is visibly subordinate.
2. **Strips, not grids of cards.** Secondary numbers (counts, totals,
   averages) never get their own `<Card>` each. They share ONE row of compact
   **inset stat tiles** (`bg-background/45 border rounded-tile`, uppercase
   11px label over a bold value). A row of four full Cards makes every number
   look equally important — that is the current dashboard's main flaw.
3. **Lists are rows, not tables.** Any ranked/keyed money list (leaderboard,
   session history, transactions) renders as **list rows**: 34–40px round
   avatar (tinted circle with initials) + name/subtitle stack + right-aligned
   bold money. No `<Table>`, no column headers on mobile.
4. **One primary CTA, bottom-anchored on mobile.** The screen's single primary
   action sits in a sticky bottom bar (`sticky bottom-0`, padding
   `pb-[max(1rem,env(safe-area-inset-bottom))]`, background fade) on mobile
   and in the top-right header slot on `sm:`+. Never two gradient-green
   buttons visible at once.
5. **Section headers are quiet.** Section titles ("Recent games", "History")
   are H4 (16px/600) with generous top margin — not 24px bold competing with
   the hero. Optional right-aligned "See all →" ghost link.

---

## 1. Shared layout: page scaffold

Every content page currently opens with some variation of
`<div className="min-h-screen bg-background p-4 sm:p-6">`. Standardize on one
scaffold so rhythm is identical everywhere:

```tsx
<AppShell>
  <div className="min-h-screen p-4 pb-28 sm:p-6 sm:pb-6">   {/* pb-28 clears the sticky CTA on mobile */}
    <div className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-5xl space-y-5">
      {/* 1. screen header (title row OR back row) */}
      {/* 2. hero (optional) */}
      {/* 3. stats strip (optional) */}
      {/* 4. sections */}
    </div>
  </div>
  {/* 5. sticky CTA bar (mobile only, when the screen has a primary action) */}
</AppShell>
```

- `bg-background` on the inner div is redundant (body already has the glow) —
  remove it where found, otherwise the glow gets covered.
- **Screen header, two variants only:**
  - *Root screens* (Dashboard, Sessions, Stats): H2 title on the left,
    optional desktop-only action button on the right.
  - *Detail screens* (Profile, session detail, members): 44px ghost back
    button + centered H4 title (the pattern already in `app/profile/page.tsx`
    lines 131–140). Reuse that exact block; consider extracting it to
    `components/layout/PageHeader.tsx` once it appears a third time.

### Sticky CTA bar (new shared component)

Create `components/layout/StickyCta.tsx`:

```tsx
export function StickyCta({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden
                    bg-gradient-to-t from-background via-background/95 to-transparent
                    px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
```

Used by Dashboard (New Session), session detail (stage CTA), join screens.
On `sm:`+ the same button renders inline in the header instead (render both,
hide with `sm:hidden` / `hidden sm:inline-flex`).

### Stat strip (new shared component)

Create `components/ui/stat-strip.tsx` — replaces every "grid of stat cards":

```tsx
export function StatStrip({ items }: { items: { label: string; value: React.ReactNode; accent?: "success" | "danger" }[] }) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-2 overflow-x-auto">
      {items.map((it) => (
        <div key={it.label}
             className="rounded-tile border bg-background/45 px-3 py-2.5 min-w-[92px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {it.label}
          </p>
          <p className={cn("mt-0.5 text-lg font-extrabold tabular-nums",
                           it.accent === "success" && "text-success",
                           it.accent === "danger" && "text-destructive")}>
            {it.value}
          </p>
        </div>
      ))}
    </div>
  )
}
```

This is the same visual as `SessionCard`'s internal tiles — after creating it,
refactor `SessionCard` to use it too so tiles stay identical app-wide.

### List row (new shared component)

Create `components/ui/list-row.tsx` — used by leaderboard, history,
transactions, members:

```tsx
export function ListRow({ avatar, title, subtitle, right, href }: {...}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-tile border bg-background/45 px-3 py-3
                    active:scale-[0.985] transition-transform">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                      bg-primary/10 text-sm font-bold text-primary">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
```

`right` is typically a signed money value:
`<span className="text-base font-extrabold tabular-nums text-success">+₪240</span>`.

---

## 2. Dashboard — `app/page.tsx` (sketch 2)

### Current structure (what's wrong)

```
Header row: H1 "Dashboard" (24-30px) + subtitle + big green "New Session"
ActiveSessionBanner
[4 × full <Card>: Total Sessions / Active / Total Pot / Average]   ← 4 equal heroes
"Recent Sessions" (24px bold) + SessionCard grid
```

Four full-height stat cards push the actual content (the games) below the
fold on mobile, and the H1+CTA row wastes the hero position on a label.

### Target structure

```
1. Title row      H2 "Dashboard" ONLY (no subtitle). Desktop-only "New Session"
                  button on the right (hidden sm:inline-flex).
2. HERO           ActiveSessionBanner — when a live game exists this IS the
                  hero; keep it directly under the title.
3. Stats strip    ONE StatStrip row: Games | Live | Total pot | Avg pot.
                  Money values keep the currency symbol, no accent color
                  (these are neutral facts, not results).
4. Section        H4 "Recent games" + ghost "See all →" link to /sessions.
5. Session grid   existing SessionCard grid, unchanged.
6. StickyCta      mobile: gradient "＋ New Session" button (the ONLY primary
                  CTA visible on mobile).
```

### Change list

1. In the header `div` (lines ~296–314): drop the subtitle `<p>`, change H1
   classes to `text-2xl font-bold tracking-tight`, add `hidden sm:inline-flex`
   to the New Session `Button`.
2. Delete the entire "Stats Overview" grid (lines ~429–507, four `<Card>`
   blocks) and replace with one `<StatStrip items={[...]} />` fed by the
   already-computed `totalSessions`, `activeSessions`, `totalPotValue`,
   `averagePotValue`. **The four calculations stay exactly as they are.**
3. "Recent Sessions" header: `text-2xl font-bold` → `text-base font-semibold`;
   add `<Link href="/sessions" className="text-sm text-primary">See all →</Link>`
   in the existing flex row.
4. Append `<StickyCta>` (mobile New Session button that calls the same
   `setShowCreateDialog(true)` handler) as a sibling of the page div, and add
   `pb-28 sm:pb-6` to the page padding so content scrolls clear of it.
5. `ActiveSessionBanner`: verify internally that it reads as a hero — session
   name at H3 (18px/700), Live badge, and its two numbers (players / pot)
   rendered as inset tiles, with its "Open" button as the full-width primary
   *inside the card*. If it currently shows a small inline layout, restructure
   it to match `SessionCard` but larger (this is the one screen region allowed
   a spade watermark).

---

## 3. Profile — `app/profile/page.tsx` (sketch 3) — WORKED EXAMPLE

This is the reference conversion; follow the same reasoning on other screens.

### Current structure (lines 126–263)

```
back row + centered "Profile" title            ✓ keep as-is
avatar hero (80px circle, name, email)          ✓ keep, minor promotion
<Card>                                          ✗ a form-looking card:
   "Display Name" label + value + pencil          label-over-value form rows
   "Email" label + value                          read like a settings form
</Card>
full-width RED "Logout" button                  ✗ strongest element on screen
                                                  is a destructive action
"App version" caption                           ✓ keep
```

**Diagnosis:** the screen has no content hierarchy — the only card is a form,
and the loudest element is Logout. The sketch's profile is *identity + results*:
who you are, how you're doing, then account plumbing at the bottom.

### Target structure

```
1. Back row + "Profile" title                        (unchanged)
2. IDENTITY HERO (not in a card, on the page bg):
     96px avatar circle (w-24 h-24, text-3xl)
     name at H2 24px/700  — tap-to-edit (see below)
     email caption (muted, 14px)
     role Badge (variant="role") under it when club role is known
3. NET-RESULT CARD (hero card, spade watermark):     ← NEW, see data note
     Label "ALL-TIME NET" (11px uppercase muted)
     signed money 28px/800 tabular-nums success/danger
     StatStrip inside the card: Games | Win rate | Best night
4. ACCOUNT section:
     H4 "Account"
     ListRow: pencil avatar-slot, "Display name", value as subtitle,
              chevron right  → opens the existing inline edit (or a small
              bottom sheet reusing the existing input + save handler)
     ListRow: mail icon, "Email", value as subtitle, no chevron (read-only)
5. Logout: demoted to a GHOST-DANGER row at the very bottom —
     variant="ghost", full width, text-destructive, NO red fill:
     <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10">
6. version caption                                    (unchanged)
```

### Concrete edit (step 4 shown as before → after)

Before (current Card, lines 165–244):

```tsx
<Card>
  <CardContent className="p-4 sm:p-6 space-y-6">
    {/* Display Name row: label + value + pencil icon-button */}
    {/* Email row: label + value */}
  </CardContent>
</Card>
```

After — the Card disappears; each field becomes a ListRow in an "Account"
section. The edit state machine (`isEditing`, `editValue`, `handleSaveEdit`,
`saveError`) is **kept verbatim**; only the closed-state presentation changes:

```tsx
<section className="space-y-2">
  <h3 className="text-base font-semibold">Account</h3>

  {isEditing ? (
    /* the EXISTING edit block (Input + check/X buttons + saveError) —
       move it here unchanged, wrapped in the row shell */
    <div className="rounded-tile border bg-background/45 px-3 py-3">{/* existing edit JSX */}</div>
  ) : (
    <button onClick={handleStartEdit} className="w-full text-left">
      <ListRow
        avatar={<Pencil className="h-4 w-4" />}
        title="Display name"
        subtitle={displayName || "Not set"}
        right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
      />
    </button>
  )}

  <ListRow
    avatar={<Mail className="h-4 w-4" />}
    title="Email"
    subtitle={email || "—"}
    right={null}
  />
</section>
```

### Data note for the net-result card (step 3)

The profile page has no stats data today. The queries already exist in
`lib/stats/calc.ts` (`loadFinalizedSessions`, `loadPlayers`,
`loadTransactions`, `calculatePlayerStats`) and are pure — call them with
`activeClubId` from `useClub()`, filter to `profileId === user.id` exactly as
`app/stats/page.tsx` does (its `myPlayerStats` memo). This reuses existing
loaders and RLS-approved reads, so it does **not** violate the golden rule.
If `activeClubId` is null or stats come back empty, omit the card entirely
(no empty-state skeleton).

---

## 4. Sessions — `app/sessions/page.tsx` (sketch 5)

Current: title + SessionCard grid of finalized sessions.

1. Add a **filter pill row** between title and grid — pill-shaped segmented
   control, NOT buttons:

   ```tsx
   <div className="flex gap-2">
     {(["all", "live", "settled"] as const).map((f) => (
       <button key={f} onClick={() => setFilter(f)}
         className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold capitalize",
           filter === f ? "border-primary/40 bg-primary/15 text-primary"
                        : "text-muted-foreground")}>
         {f}
       </button>
     ))}
   </div>
   ```

2. **Data contract change (pre-approved here):** the page currently queries
   only finalized sessions (`.not("finalized_at","is",null)`). Remove that
   clause so it loads all club sessions, and filter client-side by
   `finalizedAt` per the selected pill. Default pill: **All**. This is the
   one sanctioned data change in this guide.
3. Empty states per pill: "No live games right now" / "No settled games yet",
   centered caption + (on All only) the existing create CTA.

---

## 5. Stats / Leaderboard — `app/stats/page.tsx` (sketch 6)

Current: shadcn `<Table>` with rank icons inside cells, tab state
`club | my`.

1. **Tabs → pill segmented control**, same pattern as the Sessions filter
   pills ("Club" / "My stats"), replacing whatever renders the tab switch
   today.
2. **Table → ranked ListRows.** For each `PlayerStat`, one `ListRow`:
   - `avatar` slot: rank — Crown (gold, rank 1) / Medal (2–3) / plain number
     in the tinted circle. Keep the existing `RankIcon` logic, drop its
     `w-8 h-8 bg-muted` wrapper (the ListRow circle replaces it).
   - `title`: player name; `subtitle`: `X games · Y% win rate` (12px muted) —
     this replaces two table columns.
   - `right`: signed net, 16px/800 tabular-nums, success/danger.
   - `href`: the existing per-player link to `/stats/player/[profileId]`.
   - Rank 1 row may add `border-primary/25` to the row shell — nothing louder.
3. Add a `StatStrip` above the list: Games | Players | Total pot (all
   derivable from already-loaded `sessions`/`clubPlayerStats`).
4. Desktop: cap list width (`max-w-2xl`) — do NOT resurrect the table on
   `md:`; rows scale fine.
5. `app/stats/player/[profileId]`: same conversion — hero net-result card at
   top (same component/markup as Profile's step 3 card — extract
   `components/stats/NetResultCard.tsx` and use it in both places), then
   `StatStrip`, then session-history `ListRow`s (session name / date /
   right-aligned net). The sketch's per-session bar sparkline stays deferred.

---

## 6. Session detail — `app/session/[id]` (sketches 7 / 10 / 12)

Do not restructure the stage logic. Three layout moves only:

1. **Sticky stage CTA.** Each stage's advance button ("Start game", "Move to
   cash-outs", "Finalize"…) moves into the `StickyCta` bar on mobile; content
   gets `pb-28`. Disabled rules unchanged (e.g. chip-entry stays disabled
   until balanced).
2. **Header order:** back row + session name (H3) + Live/Settled badge on one
   line → `Stepper` directly beneath → balance/stage banner → content. If
   today any stats row sits above the stepper, move it below.
3. **Player lines → ListRow** styling (avatar circle + name + right-aligned
   inputs/amounts). Chip-entry inputs stay 92px right-aligned inside the row
   (`w-[92px] text-right tabular-nums`), green border when filled — only the
   row shell changes, not input behavior. Transactions view: keep day
   dividers; each transaction becomes a ListRow with the BUY-IN (muted) /
   CASHOUT (success) badge in the `right` slot next to the amount.

---

## 7. Verification checklist (run after each screen)

- [ ] `npm run build` passes.
- [ ] 390px viewport: no horizontal scroll; sticky CTA doesn't cover the last
      list item (`pb-28` present); only ONE gradient-green button visible.
- [ ] Every number on the screen has exactly one of three sizes: hero money
      (28px), tile value (18px), row money (16px). If two adjacent numbers
      share a size but not importance, demote one.
- [ ] Screen reads top-to-bottom as: identity/hero → facts strip → list →
      action. No form-style label-over-value blocks outside actual forms.
- [ ] Update `implementation_notes.md` with the screen's entry + deviations.

## Out of scope (unchanged from before)

- Settlement "paid" checkmarks (new feature — needs product OK).
- Player-stats sparkline (needs per-session series plumbing).
- Stepper 5→4 stage rename (product call).
- Any new Supabase query beyond reusing `lib/stats/calc.ts` loaders (Profile
  net card) and the Sessions filter change sanctioned in §4.
