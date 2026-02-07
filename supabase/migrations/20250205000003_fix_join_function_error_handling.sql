-- =====================================================
-- Migration: 20250205000003_fix_join_function_error_handling
-- Purpose: Fix 400 errors and add validation-only function (no auto-join)
-- =====================================================

BEGIN;

-- =====================================================
-- Create validate_session_token function (validation only, no auto-join)
-- =====================================================
CREATE OR REPLACE FUNCTION validate_session_token(p_token text)
RETURNS TABLE (status text, session_id uuid, session_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_token_hash text;
  v_session_id uuid;
  v_session_name text;
  v_club_id uuid;
  v_finalized_at timestamptz;
  v_chip_entry_started_at timestamptz;
  v_invite_enabled boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'not_authenticated'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Validate token is not empty
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Hash the provided token using pgcrypto digest function
  -- Wrap in exception handler in case pgcrypto is not available
  BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  EXCEPTION
    WHEN OTHERS THEN
      -- If digest fails, return invalid_token
      RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, NULL::text;
      RETURN;
  END;

  -- Look up session by token hash
  SELECT 
    s.id, 
    s.name, 
    s.club_id, 
    s.finalized_at, 
    s.chip_entry_started_at,
    s.invite_enabled
  INTO 
    v_session_id, 
    v_session_name, 
    v_club_id, 
    v_finalized_at, 
    v_chip_entry_started_at,
    v_invite_enabled
  FROM sessions s
  WHERE s.invite_token_hash = v_token_hash
  LIMIT 1;

  -- Validate token
  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check invite enabled
  IF NOT v_invite_enabled THEN
    RETURN QUERY SELECT 'invite_disabled'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check club membership
  IF NOT is_club_member(v_club_id, v_uid) THEN
    RETURN QUERY SELECT 'not_club_member'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check session stage
  IF v_finalized_at IS NOT NULL THEN
    RETURN QUERY SELECT 'session_finalized'::text, v_session_id, v_session_name;
    RETURN;
  END IF;

  IF v_chip_entry_started_at IS NOT NULL THEN
    RETURN QUERY SELECT 'stage_blocked'::text, v_session_id, v_session_name;
    RETURN;
  END IF;

  -- Token is valid - return success (user will manually join via session page)
  RETURN QUERY SELECT 'valid'::text, v_session_id, v_session_name;
END;
$$;

-- =====================================================
-- Update join_session_by_token to handle errors gracefully
-- =====================================================
CREATE OR REPLACE FUNCTION join_session_by_token(p_token text)
RETURNS TABLE (status text, session_id uuid, session_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_token_hash text;
  v_session_id uuid;
  v_session_name text;
  v_club_id uuid;
  v_finalized_at timestamptz;
  v_chip_entry_started_at timestamptz;
  v_invite_enabled boolean;
  v_player_id uuid;
  v_existing_player_id uuid;
  v_user_display_name text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'not_authenticated'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Validate token is not empty
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Hash the provided token using pgcrypto digest function
  -- Wrap in exception handler in case pgcrypto is not available
  BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  EXCEPTION
    WHEN OTHERS THEN
      -- If digest fails, return invalid_token
      RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, NULL::text;
      RETURN;
  END;

  -- Look up session by token hash
  SELECT 
    s.id, 
    s.name, 
    s.club_id, 
    s.finalized_at, 
    s.chip_entry_started_at,
    s.invite_enabled
  INTO 
    v_session_id, 
    v_session_name, 
    v_club_id, 
    v_finalized_at, 
    v_chip_entry_started_at,
    v_invite_enabled
  FROM sessions s
  WHERE s.invite_token_hash = v_token_hash
  LIMIT 1;

  -- Validate token
  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check invite enabled
  IF NOT v_invite_enabled THEN
    RETURN QUERY SELECT 'invite_disabled'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check club membership
  IF NOT is_club_member(v_club_id, v_uid) THEN
    RETURN QUERY SELECT 'not_club_member'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check session stage
  IF v_finalized_at IS NOT NULL THEN
    RETURN QUERY SELECT 'session_finalized'::text, v_session_id, v_session_name;
    RETURN;
  END IF;

  IF v_chip_entry_started_at IS NOT NULL THEN
    RETURN QUERY SELECT 'stage_blocked'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check if user already has a player in this session
  SELECT id INTO v_existing_player_id
  FROM players
  WHERE session_id = v_session_id AND profile_id = v_uid
  LIMIT 1;

  IF v_existing_player_id IS NOT NULL THEN
    RETURN QUERY SELECT 'already_joined'::text, v_session_id, v_session_name;
    RETURN;
  END IF;

  -- Get user's display name for the new player
  SELECT display_name INTO v_user_display_name
  FROM profiles
  WHERE id = v_uid
  LIMIT 1;

  -- Create new player with profile_id set (atomic operation)
  v_player_id := gen_random_uuid();
  
  INSERT INTO players (id, session_id, club_id, name, profile_id, created_at)
  VALUES (
    v_player_id,
    v_session_id,
    v_club_id,
    COALESCE(NULLIF(trim(v_user_display_name), ''), 'Player'),
    v_uid,
    now()
  )
  ON CONFLICT (session_id, profile_id) DO NOTHING
  RETURNING id INTO v_player_id;

  -- Check if insert succeeded
  IF v_player_id IS NULL THEN
    -- Race condition: someone else created player between checks
    RETURN QUERY SELECT 'already_joined'::text, v_session_id, v_session_name;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'joined'::text, v_session_id, v_session_name;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION validate_session_token(text) FROM public;
GRANT EXECUTE ON FUNCTION validate_session_token(text) TO authenticated;

COMMIT;
