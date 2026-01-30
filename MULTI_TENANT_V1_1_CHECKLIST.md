# Multi-Tenant v1.1 — Join-by-Code Onboarding Checklist

## Overview
v1.1 removes auto-creation of a default club for first-time users. New users must **join an existing club** via a **Join Code**. This checklist validates the migration, RPC, and app behavior.

## Prerequisites
- Multi-tenant v1 migrations (00000, 00001, 00002) applied
- Supabase project linked (or run migration SQL manually)

---

## 1. Apply Migration 00003

Run the migration:

```bash
# If using Supabase CLI and linked:
supabase db push

# Or run manually in Supabase SQL Editor:
# Execute: supabase/migrations/20250114000003_add_club_join_code_and_join_rpc.sql
```

---

## 2. Database Verification

Run in Supabase SQL Editor:

```sql
-- 2.1 clubs.join_code exists, NOT NULL, UNIQUE
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'join_code';
-- Expected: join_code, is_nullable = NO, data_type = text

SELECT indexname FROM pg_indexes WHERE tablename = 'clubs' AND indexname = 'idx_clubs_join_code';
-- Expected: 1 row

-- 2.2 All clubs (including Legacy) have join_code
SELECT id, name, slug, join_code FROM clubs;
-- Expected: No NULLs in join_code; all unique

-- 2.3 RPC exists and is executable by authenticated
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'join_club_by_code';
-- Expected: 1 row, prosecdef = true

-- 2.4 Test RPC as authenticated user (replace JOIN_CODE with a real code from 2.2)
-- SELECT * FROM join_club_by_code('LEGACY_JOIN_CODE');
-- Expected: Returns (status, club_id, club_name). status in ('joined','already_member','invalid_code')
```

---

## 3. Application Verification

### 3.1 First-time user (no memberships)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in (magic link or existing auth) | Redirect to `/join` (or see Join UI) |
| 2 | Confirm no club auto-created | No “{email}'s Club” created |
| 3 | Confirm no Create Club visible | Club switcher / Create Club not shown (0 clubs) |
| 4 | Enter **invalid** join code → Join | Inline error: “Invalid join code”; no membership |
| 5 | Enter **valid** join code → Join | Success; redirect to `/sessions`; club data visible |
| 6 | Confirm club switcher | Club switcher visible; joined club is active |

### 3.2 Existing user (has ≥1 club)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in | No redirect to `/join`; normal app (e.g. Home / Sessions) |
| 2 | Club switcher | Visible with clubs + “Create New Club” |
| 3 | Create club | Works as before; new club has `join_code` (trigger) |
| 4 | Join code UI | Owner/admin sees “Join Code: XXXXXXXX” + copy button in switcher |

### 3.3 Join Code visibility

| Step | Action | Expected |
|------|--------|----------|
| 1 | As **owner** or **admin** of a club | Open club switcher → “Join Code: …” + copy button |
| 2 | Click copy | Code copied; brief checkmark feedback |
| 3 | As **member** (not owner/admin) | No Join Code row in switcher |

### 3.4 Security

| Check | Expected |
|-------|----------|
| Anonymous access | No join flow; auth required |
| Join without code | Only via RPC with valid code |
| `club_members` INSERT | No new permissive policy; join only via RPC |

### 3.5 Legacy compatibility

| Check | Expected |
|-------|----------|
| Legacy Club | Has `join_code`; existing data unchanged |
| Existing sessions/players/transactions | Still in Legacy Club; isolation intact |
| Identity linking | `players.profile_id` unchanged |

---

## 4. Routing & Guards

| Scenario | Expected |
|----------|----------|
| Authenticated, 0 clubs, on `/` | Redirect to `/join` |
| Authenticated, 0 clubs, on `/sessions` | Redirect to `/join` |
| Authenticated, 0 clubs, on `/stats` | Redirect to `/join` |
| Authenticated, 0 clubs, on `/session/[id]` | Redirect to `/join` |
| On `/join` | Join UI only (no AppShell) |
| After successful join | Redirect to `/sessions` |
| Authenticated, ≥1 club | No redirect; normal app |

---

## 5. Files Touched (v1.1)

- `supabase/migrations/20250114000003_add_club_join_code_and_join_rpc.sql`
- `contexts/ClubContext.tsx` (no auto-create; `needsOnboarding`; `joinClubByCode`)
- `app/join/page.tsx` (new)
- `components/OnboardingGuard.tsx` (new)
- `components/layout/AppShell.tsx` (club switcher when `clubs.length > 0`; Join Code copy UI)
- `app/layout.tsx` (wraps children with `OnboardingGuard`)
- `types/club.ts` (`joinCode` on `Club`)

---

## 6. Risks & Notes

- **Migration idempotency**: 00003 is safe to re-run (IF NOT EXISTS, etc.).
- **Trigger**: New clubs get `join_code` via `trg_clubs_set_join_code`; no app change for create.
- **RPC**: `join_club_by_code` is `SECURITY DEFINER`, `search_path = public`; no RLS relaxation on `club_members`.
- **Rate limiting**: Not in scope for v1.1; consider for production.

---

## 7. Sign-off

- [ ] Migration 00003 applied
- [ ] DB verification (2.1–2.4) passed
- [ ] First-time user flow (3.1) passed
- [ ] Existing user flow (3.2) passed
- [ ] Join Code visibility (3.3) passed
- [ ] Security checks (3.4) passed
- [ ] Legacy compatibility (3.5) passed
- [ ] Routing & guards (4) passed
