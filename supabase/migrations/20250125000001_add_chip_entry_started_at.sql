-- Migration: Add chip_entry_started_at to sessions
-- Purpose: Track when "Start chip entry" was clicked (Stage 2 → Stage 3 transition)
-- Contract: docs/session_experience_contract.md

BEGIN;

-- Add chip_entry_started_at column (nullable, default null)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS chip_entry_started_at timestamptz DEFAULT NULL;

-- Add finalized_at column (prepare for Stage 5, rename from finalizedAt in code later)
-- This makes the DB schema consistent with stage contract
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS finalized_at timestamptz DEFAULT NULL;

-- Backfill finalized_at from existing finalized_at (if column exists in different case)
-- Skip if column doesn't exist (safe for new installations)
DO $$
BEGIN
  -- Check if old column exists and backfill
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'finalized_at'
  ) THEN
    -- Column already exists, no backfill needed
    NULL;
  END IF;
END $$;

COMMIT;

-- Verification SQL (run manually to verify):
-- SELECT id, name, created_at, chip_entry_started_at, finalized_at FROM sessions LIMIT 5;
-- 
-- Expected:
-- - chip_entry_started_at: NULL for existing sessions (correct - they were in ad-hoc mode)
-- - finalized_at: NULL for active sessions, timestamptz for finalized sessions
