-- =====================================================
-- Migration: 20250114000003_add_club_join_code_and_join_rpc
-- Purpose: Add join_code to clubs, RPC to join by code (v1.1 onboarding)
-- Requirements:
--   - Idempotent (safe to re-run)
--   - Preserve existing data (Legacy Club, etc.)
--   - Join only via RPC; no permissive club_members INSERT
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Add join_code column (nullable first)
-- =====================================================
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS join_code text;

-- =====================================================
-- STEP 2: Join code generator (retry until unique)
-- Uses A-Z + 2-9 (exclude 0,1,I,O,L) for readability.
-- Length 8. Collision-safe via loop.
-- =====================================================
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  max_attempts int := 100;
  attempt int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM clubs WHERE join_code = result) THEN
      RETURN result;
    END IF;
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'generate_join_code: failed to generate unique code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- STEP 3: Backfill join_code for ALL existing clubs
-- =====================================================
UPDATE clubs
SET join_code = generate_join_code()
WHERE join_code IS NULL;

-- =====================================================
-- STEP 4: Set NOT NULL (idempotent: only if still nullable)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'join_code'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE clubs ALTER COLUMN join_code SET NOT NULL;
  END IF;
END $$;

-- =====================================================
-- STEP 5: Unique constraint on join_code
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_join_code ON clubs(join_code);

-- =====================================================
-- STEP 6: Trigger to set join_code on INSERT (new clubs)
-- =====================================================
CREATE OR REPLACE FUNCTION set_club_join_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := generate_join_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clubs_set_join_code ON clubs;
CREATE TRIGGER trg_clubs_set_join_code
  BEFORE INSERT ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION set_club_join_code_on_insert();

-- =====================================================
-- STEP 7: RPC — join_club_by_code
-- Returns: status ('joined' | 'already_member' | 'invalid_code'), club_id, club_name
-- =====================================================
CREATE OR REPLACE FUNCTION join_club_by_code(p_join_code text)
RETURNS TABLE (status text, club_id uuid, club_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_cid uuid;
  v_cname text;
  v_uid uuid;
  v_exists boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'invalid_code'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  v_code := upper(trim(p_join_code));
  IF v_code = '' THEN
    RETURN QUERY SELECT 'invalid_code'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT c.id, c.name INTO v_cid, v_cname
  FROM clubs c
  WHERE c.join_code = v_code
  LIMIT 1;

  IF v_cid IS NULL THEN
    RETURN QUERY SELECT 'invalid_code'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_members.club_id = v_cid AND club_members.user_id = v_uid
  ) INTO v_exists;

  IF v_exists THEN
    RETURN QUERY SELECT 'already_member'::text, v_cid, v_cname;
    RETURN;
  END IF;

  INSERT INTO club_members (club_id, user_id, role, created_at)
  VALUES (v_cid, v_uid, 'member', now());

  RETURN QUERY SELECT 'joined'::text, v_cid, v_cname;
END;
$$;

-- =====================================================
-- STEP 8: Grants — authenticated only
-- =====================================================
REVOKE ALL ON FUNCTION join_club_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION join_club_by_code(text) TO authenticated;

-- =====================================================
-- VERIFICATION (optional, run manually)
-- =====================================================
-- SELECT id, name, join_code FROM clubs;
-- All clubs including Legacy should have non-null, unique join_code.

COMMIT;
