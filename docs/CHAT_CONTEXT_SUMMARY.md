# Poker Settle — Chat Context Summary

> Reference document to restore context when returning to this project or starting a new agent session. Last updated: Jan 24, 2025.

---

## 1. Project Overview

**Poker Settle** is a multi-tenant poker cash game settlement app. Users organize games within **clubs**, run sessions, record buy-ins/cash-outs, and settle balances. It is mobile-first with premium UX.

- **Framework:** Next.js (App Router)
- **Backend:** Supabase (Postgres, Auth, RLS)
- **UI:** Tailwind CSS, shadcn/ui, Radix UI
- **Auth:** Email OTP (6-digit code); Google Auth also configured

---

## 2. Core Concepts

| Concept | Description |
|---------|-------------|
| **Club** | Multi-tenant container; users join via join code. One club = one poker group. |
| **Session** | A single poker game. Has players, buy-ins, cash-outs, settlement. |
| **Players** | Can be linked to a profile (`profile_id`) for "This is me" identity. |
| **Roles** | `owner`, `admin`, `member`. Only owner/admin can edit; members are read-only. |
| **Base44 Club** | Migrated club from legacy base44 app; slug `base44`. |

---

## 3. Session Flow

1. **Add Players** — Owner/admin adds players to the session.
2. **Add Buy-ins** — Each player gets ≥1 buy-in before chip entry can start.
3. **Start Chip Entry** — Admin clicks "Start Chip Entry"; can go back to Add Players if needed.
4. **Record Chip Counts** — Enter final chip counts per player.
5. **Calculate Results** — Settlement summary and "Who Pays Whom".
6. **Finalize Session** — Session is locked. Pop-up: "Session is locked. Share results."
7. **Share Results** — All roles can share; owner/admin can still edit (unlock) if required.

---

## 4. Role-Based Access (Owner/Admin vs Member)

- **Owner / Admin:** Can add players, add buy-ins/cash-outs, edit names, remove players, start chip entry, finalize, and (when finalized) unlock and edit.
- **Member:** Read-only. Can view sessions, share results, copy link, go home. Cannot add/edit anything.
- **"This is me"** button: Visible to **all** users (not gated by `canEdit`). Users must assign themselves to their player name.
- **View Settlement:** Visible to everyone.
- **Manage members:** Only owner/admin.
- **Link Players (Base44):** Only owner/admin of Base44 Club.

---

## 5. Base44 Legacy Migration

- **Source:** CSV exports from legacy base44 app (`GameSession`, `GamePlayer`).
- **Target:** New "Base44 Club" with sessions, players, transactions.
- **Critical rules:** `final_value` is source of truth; `total_buy_in` for initial buy-ins only. Sessions balanced via "House / Rounding" synthetic player for any delta.
- **Staging tables:** `staging_base44_game_session`, `staging_base44_game_player` — schema matches CSV headers exactly.
- **Migrations:** `20250126000000` (staging), `20250126000001` (staging fix), `20250126000002` (data migration).
- **Issue:** Base44 Club has no owner/admin in `club_members` by default. Add yourself as owner manually in Supabase or via join code after migration.
- **Docs:** See [docs/BASE44_MIGRATION.md](BASE44_MIGRATION.md).

---

## 6. Admin Link Players UI (Base44)

- **Purpose:** Link migrated player records (no `profile_id`) to app user profiles.
- **Visibility:** Only when `activeClub?.slug === 'base44'` and role is owner/admin. Optionally hidden when no unlinked players remain.
- **Location:** `/club/link-players`; nav entry in AppShell club dropdown.
- **RPCs:** `search_profiles_by_email`, `link_player_to_profile`, optionally `link_players_by_name_to_profile`.
- **Plan:** [admin_link_players_ui_59c636a6.plan.md] (in `.cursor/plans/`).

---

## 7. Key Fixes and Decisions

| Issue | Resolution |
|-------|------------|
| Logout button (desktop) not working | Dedicated `/app/auth/logout` route with `signOut({ scope: "local" })` and hard redirect. |
| New user lands on session instead of Home | Use `window.location.replace("/")` for hard redirect after auth. |
| "Manage members" visibility | Only owner/admin see it. |
| Member edit access | Unified `canEdit = activeClub?.role === "owner" \|\| activeClub?.role === "admin"`; members never get edit actions. |
| PlayerActionsSheet for members | Opens but shows only "View Transactions"; no Edit/Add Buy-in/Add Cash-out/Remove. |
| Chip entry "go back" | Admin/owner can go back from chip entry to Add Players via `resetChipEntry`. |
| Finalized session duplicate messaging | Single pop-up dialog after finalize; green "Session Finalized" card removed. |
| DialogTitle accessibility error | Add `DialogTitle` (or `VisuallyHidden`) to all Dialog usages. |
| Error loading clubs/sessions | Check RLS, `club_members` membership; improve `console.error` to log actual error. |
| Join page redirect when user has clubs | Removed redirect; users can navigate to `/join` to join additional clubs. |
| Join page for users with no clubs | Shows AppShell (logged-in state), explanatory copy, "Create your first club" option. |
| Base44 Club not in app | Add user to `club_members` for Base44 Club (join via code or manual insert). |
| Cash-out amount restriction | Removed; users can cash out more than buy-in. |
| Keyboard auto-opens on sheets | `onOpenAutoFocus={(e) => e.preventDefault()}` on Radix dialogs/sheets. |

---

## 8. Important Files

| Path | Purpose |
|------|---------|
| `app/session/[id]/page.tsx` | Session page; phases, canEdit, finalize, share, link players. |
| `components/layout/AppShell.tsx` | Sidebar, club switcher, Manage members, Join club, Link players. |
| `components/session/PlayerActionsSheet.tsx` | Player actions; `canEdit` prop gates edit options. |
| `contexts/ClubContext.tsx` | Clubs, activeClub, createClub, joinClub, loadClubs. |
| `contexts/AuthContext.tsx` | Auth, signOut, unhandledrejection for AuthApiError. |
| `app/join/page.tsx` | Join club by code; create first club. |
| `app/club/link-players/page.tsx` | Admin UI to link Base44 players to profiles. |
| `lib/currency.ts` | `getCurrencySymbol(currency)` — ₪ / $ / €. |
| `hooks/useSessionStage.ts` | Phase logic, `resetChipEntry`. |
| `app/auth/logout/page.tsx` | Client-side logout with hard redirect. |

---

## 9. Contracts and Conventions

- [docs/mobile_ui_contract.md](mobile_ui_contract.md) — Mobile layout, overflow, touch targets
- [docs/mobile_ux_contract.md](mobile_ux_contract.md) — UX patterns
- [docs/session_experience_contract.md](session_experience_contract.md) — Session flow, stage engine
- [docs/agent_project_skills.md](agent_project_skills.md) — Agent coding guidelines

---

## 10. Supabase Notes

- **RLS:** Enforced on clubs, club_members, sessions, players, transactions.
- **Rate limits:** Supabase free tier has email rate limits; consider custom SMTP for OTP.
- **Profiles:** Email typically synced from `auth.users`; used for `search_profiles_by_email`.
- **Base44 Club ID:** `7f56322f-f5e4-4817-9e92-dac2522371c0` (from earlier context).

---

## 11. Pending / Future Work

- Complete Admin Link Players UI implementation if not fully done.
- Verify all players linked; optionally hide "Link players" when done.
- Consider "Mark linking complete" flag if you want to hide UI before all are linked.

---

## 12. When Starting a New Agent Session

- Read this file first for context.
- Refer to plan files in `.cursor/plans/` for implementation details.
- Check [docs/BASE44_MIGRATION.md](BASE44_MIGRATION.md) for migration steps.
- Use `canEdit` consistently for all edit actions.
