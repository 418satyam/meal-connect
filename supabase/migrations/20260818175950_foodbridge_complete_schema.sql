-- ===== FOODBRIDGE SCHEMA =====
-- Enums
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('restaurant','ngo','volunteer','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('pending','verified','rejected','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE donation_status AS ENUM ('created','waiting_for_ngo','ngo_accepted','volunteer_assigned','volunteer_arrived','food_picked_up','in_transit','delivered','completed','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_status AS ENUM ('assigned','accepted','arrived_restaurant','food_picked_up','in_transit','arrived_ngo','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('info','success','warning','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'pending',
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  owner_name text,
  operating_hours text,
  organization_name text,
  registration_number text,
  contact_person text,
  service_area text,
  meal_capacity integer,
  storage_capacity text,
  refrigeration_available boolean DEFAULT false,
  accepted_food_types text[],
  vehicle_type text,
  availability text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Donations
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ngo_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  volunteer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  food_name text NOT NULL,
  category text NOT NULL,
  food_type text NOT NULL,
  description text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  estimated_servings integer NOT NULL CHECK (estimated_servings > 0),
  preparation_time timestamptz NOT NULL,
  expiry_time timestamptz NOT NULL,
  packaging text,
  allergens text,
  storage_requirements text,
  food_condition text,
  image text,
  pickup_address text NOT NULL,
  pickup_date date NOT NULL,
  pickup_start_time text NOT NULL,
  pickup_deadline text NOT NULL,
  contact_person text NOT NULL,
  contact_number text NOT NULL,
  pickup_instructions text,
  safety_confirmed boolean NOT NULL DEFAULT false,
  qr_token uuid UNIQUE,
  qr_used boolean NOT NULL DEFAULT false,
  status donation_status NOT NULL DEFAULT 'created',
  received_quantity numeric,
  receipt_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expiry_time > preparation_time)
);
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS donations_status_idx ON donations(status);
CREATE INDEX IF NOT EXISTS donations_restaurant_idx ON donations(restaurant_id);
CREATE INDEX IF NOT EXISTS donations_ngo_idx ON donations(ngo_id);

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  volunteer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  pickup_address text NOT NULL,
  drop_address text NOT NULL,
  quantity numeric NOT NULL,
  status delivery_status NOT NULL DEFAULT 'assigned',
  arrived_at_restaurant timestamptz,
  picked_up_at timestamptz,
  started_at timestamptz,
  arrived_at_ngo timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS deliveries_status_idx ON deliveries(status);
CREATE INDEX IF NOT EXISTS deliveries_volunteer_idx ON deliveries(volunteer_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS donations_set_updated_at ON donations;
CREATE TRIGGER donations_set_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS deliveries_set_updated_at ON deliveries;
CREATE TRIGGER deliveries_set_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- notify helper
CREATE OR REPLACE FUNCTION notify(p_user uuid, p_title text, p_msg text, p_type notification_type DEFAULT 'info')
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO notifications (user_id, title, message, type) VALUES (p_user, p_title, p_msg, p_type);
$$;

-- transition_donation (SECURITY DEFINER — all status changes server-side)
CREATE OR REPLACE FUNCTION transition_donation(
  p_donation_id uuid, p_action text, p_actor_id uuid, p_extra jsonb DEFAULT NULL
) RETURNS donations LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d donations%ROWTYPE;
  v_deliveries_id uuid;
  v_actor_role user_role;
  v_actor_status user_status;
  v_token uuid;
  v_received_qty numeric;
  v_notes text;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found'; END IF;
  SELECT role, status INTO v_actor_role, v_actor_status FROM profiles WHERE id = p_actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor profile not found'; END IF;
  IF v_actor_status = 'suspended' THEN RAISE EXCEPTION 'Account suspended'; END IF;

  IF p_action = 'accept_ngo' THEN
    IF v_actor_role <> 'ngo' THEN RAISE EXCEPTION 'Only an NGO can accept'; END IF;
    IF d.status NOT IN ('created','waiting_for_ngo') THEN RAISE EXCEPTION 'Donation not available'; END IF;
    IF d.expiry_time < now() THEN RAISE EXCEPTION 'Donation expired'; END IF;
    IF d.ngo_id IS NOT NULL THEN RAISE EXCEPTION 'Already accepted'; END IF;
    v_token := gen_random_uuid();
    UPDATE donations SET ngo_id = p_actor_id, status = 'ngo_accepted', qr_token = v_token, qr_used = false, updated_at = now()
    WHERE id = d.id RETURNING * INTO d;
    INSERT INTO deliveries (donation_id, restaurant_id, ngo_id, pickup_address, drop_address, quantity)
    VALUES (d.id, d.restaurant_id, p_actor_id, d.pickup_address, COALESCE((SELECT address FROM profiles WHERE id = p_actor_id), ''), d.quantity)
    RETURNING id INTO v_deliveries_id;
    PERFORM notify(d.restaurant_id, 'Donation Accepted', 'NGO accepted your donation "' || d.food_name || '".', 'success');
    PERFORM notify(p_actor_id, 'Donation Accepted', 'You accepted donation "' || d.food_name || '". A delivery task was created.', 'success');

  ELSIF p_action = 'assign_volunteer' THEN
    IF v_actor_role <> 'volunteer' THEN RAISE EXCEPTION 'Only a volunteer can accept a task'; END IF;
    IF d.status <> 'ngo_accepted' THEN RAISE EXCEPTION 'Donation not awaiting volunteer'; END IF;
    IF d.volunteer_id IS NOT NULL THEN RAISE EXCEPTION 'Volunteer already assigned'; END IF;
    UPDATE donations SET volunteer_id = p_actor_id, status = 'volunteer_assigned', updated_at = now()
    WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET volunteer_id = p_actor_id, status = 'accepted', updated_at = now() WHERE donation_id = d.id RETURNING id INTO v_deliveries_id;
    PERFORM notify(d.restaurant_id, 'Volunteer Assigned', 'A volunteer has been assigned for "' || d.food_name || '".', 'info');
    PERFORM notify(d.ngo_id, 'Volunteer Assigned', 'A volunteer has been assigned for "' || d.food_name || '".', 'info');
    PERFORM notify(p_actor_id, 'Task Accepted', 'You accepted the delivery task for "' || d.food_name || '".', 'success');

  ELSIF p_action = 'arrive_restaurant' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'volunteer_assigned' THEN RAISE EXCEPTION 'Invalid state for arrival'; END IF;
    UPDATE donations SET status = 'volunteer_arrived', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'arrived_restaurant', arrived_at_restaurant = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.restaurant_id, 'Volunteer Arrived', 'Volunteer arrived at your location for "' || d.food_name || '".', 'info');

  ELSIF p_action = 'verify_pickup' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'volunteer_arrived' THEN RAISE EXCEPTION 'Must arrive at restaurant first'; END IF;
    v_token := (p_extra->>'qr_token')::uuid;
    IF v_token IS NULL OR d.qr_token IS NULL OR v_token <> d.qr_token THEN RAISE EXCEPTION 'Invalid QR token'; END IF;
    IF d.qr_used THEN RAISE EXCEPTION 'QR token already used'; END IF;
    UPDATE donations SET status = 'food_picked_up', qr_used = true, updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'food_picked_up', picked_up_at = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.restaurant_id, 'Food Picked Up', 'Pickup confirmed for "' || d.food_name || '".', 'success');
    PERFORM notify(d.ngo_id, 'Food Picked Up', 'Volunteer picked up "' || d.food_name || '".', 'success');

  ELSIF p_action = 'start_delivery' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'food_picked_up' THEN RAISE EXCEPTION 'Pickup must be verified first'; END IF;
    UPDATE donations SET status = 'in_transit', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'in_transit', started_at = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.ngo_id, 'Delivery In Transit', '"' || d.food_name || '" is on its way.', 'info');

  ELSIF p_action = 'arrive_ngo' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'in_transit' THEN RAISE EXCEPTION 'Delivery must be in transit'; END IF;
    UPDATE donations SET status = 'delivered', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'arrived_ngo', arrived_at_ngo = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.ngo_id, 'Delivery Arrived', 'Volunteer has arrived with "' || d.food_name || '". Please confirm receipt.', 'warning');
    PERFORM notify(d.restaurant_id, 'Delivery Arrived at NGO', '"' || d.food_name || '" has arrived at the NGO.', 'info');

  ELSIF p_action = 'confirm_receipt' THEN
    IF v_actor_role <> 'ngo' OR d.ngo_id <> p_actor_id THEN RAISE EXCEPTION 'Only the assigned NGO can confirm'; END IF;
    IF d.status <> 'delivered' THEN RAISE EXCEPTION 'Donation not awaiting receipt'; END IF;
    v_received_qty := NULLIF(p_extra->>'received_quantity','')::numeric;
    v_notes := p_extra->>'notes';
    UPDATE donations SET status = 'completed', received_quantity = COALESCE(v_received_qty, quantity), receipt_notes = v_notes, updated_at = now()
    WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'completed', completed_at = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.restaurant_id, 'Donation Completed', '"' || d.food_name || '" was received by the NGO. Thank you!', 'success');
    PERFORM notify(d.volunteer_id, 'Delivery Completed', 'Delivery of "' || d.food_name || '" completed. Thank you!', 'success');
    PERFORM notify(d.ngo_id, 'Receipt Confirmed', 'You confirmed receipt of "' || d.food_name || '".', 'success');

  ELSIF p_action = 'cancel' THEN
    IF v_actor_role NOT IN ('restaurant','admin') THEN RAISE EXCEPTION 'Only restaurant or admin can cancel'; END IF;
    IF v_actor_role = 'restaurant' AND d.restaurant_id <> p_actor_id THEN RAISE EXCEPTION 'Not your donation'; END IF;
    IF d.status IN ('completed','cancelled','delivered') THEN RAISE EXCEPTION 'Cannot cancel now'; END IF;
    UPDATE donations SET status = 'cancelled', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'cancelled', updated_at = now() WHERE donation_id = d.id;
    IF d.ngo_id IS NOT NULL THEN PERFORM notify(d.ngo_id, 'Donation Cancelled', '"' || d.food_name || '" was cancelled.', 'warning'); END IF;
    IF d.volunteer_id IS NOT NULL THEN PERFORM notify(d.volunteer_id, 'Task Cancelled', 'Delivery task for "' || d.food_name || '" was cancelled.', 'warning'); END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
  RETURN d;
END;
$$;

-- admin_set_user_status
CREATE OR REPLACE FUNCTION admin_set_user_status(p_target uuid, p_status user_status)
RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE caller profiles%ROWTYPE; target_row profiles%ROWTYPE;
BEGIN
  SELECT * INTO caller FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR caller.role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO target_row FROM profiles WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  UPDATE profiles SET status = p_status, updated_at = now() WHERE id = p_target RETURNING * INTO target_row;
  RETURN target_row;
END;
$$;

-- register_profile (creates profile row after auth.signUp — prevents admin self-registration)
CREATE OR REPLACE FUNCTION register_profile(p_role text, p_data jsonb DEFAULT NULL)
RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer;
  v_row profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_role NOT IN ('restaurant','ngo','volunteer') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT count(*) INTO v_count FROM profiles WHERE id = v_uid;
  IF v_count > 0 THEN RAISE EXCEPTION 'Profile already exists'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO profiles (id, email, role, status, name, phone, address,
    owner_name, operating_hours, organization_name, registration_number, contact_person, service_area,
    meal_capacity, storage_capacity, refrigeration_available, accepted_food_types, vehicle_type, availability)
  VALUES (
    v_uid, v_email, p_role::user_role, 'verified',
    COALESCE(p_data->>'name',''), COALESCE(p_data->>'phone',''), COALESCE(p_data->>'address',''),
    COALESCE(NULLIF(p_data->>'owner_name',''), p_data->>'name',''), COALESCE(p_data->>'operating_hours',''),
    COALESCE(NULLIF(p_data->>'organization_name',''), p_data->>'name',''), COALESCE(p_data->>'registration_number',''),
    COALESCE(NULLIF(p_data->>'contact_person',''), p_data->>'name',''), COALESCE(p_data->>'service_area',''),
    NULLIF(p_data->>'meal_capacity','')::integer, COALESCE(p_data->>'storage_capacity',''),
    COALESCE((p_data->>'refrigeration_available')::boolean, false),
    COALESCE(string_to_array(NULLIF(p_data->>'accepted_food_types',''), ','), ARRAY[]::text[]),
    COALESCE(p_data->>'vehicle_type',''), COALESCE(p_data->>'availability','')
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- is_admin (avoids RLS recursion on profiles SELECT)
CREATE OR REPLACE FUNCTION is_admin(p_uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_uid AND role = 'admin');
$$;

-- ===== RLS POLICIES =====
-- profiles: select own or admin; update own; NO direct insert (register_profile handles it)
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- donations
DROP POLICY IF EXISTS "donations_select_participants" ON donations;
CREATE POLICY "donations_select_participants" ON donations FOR SELECT TO authenticated USING (
  restaurant_id = auth.uid() OR ngo_id = auth.uid() OR volunteer_id = auth.uid()
  OR status = 'waiting_for_ngo' OR is_admin(auth.uid())
);
DROP POLICY IF EXISTS "donations_insert_restaurant" ON donations;
CREATE POLICY "donations_insert_restaurant" ON donations FOR INSERT
  TO authenticated WITH CHECK (restaurant_id = auth.uid());
DROP POLICY IF EXISTS "donations_update_restaurant" ON donations;
CREATE POLICY "donations_update_restaurant" ON donations FOR UPDATE
  TO authenticated USING (restaurant_id = auth.uid()) WITH CHECK (restaurant_id = auth.uid());

-- deliveries
DROP POLICY IF EXISTS "deliveries_select_participants" ON deliveries;
CREATE POLICY "deliveries_select_participants" ON deliveries FOR SELECT TO authenticated USING (
  restaurant_id = auth.uid() OR ngo_id = auth.uid() OR volunteer_id = auth.uid() OR is_admin(auth.uid())
);

-- notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- ===== GRANTS =====
GRANT EXECUTE ON FUNCTION register_profile(text, jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION transition_donation(uuid, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_status(uuid, user_status) TO authenticated;
GRANT EXECUTE ON FUNCTION notify(uuid, text, text, notification_type) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
