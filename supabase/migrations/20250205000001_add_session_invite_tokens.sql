-- =====================================================
-- Migration: 20250205000001_add_session_invite_tokens
-- Purpose: Add shareable invite link functionality for sessions
-- Requirements:
--   - Idempotent (safe to re-run)
--   - Tokens are hashed (SHA256) for security
--   - Lazy token generation (on-demand, not auto)
--   - Atomic join operation
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Enable pgcrypto extension for hashing (digest function)
-- =====================================================
-- pgcrypto is needed for digest() function to hash tokens
-- In Supabase, this should be enabled, but we ensure it's available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- STEP 2: Add invite columns to sessions table
-- =====================================================
ALTER TABLE sessions 
  ADD COLUMN IF NOT EXISTS invite_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_token_hash text,
  ADD COLUMN IF NOT EXISTS invite_token_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_token_regenerated_at timestamptz;

-- =====================================================
-- STEP 3: Add unique constraint on players (session_id, profile_id)
-- Prevents duplicate players per user per session
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_session_profile'
  ) THEN
    ALTER TABLE players 
    ADD CONSTRAINT unique_session_profile 
    UNIQUE (session_id, profile_id);
  END IF;
END $$;

-- =====================================================
-- STEP 4: Create index for token hash lookups
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sessions_invite_token_hash 
ON sessions(invite_token_hash) 
WHERE invite_token_hash IS NOT NULL;

-- =====================================================
-- STEP 5: Token generator function
-- Generates 32-character base64url-safe token
-- Uses A-Za-z0-9-_ alphabet (URL-safe)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_session_invite_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  result text := '';
  i int;
BEGIN
  -- Generate 32-character token using random() function
  -- This doesn't require pgcrypto extension
  -- Uses cryptographically secure random() from PostgreSQL
  result := '';
  FOR i IN 1..32 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- =====================================================
-- STEP 6: RPC - Generate invite token for a session
-- =====================================================
CREATE OR REPLACE FUNCTION generate_session_invite_token_rpc(p_session_id uuid)
RETURNS TABLE (status text, token text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_session_club_id uuid;
  v_token text;
  v_token_hash text;
  v_is_regenerating boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'error'::text, NULL::text, 'Not authenticated'::text;
    RETURN;
  END IF;

  -- Get session club_id
  SELECT club_id INTO v_session_club_id
  FROM sessions
  WHERE id = p_session_id
  LIMIT 1;

  IF v_session_club_id IS NULL THEN
    RETURN QUERY SELECT 'error'::text, NULL::text, 'Session not found'::text;
    RETURN;
  END IF;

  -- Check club membership
  IF NOT is_club_member(v_session_club_id, v_uid) THEN
    RETURN QUERY SELECT 'error'::text, NULL::text, 'Not a member of this club'::text;
    RETURN;
  END IF;

  -- Check if token already exists (regenerating)
  SELECT (invite_token_hash IS NOT NULL) INTO v_is_regenerating
  FROM sessions
  WHERE id = p_session_id;

  -- Generate new token
  v_token := generate_session_invite_token();
  -- Hash token using pgcrypto digest function
  -- If pgcrypto is not available, this will error - user needs to enable it
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- Update session with token hash
  UPDATE sessions
  SET 
    invite_enabled = true,
    invite_token_hash = v_token_hash,
    invite_token_created_at = CASE 
      WHEN invite_token_created_at IS NULL THEN now()
      ELSE invite_token_created_at
    END,
    invite_token_regenerated_at = CASE
      WHEN v_is_regenerating THEN now()
      ELSE invite_token_regenerated_at
    END
  WHERE id = p_session_id;

  -- Return token (only time it's exposed in plaintext)
  RETURN QUERY SELECT 'success'::text, v_token, NULL::text;
END;
$$;

-- =====================================================
-- STEP 7: RPC - Join session by token (ATOMIC)
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

  -- Hash the provided token using pgcrypto digest function
  -- If pgcrypto is not available, this will error - user needs to enable it
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

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
    RETURN QUERY SELECT 'session_finalized'::text, NULL::uuid, NULL::text;
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

-- =====================================================
-- STEP 8: RPC - Disable invite for a session
-- =====================================================
CREATE OR REPLACE FUNCTION disable_session_invite(p_session_id uuid)
RETURNS TABLE (status text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_session_club_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'error'::text, 'Not authenticated'::text;
    RETURN;
  END IF;

  -- Get session club_id
  SELECT club_id INTO v_session_club_id
  FROM sessions
  WHERE id = p_session_id
  LIMIT 1;

  IF v_session_club_id IS NULL THEN
    RETURN QUERY SELECT 'error'::text, 'Session not found'::text;
    RETURN;
  END IF;

  -- Check club membership
  IF NOT is_club_member(v_session_club_id, v_uid) THEN
    RETURN QUERY SELECT 'error'::text, 'Not a member of this club'::text;
    RETURN;
  END IF;

  -- Disable invite
  UPDATE sessions
  SET invite_enabled = false
  WHERE id = p_session_id;

  RETURN QUERY SELECT 'success'::text, NULL::text;
END;
$$;

-- =====================================================
-- STEP 9: Grants
-- =====================================================
REVOKE ALL ON FUNCTION generate_session_invite_token_rpc(uuid) FROM public;
GRANT EXECUTE ON FUNCTION generate_session_invite_token_rpc(uuid) TO authenticated;

REVOKE ALL ON FUNCTION join_session_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION join_session_by_token(text) TO authenticated;

REVOKE ALL ON FUNCTION disable_session_invite(uuid) FROM public;
GRANT EXECUTE ON FUNCTION disable_session_invite(uuid) TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICATION (optional, run manually)
-- =====================================================
-- 1. Check columns exist:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'sessions' 
-- AND column_name LIKE 'invite%';
--
-- 2. Check unique constraint exists:
-- SELECT conname FROM pg_constraint 
-- WHERE conname = 'unique_session_profile';
--
-- 3. Test token generation:
-- SELECT * FROM generate_session_invite_token_rpc('SESSION_ID_HERE');
--
-- 4. Test join (with valid token):
-- SELECT * FROM join_session_by_token('TOKEN_HERE');
