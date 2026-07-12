-- =====================================================
-- Migration: 20260712000000_delete_club_rpc
-- Purpose: Allow club OWNERS to delete a club and all its data
-- Notes:
--   - No DELETE policy exists on clubs, and sessions/players/transactions
--     FKs to clubs have no ON DELETE CASCADE — so deletion must go through
--     a SECURITY DEFINER RPC (same pattern as member_management_rpc).
--   - Owner-only (admins cannot delete a club).
--   - club_members rows cascade; profiles.active_club_id is SET NULL.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION delete_club(p_club_id uuid)
RETURNS TABLE (status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING errcode = 'PGRST301';
  END IF;

  IF NOT is_club_owner(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'Only the club owner can delete a club'
      USING errcode = 'PGRST301';
  END IF;

  -- Children first (no ON DELETE CASCADE on these FKs)
  DELETE FROM transactions WHERE club_id = p_club_id;
  DELETE FROM players WHERE club_id = p_club_id;
  DELETE FROM sessions WHERE club_id = p_club_id;

  -- club_members cascades; profiles.active_club_id becomes NULL
  DELETE FROM clubs WHERE id = p_club_id;

  RETURN QUERY SELECT 'deleted'::text;
END;
$$;

REVOKE ALL ON FUNCTION delete_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_club(uuid) TO authenticated;

COMMIT;
