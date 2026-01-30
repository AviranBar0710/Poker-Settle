-- =====================================================
-- Migration: 20250114000005_add_join_code_to_clubs
-- Purpose: Add join_code to clubs (production-safe, idempotent)
-- Requirements:
--   - Do NOT delete any existing rows
--   - Idempotent (safe to run twice)
--   - Backfill join_code for ALL existing clubs (including Legacy Club)
--   - join_code NOT NULL + UNIQUE
--   - New clubs get join_code via trigger
--   - Keep RLS strict
-- =====================================================

BEGIN;

-- =====================================================
-- A) Add column clubs.join_code as NULLABLE first
-- =====================================================
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS join_code text;

-- =====================================================
-- B) Generator: 8-char uppercase alphanumeric
--    Alphabet: A–Z, 2–9 (exclude 0, 1, I, O, L)
--    Retry until unique in clubs.join_code
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
-- C) Backfill join_code for ALL existing clubs
-- =====================================================
UPDATE clubs
SET join_code = generate_join_code()
WHERE join_code IS NULL;

-- =====================================================
-- D) Set join_code NOT NULL (idempotent)
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
-- E) Unique index on clubs(join_code)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_join_code ON clubs(join_code);

-- =====================================================
-- F) BEFORE INSERT trigger: new clubs get join_code
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

COMMIT;

-- =====================================================
-- G) Verification / SQL validation checklist
-- =====================================================
-- Run after migration. All must succeed.
--
-- 1) Column exists, all clubs have join_code (req: select works, no nulls):
--    SELECT id, name, slug, join_code FROM clubs ORDER BY created_at DESC;
--
-- 2) No duplicate join_codes:
--    SELECT join_code, COUNT(*) FROM clubs GROUP BY join_code HAVING COUNT(*) > 1;
--    Expect: 0 rows.
--
-- 3) New club auto-gets join_code:
--    INSERT INTO clubs (name, slug) VALUES ('_test_join_code', 'test-join-' || gen_random_uuid()::text);
--    SELECT id, name, join_code FROM clubs WHERE name = '_test_join_code';
--    DELETE FROM clubs WHERE name = '_test_join_code';
