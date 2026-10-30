/*
# Fix RLS recursion on profiles

1. Problem
The profiles SELECT policy "profiles_select_own_or_admin" uses
EXISTS (SELECT 1 FROM profiles ...), which causes infinite recursion
because the policy on profiles queries profiles itself.

2. Fix
- Add a SECURITY DEFINER function is_admin(uid uuid) that safely checks
  whether the given user is an admin (bypasses RLS).
- Rewrite the profiles SELECT policy to use is_admin(auth.uid()) instead
  of a subquery on profiles.
*/

CREATE OR REPLACE FUNCTION is_admin(p_uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_uid AND role = 'admin');
$$;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin(auth.uid()));

GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
