-- Link Players Admin RPCs - Base44 Club owner/admin only

BEGIN;

CREATE OR REPLACE FUNCTION search_profiles_by_email(p_club_id uuid, p_search text)
RETURNS TABLE (user_id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_club_slug text;
  v_search text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'PGRST301'; END IF;
  SELECT slug INTO v_club_slug FROM clubs WHERE id = p_club_id LIMIT 1;
  IF v_club_slug IS NULL OR v_club_slug != 'base44' THEN
    RAISE EXCEPTION 'Link players is only for Base44 Club' USING errcode = 'PGRST301';
  END IF;
  IF NOT is_club_owner_or_admin(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'Only owners or admins can search' USING errcode = 'PGRST301';
  END IF;
  v_search := coalesce(trim(p_search), '');
  IF length(v_search) < 2 THEN RETURN; END IF;
  v_search := '%' || v_search || '%';
  RETURN QUERY
  SELECT p.id, coalesce(p.email, au.email::text), p.display_name
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE (p.email ILIKE v_search OR au.email::text ILIKE v_search OR coalesce(p.display_name, '') ILIKE v_search)
  ORDER BY coalesce(p.email, au.email::text) ASC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION search_profiles_by_email(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION search_profiles_by_email(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION link_player_to_profile(p_player_id uuid, p_profile_id uuid)
RETURNS TABLE (status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_player_club_id uuid;
  v_club_slug text;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'PGRST301'; END IF;
  SELECT club_id INTO v_player_club_id FROM players WHERE id = p_player_id LIMIT 1;
  IF v_player_club_id IS NULL THEN RAISE EXCEPTION 'Player not found' USING errcode = 'PGRST116'; END IF;
  SELECT slug INTO v_club_slug FROM clubs WHERE id = v_player_club_id LIMIT 1;
  IF v_club_slug IS NULL OR v_club_slug != 'base44' THEN
    RAISE EXCEPTION 'Link players is only for Base44 Club' USING errcode = 'PGRST301';
  END IF;
  IF NOT is_club_owner_or_admin(v_player_club_id, v_uid) THEN
    RAISE EXCEPTION 'Only owners or admins can link' USING errcode = 'PGRST301';
  END IF;
  UPDATE players SET profile_id = p_profile_id WHERE id = p_player_id AND club_id = v_player_club_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN QUERY SELECT 'no_update'::text;
  ELSE RETURN QUERY SELECT 'ok'::text; END IF;
END;
$$;

REVOKE ALL ON FUNCTION link_player_to_profile(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION link_player_to_profile(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION link_players_by_name_to_profile(p_club_id uuid, p_player_name text, p_profile_id uuid)
RETURNS TABLE (status text, updated_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_club_slug text;
  v_name_trimmed text;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'PGRST301'; END IF;
  SELECT slug INTO v_club_slug FROM clubs WHERE id = p_club_id LIMIT 1;
  IF v_club_slug IS NULL OR v_club_slug != 'base44' THEN
    RAISE EXCEPTION 'Link players is only for Base44 Club' USING errcode = 'PGRST301';
  END IF;
  IF NOT is_club_owner_or_admin(p_club_id, v_uid) THEN
    RAISE EXCEPTION 'Only owners or admins can link' USING errcode = 'PGRST301';
  END IF;
  v_name_trimmed := coalesce(trim(p_player_name), '');
  IF v_name_trimmed = '' THEN RETURN QUERY SELECT 'invalid_name'::text, 0; RETURN; END IF;
  WITH updated AS (
    UPDATE players SET profile_id = p_profile_id
    WHERE club_id = p_club_id AND trim(name) = v_name_trimmed AND profile_id IS NULL
    RETURNING id
  )
  SELECT count(*)::int INTO v_updated FROM updated;
  RETURN QUERY SELECT 'ok'::text, v_updated;
END;
$$;

REVOKE ALL ON FUNCTION link_players_by_name_to_profile(uuid, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION link_players_by_name_to_profile(uuid, text, uuid) TO authenticated;

COMMIT;
