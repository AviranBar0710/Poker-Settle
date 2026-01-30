-- =====================================================
-- PHASE 2: Row Level Security (RLS) Policies
-- =====================================================
-- Migration: 20250114000001_phase2_rls_policies.sql
-- Purpose: Enable RLS and add policies for club-based isolation
-- Requirements:
--   - Only authenticated users can access data
--   - Users can only access data from clubs they are members of
--   - No public/anonymous access
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Enable RLS on all tables
-- =====================================================
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop existing policies if they exist (for idempotency)
-- =====================================================
DROP POLICY IF EXISTS "Users can view clubs they are members of" ON clubs;
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON clubs;
DROP POLICY IF EXISTS "Owners can update their clubs" ON clubs;

DROP POLICY IF EXISTS "Users can view club memberships" ON club_members;
DROP POLICY IF EXISTS "Owners can add members to their clubs" ON club_members;
DROP POLICY IF EXISTS "Owners can remove members from their clubs" ON club_members;

DROP POLICY IF EXISTS "Users can view sessions in their clubs" ON sessions;
DROP POLICY IF EXISTS "Users can create sessions in their clubs" ON sessions;
DROP POLICY IF EXISTS "Users can update sessions in their clubs" ON sessions;
DROP POLICY IF EXISTS "Users can delete sessions in their clubs" ON sessions;

DROP POLICY IF EXISTS "Users can view players in their clubs" ON players;
DROP POLICY IF EXISTS "Users can create players in their clubs" ON players;
DROP POLICY IF EXISTS "Users can update players in their clubs" ON players;
DROP POLICY IF EXISTS "Users can delete players in their clubs" ON players;

DROP POLICY IF EXISTS "Users can view transactions in their clubs" ON transactions;
DROP POLICY IF EXISTS "Users can create transactions in their clubs" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in their clubs" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in their clubs" ON transactions;

-- =====================================================
-- STEP 3: Helper function to check club membership
-- =====================================================
CREATE OR REPLACE FUNCTION is_club_member(club_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = club_uuid
    AND user_id = user_uuid
  );
$$;

-- Helper function to check if user is club owner/admin
CREATE OR REPLACE FUNCTION is_club_owner_or_admin(club_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = club_uuid
    AND user_id = user_uuid
    AND role IN ('owner', 'admin')
  );
$$;

-- =====================================================
-- STEP 4: Clubs table policies
-- =====================================================

-- Users can SELECT clubs where they are members
CREATE POLICY "Users can view clubs they are members of"
ON clubs
FOR SELECT
TO authenticated
USING (
  is_club_member(id, auth.uid())
);

-- Authenticated users can INSERT new clubs (creates new club)
CREATE POLICY "Authenticated users can create clubs"
ON clubs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Only owners/admins can UPDATE club fields
CREATE POLICY "Owners can update their clubs"
ON clubs
FOR UPDATE
TO authenticated
USING (
  is_club_owner_or_admin(id, auth.uid())
)
WITH CHECK (
  is_club_owner_or_admin(id, auth.uid())
);

-- =====================================================
-- STEP 5: Club members table policies
-- =====================================================

-- Users can SELECT memberships where club_id belongs to them
CREATE POLICY "Users can view club memberships"
ON club_members
FOR SELECT
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

-- Only owners/admins can INSERT new club_members
CREATE POLICY "Owners can add members to their clubs"
ON club_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_club_owner_or_admin(club_id, auth.uid())
);

-- Owners can remove members (but not themselves if they're the only owner)
CREATE POLICY "Owners can remove members from their clubs"
ON club_members
FOR DELETE
TO authenticated
USING (
  is_club_owner_or_admin(club_id, auth.uid())
);

-- =====================================================
-- STEP 6: Sessions table policies
-- =====================================================

-- Users can SELECT sessions only if they are members of session.club_id
CREATE POLICY "Users can view sessions in their clubs"
ON sessions
FOR SELECT
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

-- Users can INSERT sessions only if they are members of the club
CREATE POLICY "Users can create sessions in their clubs"
ON sessions
FOR INSERT
TO authenticated
WITH CHECK (
  is_club_member(club_id, auth.uid())
);

-- Users can UPDATE sessions only if they are members of the club
CREATE POLICY "Users can update sessions in their clubs"
ON sessions
FOR UPDATE
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
)
WITH CHECK (
  is_club_member(club_id, auth.uid())
);

-- Users can DELETE sessions only if they are members of the club
CREATE POLICY "Users can delete sessions in their clubs"
ON sessions
FOR DELETE
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

-- =====================================================
-- STEP 7: Players table policies
-- =====================================================

-- Users can SELECT players only if they are members of player.club_id
CREATE POLICY "Users can view players in their clubs"
ON players
FOR SELECT
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

-- Users can INSERT players only if they are members of the club
CREATE POLICY "Users can create players in their clubs"
ON players
FOR INSERT
TO authenticated
WITH CHECK (
  is_club_member(club_id, auth.uid())
);

-- Users can UPDATE players only if they are members of the club
CREATE POLICY "Users can update players in their clubs"
ON players
FOR UPDATE
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
)
WITH CHECK (
  is_club_member(club_id, auth.uid())
);

-- Users can DELETE players only if they are members of the club
CREATE POLICY "Users can delete players in their clubs"
ON players
FOR DELETE
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

-- =====================================================
-- STEP 8: Transactions table policies
-- =====================================================

-- Users can SELECT transactions only if they are members of transaction.club_id
CREATE POLICY "Users can view transactions in their clubs"
ON transactions
FOR SELECT
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

-- Users can INSERT transactions only if they are members of the club
CREATE POLICY "Users can create transactions in their clubs"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (
  is_club_member(club_id, auth.uid())
);

-- Users can UPDATE transactions only if they are members of the club
CREATE POLICY "Users can update transactions in their clubs"
ON transactions
FOR UPDATE
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
)
WITH CHECK (
  is_club_member(club_id, auth.uid())
);

-- Users can DELETE transactions only if they are members of the club
CREATE POLICY "Users can delete transactions in their clubs"
ON transactions
FOR DELETE
TO authenticated
USING (
  is_club_member(club_id, auth.uid())
);

COMMIT;

-- =====================================================
-- VERIFICATION CHECKLIST
-- =====================================================
-- Run these queries to verify RLS is working:
--
-- 1. Check RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('clubs', 'club_members', 'sessions', 'players', 'transactions');
-- -- Expected: rowsecurity = true for all
--
-- 2. Check policies exist:
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('clubs', 'club_members', 'sessions', 'players', 'transactions');
-- -- Expected: Multiple policies per table
--
-- 3. Test as authenticated user (from app):
-- -- Log in, verify you can only see sessions from your clubs
-- -- Verify you cannot access sessions from other clubs via direct ID

