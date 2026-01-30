# Multi-Tenant v1.2 — Member Management QA Checklist

## Overview
v1.2 adds minimal Club Member Management: view members, remove (admin/owner), change roles (owner only). All sensitive actions go through SECURITY DEFINER RPCs. RLS stays strict.

---

## 1. Apply Migration 00004

```bash
# If using Supabase CLI:
supabase db push

# Or run manually in Supabase SQL Editor:
# Execute: supabase/migrations/20250114000004_member_management_rpc.sql
```

---

## 2. Database Verification

Run in Supabase SQL Editor:

```sql
-- 2.1 Owners count per club >= 1
SELECT club_id, COUNT(*) AS owners
FROM club_members
WHERE role = 'owner'
GROUP BY club_id;
-- Expect: owners >= 1 for each club.

-- 2.2 RPCs exist and are callable by authenticated
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('remove_club_member', 'update_club_member_role');
-- Expect: 2 rows, prosecdef = true.

-- 2.3 is_club_owner helper exists
SELECT proname FROM pg_proc WHERE proname = 'is_club_owner';
-- Expect: 1 row.
```

---

## 3. Manual Tests

### 3.1 As **member**

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open club switcher → "Manage members" | Navigate to /club/members |
| 2 | View members list | See all members with Owner/Admin/Member badges |
| 3 | Check ⋯ actions menu | No ⋯ button on any row (including own) |
| 4 | Direct RPC: member calls `remove_club_member` | Denied (only owner/admin can remove) |
| 5 | Direct RPC: member calls `update_club_member_role` | Denied (only owner can change roles) |

### 3.2 As **admin**

| Step | Action | Expected |
|------|--------|----------|
| 1 | View members list | See all members with role badges |
| 2 | ⋯ on a **member** row | Menu shows "Remove" only |
| 3 | ⋯ on an **owner** row | No ⋯ (owners never have actions) |
| 4 | Remove a member | Confirm dialog → Remove → success; member gone from list |
| 5 | Check "Change role" / "Make admin" / "Make member" | Not visible (admin cannot change roles) |
| 6 | Try to remove an owner (e.g. via RPC) | Denied; "Cannot remove an owner" |
| 7 | Direct RPC: admin calls `update_club_member_role` | Denied (only owner can change roles) |

### 3.3 As **owner**

| Step | Action | Expected |
|------|--------|----------|
| 1 | View members list | See all members |
| 2 | ⋯ on a **member** row | "Remove", "Make admin" |
| 3 | ⋯ on an **admin** row | "Remove", "Make member" |
| 4 | ⋯ on an **owner** row | No ⋯ |
| 5 | ⋯ on **own** row | No ⋯ (no self-actions) |
| 6 | Remove member | Confirm → success; list refreshes |
| 7 | Remove admin | Confirm → success |
| 8 | Make member → admin | Success; badge updates |
| 9 | Make admin → member | Success; badge updates |
| 10 | Try to remove an owner | No Remove option shown (or RPC denies if attempted) |
| 11 | Try to demote an owner | No role actions on owner rows |
| 12 | Verify owners count | After any removes/role changes, club still has ≥ 1 owner |
| 13 | Direct RPC: attempt to remove owner | Denied; "Cannot remove an owner" |
| 14 | Direct RPC: attempt to set role to 'owner' | Denied; `p_new_role` must be 'admin' or 'member' |

### 3.4 Security & isolation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Cross-club: call `remove_club_member(other_club_id, …)` | Denied (caller not owner/admin of other club) |
| 2 | Cross-club: call `update_club_member_role(other_club_id, …)` | Denied |
| 3 | Unauthenticated: call either RPC | Denied (auth required) |

### 3.5 UI

| Step | Action | Expected |
|------|--------|----------|
| 1 | Mobile view | Member cards; ⋯ menu and actions usable |
| 2 | Desktop view | Table; ⋯ menu works |
| 3 | Remove confirm | "Remove {name}? They will lose access."; Cancel / Remove |
| 4 | After remove / role change | Inline success message; list refreshes |
| 5 | Errors (e.g. RPC failure) | Inline error; no `alert()` |

---

## 4. Sign-off

- [ ] Migration 00004 applied
- [ ] DB verification (2.1–2.3) passed
- [ ] Member: view only, no actions (3.1)
- [ ] Admin: remove members only; no role changes (3.2)
- [ ] Owner: remove + role changes; owners protected (3.3)
- [ ] Security & cross-club (3.4)
- [ ] UI (3.5)

---

## 5. Risks & Notes

- **Display names**: Members list uses "Member" for others, email for self. Profiles join can be added later if RLS allows.
- **Removed user’s `active_club_id`**: Not updated by RPC. On next load, app fallback (e.g. first club or /join) applies.
- **Owner self-removal**: Disallowed in RPC (v1.2). No UI to remove self as owner.
