-- =====================================================
-- Migration: 20250114000004_member_management_rpc
-- Purpose: Member management RPCs (remove, role change) — v1.2
-- Requirements:
--   - SECURITY DEFINER RPCs only; no permissive RLS on club_members
--   - Owners cannot be removed or demoted; always >= 1 owner
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Optional helper — is_club_owner
-- =====================================================
CREATE OR REPLACE FUNCTION is_club_owner(p_club_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = p_club_id
      AND user_id = p_user_id
      AND role = 'owner'
  );
$$;

-- =====================================================
-- STEP 2: RPC — remove_club_member
-- =====================================================
CREATE OR REPLACE FUNCTION remove_club_member(p_club_id uuid, p_target_user_id uuid)
RETURNS TABLE (status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_caller_owner_or_admin boolean;
  v_target_role text;
  v_owner_count int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING errcode = 'PGRST301';
  END IF;

  IF NOT is_club_owner_or_admin(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'Only owners or admins can remove members'
      USING errcode = 'PGRST301';
  END IF;

  IF NOT is_club_member(p_club_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Target user is not a member of this club'
      USING errcode = 'PGRST301';
  END IF;

  SELECT role INTO v_target_role
  FROM club_members
  WHERE club_id = p_club_id AND user_id = p_target_user_id;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove an owner'
      USING errcode = 'PGRST301';
  END IF;

  -- Disallow owner removing themselves (v1.2: no self-removal for owners)
  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself'
      USING errcode = 'PGRST301';
  END IF;

  DELETE FROM club_members
  WHERE club_id = p_club_id AND user_id = p_target_user_id;

  RETURN QUERY SELECT 'removed'::text;
END;
$$;

-- =====================================================
-- STEP 3: RPC — update_club_member_role
-- =====================================================
CREATE OR REPLACE FUNCTION update_club_member_role(
  p_club_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS TABLE (status text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_target_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING errcode = 'PGRST301';
  END IF;

  IF NOT is_club_owner(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'Only owners can change member roles'
      USING errcode = 'PGRST301';
  END IF;

  IF p_new_role IS NULL OR p_new_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'new_role must be admin or member'
      USING errcode = 'PGRST301';
  END IF;

  IF NOT is_club_member(p_club_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Target user is not a member of this club'
      USING errcode = 'PGRST301';
  END IF;

  SELECT cm.role INTO v_target_role
  FROM club_members cm
  WHERE cm.club_id = p_club_id AND cm.user_id = p_target_user_id;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot demote an owner'
      USING errcode = 'PGRST301';
  END IF;

  UPDATE club_members
  SET role = p_new_role
  WHERE club_id = p_club_id AND user_id = p_target_user_id;

  RETURN QUERY SELECT 'updated'::text, p_new_role::text;
END;
$$;

-- =====================================================
-- STEP 4: Grants
-- =====================================================
REVOKE ALL ON FUNCTION remove_club_member(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION update_club_member_role(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION remove_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_club_member_role(uuid, uuid, text) TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICATION (run manually)
-- =====================================================
-- 1. Owners count per club >= 1:
--    SELECT club_id, COUNT(*) AS owners
--    FROM club_members WHERE role = 'owner'
--    GROUP BY club_id;
--    Expect: owners >= 1 per club.
--
-- 2. RPCs callable by authenticated:
--    SELECT proname, proacl FROM pg_proc
--    WHERE proname IN ('remove_club_member', 'update_club_member_role');
--
-- 3. Cannot delete owner via RPC:
--    As member/admin, call remove_club_member(club_id, owner_user_id);
--    Expect: exception "Cannot remove an owner".
