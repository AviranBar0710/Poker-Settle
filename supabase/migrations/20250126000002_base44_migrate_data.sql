-- =====================================================
-- Base44 Data Migration (Phase 2)
-- =====================================================
-- Migration: 20250126000002_base44_migrate_data.sql
-- Purpose: Migrate poker sessions from base44 staging into Poker Settle
--
-- PREREQUISITE: Run 20250126000000 and 20250126000001, then load GameSession
-- and GamePlayer CSVs into staging tables.
--
-- CRITICAL: final_value is SOURCE OF TRUTH. Sessions must balance.
-- =====================================================

BEGIN;

-- Guard: staging must be populated
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM staging_base44_game_session) = 0 THEN
    RAISE EXCEPTION 'staging_base44_game_session is empty. Load GameSession CSV before running.';
  END IF;
  IF (SELECT COUNT(*) FROM staging_base44_game_player) = 0 THEN
    RAISE EXCEPTION 'staging_base44_game_player is empty. Load GamePlayer CSV before running.';
  END IF;
END $$;

-- Create or get Base44 Club
DO $$
DECLARE
  v_club_id uuid;
BEGIN
  INSERT INTO clubs (name, slug, created_by, created_at)
  VALUES ('Base44 Club', 'base44', NULL, now())
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_club_id;
  
  IF v_club_id IS NULL THEN
    SELECT id INTO v_club_id FROM clubs WHERE slug = 'base44' LIMIT 1;
  END IF;
  
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create or find Base44 Club';
  END IF;
  
  DROP TABLE IF EXISTS _migrate_base44_club;
  CREATE TEMP TABLE _migrate_base44_club (id uuid PRIMARY KEY);
  INSERT INTO _migrate_base44_club VALUES (v_club_id);
END $$;

-- Idempotent cleanup
DO $$
DECLARE
  v_club_id uuid;
BEGIN
  SELECT id INTO v_club_id FROM _migrate_base44_club LIMIT 1;
  
  DELETE FROM transactions
  WHERE session_id IN (SELECT id FROM sessions WHERE club_id = v_club_id);
  
  DELETE FROM players
  WHERE club_id = v_club_id;
  
  DELETE FROM sessions
  WHERE club_id = v_club_id;
  
  TRUNCATE migrate_base44_session_map CASCADE;
  TRUNCATE migrate_base44_player_map CASCADE;
END $$;

-- Migrate sessions (non-sample only)
-- is_sample: treat 'true'/'1' as sample (skip); migrate when false, empty, or null
DO $$
DECLARE
  r RECORD;
  v_new_id uuid;
  v_club_id uuid;
  v_session_name text;
  v_session_date timestamptz;
BEGIN
  SELECT id INTO v_club_id FROM _migrate_base44_club LIMIT 1;
  
  FOR r IN (
    SELECT id, game_date, currency, created_date
    FROM staging_base44_game_session
    WHERE (is_sample IS NULL OR LOWER(TRIM(is_sample)) NOT IN ('true', '1'))
    ORDER BY id
  )
  LOOP
    v_new_id := gen_random_uuid();
    v_session_date := NULL;
    BEGIN
      v_session_date := (r.game_date::timestamptz);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_session_date := (r.created_date::timestamptz);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
    v_session_name := COALESCE(
      NULLIF(TRIM(SUBSTRING(r.game_date FROM 1 FOR 10)), ''),
      'Session ' || r.id
    );
    
    INSERT INTO sessions (id, name, currency, club_id, created_at, finalized_at, chip_entry_started_at)
    VALUES (
      v_new_id,
      v_session_name,
      COALESCE(NULLIF(TRIM(r.currency), ''), 'USD'),
      v_club_id,
      COALESCE(v_session_date, now()),
      now(),
      now()
    );
    
    INSERT INTO migrate_base44_session_map (legacy_id, new_id)
    VALUES (r.id, v_new_id);
  END LOOP;
END $$;

-- Migrate players and transactions (non-sample only)
DO $$
DECLARE
  r RECORD;
  v_new_player_id uuid;
  v_session_id uuid;
  v_club_id uuid;
  v_player_name text;
BEGIN
  SELECT id INTO v_club_id FROM _migrate_base44_club LIMIT 1;
  
  FOR r IN (
    SELECT gp.id, gp.game_session_id, gp.player_name, gp.player_name_display, gp.total_buy_in, gp.final_value
    FROM staging_base44_game_player gp
    WHERE (gp.is_sample IS NULL OR LOWER(TRIM(gp.is_sample)) NOT IN ('true', '1'))
      AND EXISTS (
        SELECT 1 FROM staging_base44_game_session gs
        WHERE gs.id = gp.game_session_id
          AND (gs.is_sample IS NULL OR LOWER(TRIM(gs.is_sample)) NOT IN ('true', '1'))
      )
      AND gp.final_value IS NOT NULL
    ORDER BY gp.game_session_id, gp.id
  )
  LOOP
    SELECT new_id INTO v_session_id
    FROM migrate_base44_session_map
    WHERE legacy_id = r.game_session_id;
    
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'Session map missing for game_session_id %', r.game_session_id;
    END IF;
    
    v_player_name := COALESCE(
      NULLIF(TRIM(r.player_name), ''),
      NULLIF(TRIM(r.player_name_display), ''),
      'Player'
    );
    
    v_new_player_id := gen_random_uuid();
    
    INSERT INTO players (id, session_id, club_id, name, profile_id, created_at)
    VALUES (v_new_player_id, v_session_id, v_club_id, v_player_name, NULL, now());
    
    INSERT INTO migrate_base44_player_map (legacy_id, new_id)
    VALUES (r.id, v_new_player_id);
    
    INSERT INTO transactions (id, session_id, club_id, player_id, type, amount, created_at)
    VALUES
      (gen_random_uuid(), v_session_id, v_club_id, v_new_player_id, 'buyin',  r.total_buy_in, now()),
      (gen_random_uuid(), v_session_id, v_club_id, v_new_player_id, 'cashout', r.final_value, now());
  END LOOP;
END $$;

-- House / Rounding per session
DO $$
DECLARE
  srec RECORD;
  v_delta numeric;
  v_sum_buyin numeric;
  v_sum_cashout numeric;
  v_house_player_id uuid;
  v_club_id uuid;
BEGIN
  SELECT id INTO v_club_id FROM _migrate_base44_club LIMIT 1;
  
  FOR srec IN (
    SELECT m.new_id AS session_id
    FROM migrate_base44_session_map m
  )
  LOOP
    SELECT
      COALESCE(SUM(CASE WHEN t.type = 'buyin' THEN t.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.type = 'cashout' THEN t.amount ELSE 0 END), 0)
    INTO v_sum_buyin, v_sum_cashout
    FROM transactions t
    WHERE t.session_id = srec.session_id;
    
    v_delta := v_sum_buyin - v_sum_cashout;
    
    IF ABS(v_delta) > 0.0001 THEN
      v_house_player_id := gen_random_uuid();
      
      INSERT INTO players (id, session_id, club_id, name, profile_id, created_at)
      VALUES (v_house_player_id, srec.session_id, v_club_id, 'House / Rounding', NULL, now());
      
      IF v_delta > 0 THEN
        INSERT INTO transactions (id, session_id, club_id, player_id, type, amount, created_at)
        VALUES (gen_random_uuid(), srec.session_id, v_club_id, v_house_player_id, 'cashout', v_delta, now());
      ELSE
        INSERT INTO transactions (id, session_id, club_id, player_id, type, amount, created_at)
        VALUES (gen_random_uuid(), srec.session_id, v_club_id, v_house_player_id, 'buyin', ABS(v_delta), now());
      END IF;
    END IF;
  END LOOP;
END $$;

-- Validation
DO $$
DECLARE
  v_club_id uuid;
  v_unbalanced int;
BEGIN
  SELECT id INTO v_club_id FROM _migrate_base44_club LIMIT 1;
  
  SELECT COUNT(*) INTO v_unbalanced
  FROM (
    SELECT s.id
    FROM sessions s
    LEFT JOIN transactions t ON t.session_id = s.id
    WHERE s.club_id = v_club_id
    GROUP BY s.id
    HAVING ABS(
      COALESCE(SUM(CASE WHEN t.type = 'buyin' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type = 'cashout' THEN t.amount ELSE 0 END), 0)
    ) > 0.0001
  ) unbalanced;
  
  IF v_unbalanced > 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: % session(s) not balanced (SUM buyins != SUM cashouts)', v_unbalanced;
  END IF;
END $$;

DROP TABLE IF EXISTS _migrate_base44_club;

COMMIT;
