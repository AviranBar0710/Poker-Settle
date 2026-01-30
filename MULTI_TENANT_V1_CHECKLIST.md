# Multi-Tenant v1 (Clubs) - Validation Checklist

## Overview
This document provides a comprehensive checklist to validate the multi-tenant implementation using Clubs.

## Prerequisites
- All migrations have been applied successfully
- User is authenticated
- User has at least one club membership

---

## PHASE 1: Database Foundations ✅

### 1.1 Verify Migration Success
Run these SQL queries in Supabase SQL Editor:

```sql
-- Check clubs table exists
SELECT COUNT(*) as total_clubs FROM clubs;
-- Expected: >= 1

-- Check Legacy Club exists
SELECT id, name, slug FROM clubs WHERE slug = 'legacy';
-- Expected: 1 row

-- Check club_members table exists
SELECT COUNT(*) as total_memberships FROM club_members;
-- Expected: >= 1 (at least one owner of Legacy Club)

-- Verify no NULL club_ids
SELECT 
  (SELECT COUNT(*) FROM sessions WHERE club_id IS NULL) as null_sessions,
  (SELECT COUNT(*) FROM players WHERE club_id IS NULL) as null_players,
  (SELECT COUNT(*) FROM transactions WHERE club_id IS NULL) as null_transactions;
-- Expected: 0, 0, 0

-- Verify all data in Legacy Club
SELECT COUNT(*) as legacy_sessions 
FROM sessions 
WHERE club_id IN (SELECT id FROM clubs WHERE slug = 'legacy');
-- Should match total sessions count

-- Verify referential integrity
SELECT COUNT(*) as mismatched_players
FROM players p
JOIN sessions s ON p.session_id = s.id
WHERE p.club_id != s.club_id;
-- Expected: 0

SELECT COUNT(*) as mismatched_transactions
FROM transactions t
JOIN sessions s ON t.session_id = s.id
WHERE t.club_id != s.club_id;
-- Expected: 0

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('sessions', 'players', 'transactions', 'club_members')
AND (indexname LIKE '%club_id%' OR indexname LIKE '%club_members%');
-- Expected: 5 indexes

-- Check foreign keys exist
SELECT conname, conrelid::regclass 
FROM pg_constraint 
WHERE conname LIKE 'fk_%_club';
-- Expected: 3 foreign keys
```

---

## PHASE 2: RLS Policies ✅

### 2.1 Verify RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('clubs', 'club_members', 'sessions', 'players', 'transactions');
-- Expected: rowsecurity = true for all
```

### 2.2 Verify Policies Exist
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('clubs', 'club_members', 'sessions', 'players', 'transactions')
ORDER BY tablename, policyname;
-- Expected: Multiple policies per table
```

### 2.3 Test RLS Isolation (Manual Testing)
1. **User A creates Club A:**
   - Login as User A
   - Create a new club "Club A"
   - Create a session in Club A
   - Verify session is visible

2. **User B cannot access Club A data:**
   - Login as User B (different account)
   - Try to access session ID from Club A directly (e.g., `/session/<session-id>`)
   - Expected: Error or empty result (RLS blocks access)
   - Create a session in Club B
   - Verify User B only sees Club B sessions

3. **User A cannot access Club B data:**
   - Login as User A
   - Try to access Club B session ID directly
   - Expected: Error or empty result

---

## PHASE 3: App Wiring ✅

### 3.1 Club Context Functionality

**Test: Club Auto-Creation**
- [ ] Log in as a new user (no existing clubs)
- [ ] Verify a default club is created automatically
- [ ] Verify club name follows pattern: "{email-prefix}'s Club"
- [ ] Verify user is set as owner of the club

**Test: Active Club Persistence**
- [ ] Select a club as active
- [ ] Refresh the page
- [ ] Verify the same club remains active
- [ ] Verify `profiles.active_club_id` is set correctly

**Test: Club Switching**
- [ ] Create a second club
- [ ] Switch to the second club
- [ ] Verify displayed sessions change
- [ ] Verify only sessions from active club are shown
- [ ] Switch back to first club
- [ ] Verify sessions update correctly

**Test: Club Switcher UI**
- [ ] Verify club switcher appears in sidebar (when logged in)
- [ ] Click club switcher dropdown
- [ ] Verify all user's clubs are listed
- [ ] Verify active club is highlighted
- [ ] Click different club
- [ ] Verify active club updates

**Test: Create Club**
- [ ] Click "Create New Club" button
- [ ] Enter club name
- [ ] Submit
- [ ] Verify new club is created
- [ ] Verify user becomes owner
- [ ] Verify new club becomes active automatically

---

### 3.2 Data Queries Are Club-Scoped

**Test: Dashboard (Home Page)**
- [ ] Verify only sessions from active club are displayed
- [ ] Create a session in Club A
- [ ] Switch to Club B
- [ ] Verify session from Club A is not visible
- [ ] Switch back to Club A
- [ ] Verify session is visible again

**Test: Sessions History Page**
- [ ] Navigate to `/sessions`
- [ ] Verify only sessions from active club are listed
- [ ] Verify session counts match active club only

**Test: Stats Page**
- [ ] Navigate to `/stats`
- [ ] Verify stats are calculated from active club sessions only
- [ ] Switch clubs
- [ ] Verify stats update to reflect new active club

**Test: Individual Session Page**
- [ ] Open a session from active club
- [ ] Verify session loads correctly
- [ ] Verify players and transactions load
- [ ] Try to open a session from a different club (if you know the ID)
- [ ] Expected: Error or empty result (RLS blocks)

---

### 3.3 Data Inserts Include Club ID

**Test: Create Session**
- [ ] Ensure active club is set
- [ ] Create a new session
- [ ] Verify session is created with correct `club_id`
- [ ] Verify session appears in active club

**Test: Add Player**
- [ ] Open a session
- [ ] Add a new player
- [ ] Verify player is created with correct `club_id` (matches session's club_id)
- [ ] Verify player is visible in session

**Test: Add Transaction**
- [ ] Open a session with players
- [ ] Add a buy-in transaction
- [ ] Verify transaction is created with correct `club_id` (matches session's club_id)
- [ ] Verify transaction is visible

---

## PHASE 4: Sharing Behavior ✅

### 4.1 No Public Access

**Test: Anonymous Access Blocked**
- [ ] Log out
- [ ] Try to access a session directly via URL: `/session/<session-id>`
- [ ] Expected: Redirected to login or shows "Access Denied"
- [ ] Expected: Cannot view session data

**Test: Authenticated Non-Member Access Blocked**
- [ ] User A creates a session in Club A
- [ ] User B (not a member of Club A) logs in
- [ ] User B tries to access session via direct URL
- [ ] Expected: Error or empty result (RLS blocks)
- [ ] Expected: Cannot view session data

**Test: Authenticated Member Access Allowed**
- [ ] User A creates a session in Club A
- [ ] User A (member of Club A) logs in
- [ ] User A accesses session via direct URL
- [ ] Expected: Session loads correctly
- [ ] Expected: All data is visible

### 4.2 Share Results Feature

**Test: Share Results (Internal Link)**
- [ ] Finalize a session
- [ ] Click "Share Results"
- [ ] Copy the shareable link
- [ ] Expected: Link format is `/session/<session-id>` (internal route)
- [ ] Log out
- [ ] Try to access the link
- [ ] Expected: Must login to view
- [ ] Log in as a member of the club
- [ ] Access the link
- [ ] Expected: Session results are visible
- [ ] Log in as a non-member
- [ ] Try to access the link
- [ ] Expected: Access denied or empty result

---

## General Functionality Tests

### Data Integrity
- [ ] Verify no data was lost during migration
- [ ] Verify all existing sessions are in Legacy Club
- [ ] Verify all existing players have correct club_id
- [ ] Verify all existing transactions have correct club_id
- [ ] Verify identity linking (players.profile_id) still works

### Performance
- [ ] Verify queries are fast (should have indexes on club_id)
- [ ] Verify no N+1 queries when loading sessions
- [ ] Verify club switching is instant

### UI/UX
- [ ] Verify club switcher is visible on all pages
- [ ] Verify club name displays correctly
- [ ] Verify mobile responsiveness (club switcher works on mobile)
- [ ] Verify desktop behavior unchanged (as per requirements)

### Error Handling
- [ ] Test behavior when user has no clubs (should auto-create)
- [ ] Test behavior when active_club_id points to deleted club (should fallback)
- [ ] Test behavior when RLS blocks access (should show error gracefully)

---

## Known Limitations (v1)

- ❌ No public share tokens (by design - auth-only)
- ❌ No club invitations (future feature)
- ❌ No leaderboards by club (future feature)
- ❌ No club member management UI (owners can add members via SQL for now)

---

## Troubleshooting

### Issue: User sees no clubs after login
**Solution:** Check if `ClubContext` is creating default club. Check browser console for errors.

### Issue: RLS blocking all queries
**Solution:** Verify policies are correct. Check if user is authenticated. Verify user has club membership.

### Issue: Sessions not filtering by club
**Solution:** Verify `activeClubId` is set in ClubContext. Check queries include `.eq("club_id", activeClubId)` or rely on RLS.

### Issue: Cannot create session
**Solution:** Verify `activeClubId` is not null. Check if user is member of active club. Verify RLS policies allow INSERT.

---

## Migration Validation Queries

Run these after applying migrations to verify everything is correct:

```sql
-- Summary Report
SELECT 
  'Clubs' as table_name,
  COUNT(*) as total_rows
FROM clubs
UNION ALL
SELECT 
  'Club Members' as table_name,
  COUNT(*) as total_rows
FROM club_members
UNION ALL
SELECT 
  'Sessions (with club_id)' as table_name,
  COUNT(*) as total_rows
FROM sessions
WHERE club_id IS NOT NULL
UNION ALL
SELECT 
  'Players (with club_id)' as table_name,
  COUNT(*) as total_rows
FROM players
WHERE club_id IS NOT NULL
UNION ALL
SELECT 
  'Transactions (with club_id)' as table_name,
  COUNT(*) as total_rows
FROM transactions
WHERE club_id IS NOT NULL;

-- RLS Status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('clubs', 'club_members', 'sessions', 'players', 'transactions')
ORDER BY tablename;

-- Policy Count
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('clubs', 'club_members', 'sessions', 'players', 'transactions')
GROUP BY tablename
ORDER BY tablename;
```

---

## Success Criteria

✅ All migrations applied successfully
✅ No data loss (all existing data preserved)
✅ RLS policies working (users can only access their club data)
✅ Club switching works correctly
✅ Queries are club-scoped
✅ Inserts include club_id
✅ No public access (auth-only)
✅ Sharing works for authenticated club members only
✅ Mobile UX unchanged
✅ Desktop behavior unchanged
✅ No breaking changes to existing features

---

## Next Steps (Future Enhancements)

1. Club member management UI
2. Club invitations
3. Club settings (rename, delete)
4. Member roles UI
5. Leaderboards by club
6. Club activity feed
7. Multi-club session statistics

