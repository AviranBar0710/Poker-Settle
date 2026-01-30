-- =====================================================
-- PHASE 1: Multi-Tenant Foundations (Clubs)
-- =====================================================
-- Migration: 20250114000000_phase1_multi_tenant_foundations.sql
-- Purpose: Add clubs/club_members tables, backfill existing data
-- Requirements:
--   - Idempotent (safe to re-run)
--   - Preserves all existing data
--   - Deterministic backfill to "Legacy Club"
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Create clubs table
-- =====================================================
CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE clubs IS 'Multi-tenant clubs for organizing poker sessions';

-- =====================================================
-- STEP 2: Create club_members table
-- =====================================================
CREATE TABLE IF NOT EXISTS club_members (
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

-- Add comment
COMMENT ON TABLE club_members IS 'Membership relationship between users and clubs';

-- =====================================================
-- STEP 3: Add nullable club_id columns (NO FK yet)
-- =====================================================
DO $$ 
BEGIN
  -- Add to sessions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions' 
    AND column_name = 'club_id'
  ) THEN
    ALTER TABLE sessions ADD COLUMN club_id uuid;
  END IF;
  
  -- Add to players
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'players' 
    AND column_name = 'club_id'
  ) THEN
    ALTER TABLE players ADD COLUMN club_id uuid;
  END IF;
  
  -- Add to transactions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions' 
    AND column_name = 'club_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN club_id uuid;
  END IF;
END $$;

-- =====================================================
-- STEP 4: Create or get Legacy Club (deterministic)
-- =====================================================
DO $$
DECLARE
  v_legacy_club_id uuid;
  v_default_owner_id uuid;
BEGIN
  -- Try to find first user from profiles table (deterministic)
  SELECT id INTO v_default_owner_id 
  FROM profiles 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  -- Create Legacy Club (idempotent via ON CONFLICT)
  INSERT INTO clubs (name, slug, created_by, created_at)
  VALUES (
    'Legacy Club',
    'legacy',
    v_default_owner_id,
    now()
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_legacy_club_id;
  
  -- If club already existed, get its ID
  IF v_legacy_club_id IS NULL THEN
    SELECT id INTO v_legacy_club_id 
    FROM clubs 
    WHERE slug = 'legacy' 
    LIMIT 1;
  END IF;
  
  -- Add owner membership if user exists and not already a member
  IF v_default_owner_id IS NOT NULL AND v_legacy_club_id IS NOT NULL THEN
    INSERT INTO club_members (club_id, user_id, role, created_at)
    VALUES (v_legacy_club_id, v_default_owner_id, 'owner', now())
    ON CONFLICT (club_id, user_id) DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- STEP 5: Check for orphaned rows BEFORE backfill
-- =====================================================
DO $$
DECLARE
  v_orphaned_players int;
  v_orphaned_transactions int;
BEGIN
  -- Check for players without valid session_id
  SELECT COUNT(*) INTO v_orphaned_players
  FROM players p
  LEFT JOIN sessions s ON p.session_id = s.id
  WHERE s.id IS NULL;
  
  -- Check for transactions without valid session_id
  SELECT COUNT(*) INTO v_orphaned_transactions
  FROM transactions t
  LEFT JOIN sessions s ON t.session_id = s.id
  WHERE s.id IS NULL;
  
  -- Raise exception if orphans found
  IF v_orphaned_players > 0 OR v_orphaned_transactions > 0 THEN
    RAISE EXCEPTION 'Orphaned rows detected before backfill: players=%, transactions=%. Please fix orphaned rows first.', 
      v_orphaned_players, v_orphaned_transactions;
  END IF;
END $$;

-- =====================================================
-- STEP 6: Backfill sessions
-- =====================================================
UPDATE sessions s
SET club_id = (
  SELECT id FROM clubs WHERE slug = 'legacy' LIMIT 1
)
WHERE club_id IS NULL;

-- =====================================================
-- STEP 7: Backfill players (via session_id join)
-- =====================================================
UPDATE players p
SET club_id = s.club_id
FROM sessions s
WHERE p.session_id = s.id 
  AND p.club_id IS NULL;

-- =====================================================
-- STEP 8: Backfill transactions (via session_id join)
-- =====================================================
UPDATE transactions t
SET club_id = s.club_id
FROM sessions s
WHERE t.session_id = s.id 
  AND t.club_id IS NULL;

-- =====================================================
-- STEP 9: Validate no NULLs remain
-- =====================================================
DO $$
DECLARE
  v_null_sessions int;
  v_null_players int;
  v_null_transactions int;
BEGIN
  SELECT COUNT(*) INTO v_null_sessions FROM sessions WHERE club_id IS NULL;
  SELECT COUNT(*) INTO v_null_players FROM players WHERE club_id IS NULL;
  SELECT COUNT(*) INTO v_null_transactions FROM transactions WHERE club_id IS NULL;
  
  IF v_null_sessions > 0 OR v_null_players > 0 OR v_null_transactions > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: sessions=%, players=%, transactions=%. Cannot proceed with NOT NULL constraint.', 
      v_null_sessions, v_null_players, v_null_transactions;
  END IF;
END $$;

-- =====================================================
-- STEP 10: Create indexes (before FK constraints)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sessions_club_id ON sessions(club_id);
CREATE INDEX IF NOT EXISTS idx_players_club_id ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_transactions_club_id ON transactions(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON club_members(user_id);

-- =====================================================
-- STEP 11: Enforce NOT NULL constraints
-- =====================================================
ALTER TABLE sessions ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE players ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN club_id SET NOT NULL;

-- =====================================================
-- STEP 12: Add foreign key constraints
-- =====================================================
DO $$
BEGIN
  -- sessions.club_id -> clubs.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND constraint_name = 'fk_sessions_club'
  ) THEN
    ALTER TABLE sessions 
    ADD CONSTRAINT fk_sessions_club 
    FOREIGN KEY (club_id) REFERENCES clubs(id);
  END IF;
  
  -- players.club_id -> clubs.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND constraint_name = 'fk_players_club'
  ) THEN
    ALTER TABLE players 
    ADD CONSTRAINT fk_players_club 
    FOREIGN KEY (club_id) REFERENCES clubs(id);
  END IF;
  
  -- transactions.club_id -> clubs.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND constraint_name = 'fk_transactions_club'
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT fk_transactions_club 
    FOREIGN KEY (club_id) REFERENCES clubs(id);
  END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICATION CHECKLIST
-- =====================================================
-- Run these queries to verify migration success:
--
-- 1. Check clubs exist:
-- SELECT COUNT(*) as total_clubs FROM clubs;
-- -- Expected: >= 1
--
-- 2. Check Legacy Club exists:
-- SELECT id, name, slug FROM clubs WHERE slug = 'legacy';
-- -- Expected: 1 row
--
-- 3. Check no NULL club_ids:
-- SELECT COUNT(*) as null_sessions FROM sessions WHERE club_id IS NULL;
-- SELECT COUNT(*) as null_players FROM players WHERE club_id IS NULL;
-- SELECT COUNT(*) as null_transactions FROM transactions WHERE club_id IS NULL;
-- -- Expected: 0 for all
--
-- 4. Check all data in Legacy Club:
-- SELECT COUNT(*) as legacy_sessions 
-- FROM sessions 
-- WHERE club_id IN (SELECT id FROM clubs WHERE slug = 'legacy');
-- -- Should match total sessions count
--
-- 5. Verify referential integrity:
-- SELECT COUNT(*) as mismatched_players
-- FROM players p
-- JOIN sessions s ON p.session_id = s.id
-- WHERE p.club_id != s.club_id;
-- -- Expected: 0
--
-- SELECT COUNT(*) as mismatched_transactions
-- FROM transactions t
-- JOIN sessions s ON t.session_id = s.id
-- WHERE t.club_id != s.club_id;
-- -- Expected: 0
--
-- 6. Check indexes exist:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('sessions', 'players', 'transactions', 'club_members')
-- AND indexname LIKE '%club_id%' OR indexname LIKE '%club_members%';
-- -- Expected: 5 indexes
--
-- 7. Check foreign keys exist:
-- SELECT conname, conrelid::regclass 
-- FROM pg_constraint 
-- WHERE conname LIKE 'fk_%_club';
-- -- Expected: 3 foreign keys

