-- =====================================================
-- Migration: 20250124000001_club_members_with_profiles
-- Purpose: RPC to fetch club members with email/display_name for Members page
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_club_members_with_profiles(p_club_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  created_at timestamptz,
  email text,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.user_id,
    cm.role,
    cm.created_at,
    p.email,
    p.display_name
  FROM club_members cm
  LEFT JOIN profiles p ON p.id = cm.user_id
  WHERE cm.club_id = p_club_id
    AND is_club_member(p_club_id, auth.uid())
  ORDER BY cm.created_at ASC;
$$;

REVOKE ALL ON FUNCTION get_club_members_with_profiles(uuid) FROM public;
GRANT EXECUTE ON FUNCTION get_club_members_with_profiles(uuid) TO authenticated;

COMMIT;
