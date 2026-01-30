-- =====================================================
-- Add active_club_id to profiles table
-- =====================================================
-- Migration: 20250114000002_add_active_club_to_profiles.sql
-- Purpose: Store user's active club selection in profiles
-- =====================================================

BEGIN;

-- Add active_club_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'active_club_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN active_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_active_club_id ON profiles(active_club_id);

COMMIT;

