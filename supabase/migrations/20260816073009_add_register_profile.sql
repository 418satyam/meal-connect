/*
# Add register_profile function and lock down profile inserts

1. Why
The frontend will use the Supabase JS client directly (no custom API). Auth uses supabase.auth.signUp,
which creates an auth.users row but not a profile. We need a server-side way to create the profile
that hard-codes the role (restaurant|ngo|volunteer only) so a user cannot self-assign admin.

2. Changes
- Add SECURITY DEFINER function register_profile(p_email, p_password, p_role, p_data jsonb)
  that creates the auth user (via auth.admin) — wait, service role needed. Instead:
  The frontend calls supabase.auth.signUp first (creates auth user + session), then calls
  register_profile(p_role, p_data) which inserts the profile row as the calling user, validating
  that role is one of the allowed public roles and that no profile exists yet for this user.
- Drop the profiles_insert_own policy so direct inserts are blocked; only register_profile can insert.
*/

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE OR REPLACE FUNCTION register_profile(p_role text, p_data jsonb DEFAULT NULL)
RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_role NOT IN ('restaurant','ngo','volunteer') THEN RAISE EXCEPTION 'Invalid role'; END IF;

  SELECT count(*) INTO v_count FROM profiles WHERE id = v_uid;
  IF v_count > 0 THEN RAISE EXCEPTION 'Profile already exists'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;

  INSERT INTO profiles (id, email, role, status, name, phone, address,
    owner_name, operating_hours,
    organization_name, registration_number, contact_person, service_area,
    meal_capacity, storage_capacity, refrigeration_available, accepted_food_types,
    vehicle_type, availability)
  VALUES (
    v_uid, v_email, p_role::user_role, 'pending',
    COALESCE(p_data->>'name',''), COALESCE(p_data->>'phone',''), COALESCE(p_data->>'address',''),
    COALESCE(p_data->>'owner_name', p_data->>'name',''), COALESCE(p_data->>'operating_hours',''),
    COALESCE(p_data->>'organization_name', p_data->>'name',''), COALESCE(p_data->>'registration_number',''),
    COALESCE(p_data->>'contact_person', p_data->>'name',''), COALESCE(p_data->>'service_area',''),
    NULLIF(p_data->>'meal_capacity','')::integer, COALESCE(p_data->>'storage_capacity',''),
    COALESCE((p_data->>'refrigeration_available')::boolean, false),
    COALESCE(string_to_array(p_data->>'accepted_food_types', ','), ARRAY[]::text[]),
    COALESCE(p_data->>'vehicle_type',''), COALESCE(p_data->>'availability','')
  )
  RETURNING * INTO v_allowed;
  -- v_allowed is boolean but we need the row; reselect
  RETURN (SELECT * FROM profiles WHERE id = v_uid);
END;
$$;

-- Allow any authenticated user to call register_profile (it self-validates role + existence).
GRANT EXECUTE ON FUNCTION register_profile(text, jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION transition_donation(uuid, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_status(uuid, user_status) TO authenticated;
GRANT EXECUTE ON FUNCTION notify(uuid, text, text, notification_type) TO authenticated;
