-- 1. Add volunteer_status enum to profiles
DO $$ BEGIN
  CREATE TYPE volunteer_status AS ENUM ('available', 'offline', 'busy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS volunteer_status volunteer_status DEFAULT 'offline';

-- Default existing volunteers to available
UPDATE profiles SET volunteer_status = 'available'
WHERE role = 'volunteer' AND volunteer_status IS NULL;

-- 2. Make assign_volunteer atomic with FOR UPDATE row locking
-- Replace the transition_donation function with row-locked version
CREATE OR REPLACE FUNCTION public.transition_donation(
  p_donation_id uuid,
  p_action text,
  p_actor_id uuid,
  p_extra jsonb DEFAULT NULL::jsonb
) RETURNS donations
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  d donations%ROWTYPE;
  v_deliveries_id uuid;
  v_actor_role user_role;
  v_actor_status user_status;
  v_vol_status volunteer_status;
  v_token uuid;
  v_received_qty numeric;
  v_notes text;
  v_prev_status text;
BEGIN
  -- Lock the donation row for the duration of this transaction
  SELECT * INTO d FROM donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found'; END IF;
  v_prev_status := d.status::text;

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
    PERFORM notify(d.restaurant_id, 'Donation Accepted', 'NGO accepted your donation "' || d.food_name || '".', 'info');
    PERFORM notify(p_actor_id, 'Donation Accepted', 'You accepted donation "' || d.food_name || '".', 'success');
    PERFORM log_donation_event(d.id, 'ngo_accepted', p_actor_id, v_prev_status, 'ngo_accepted');

  ELSIF p_action = 'assign_volunteer' THEN
    IF v_actor_role <> 'volunteer' THEN RAISE EXCEPTION 'Only a volunteer can accept a task'; END IF;
    IF d.status <> 'ngo_accepted' THEN RAISE EXCEPTION 'Donation not awaiting volunteer'; END IF;
    -- Atomic check: since we hold FOR UPDATE lock, volunteer_id IS NULL is guaranteed current
    IF d.volunteer_id IS NOT NULL THEN RAISE EXCEPTION 'This delivery has already been claimed by another volunteer.'; END IF;
    -- Check volunteer availability status
    SELECT volunteer_status INTO v_vol_status FROM profiles WHERE id = p_actor_id;
    IF v_vol_status IS NULL OR v_vol_status = 'offline' THEN
      RAISE EXCEPTION 'You must be available to accept delivery tasks.';
    END IF;
    IF v_vol_status = 'busy' THEN
      RAISE EXCEPTION 'You are currently busy with another delivery. Complete it first.';
    END IF;
    IF d.expiry_time < now() THEN RAISE EXCEPTION 'Donation expired'; END IF;

    -- Atomic assignment under row lock
    UPDATE donations SET volunteer_id = p_actor_id, status = 'volunteer_assigned', updated_at = now()
    WHERE id = d.id AND volunteer_id IS NULL RETURNING * INTO d;
    IF NOT FOUND THEN RAISE EXCEPTION 'This delivery has already been claimed by another volunteer.'; END IF;

    UPDATE deliveries SET volunteer_id = p_actor_id, status = 'accepted', updated_at = now() WHERE donation_id = d.id RETURNING id INTO v_deliveries_id;

    -- Set volunteer to busy
    UPDATE profiles SET volunteer_status = 'busy' WHERE id = p_actor_id;

    PERFORM notify(d.restaurant_id, 'Delivery Assigned', 'A volunteer has accepted your food donation delivery.', 'info');
    PERFORM notify(d.ngo_id, 'Volunteer Assigned', 'A volunteer has accepted the delivery for your accepted donation.', 'info');
    PERFORM notify(p_actor_id, 'Delivery Accepted', 'You have successfully claimed this food delivery.', 'success');
    PERFORM log_donation_event(d.id, 'volunteer_assigned', p_actor_id, v_prev_status, 'volunteer_assigned');

  ELSIF p_action = 'arrive_restaurant' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer can do this'; END IF;
    IF d.status <> 'volunteer_assigned' THEN RAISE EXCEPTION 'Invalid state'; END IF;
    UPDATE donations SET status = 'volunteer_arrived', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'arrived_restaurant', arrived_at_restaurant = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM log_donation_event(d.id, 'volunteer_arrived', p_actor_id, v_prev_status, 'volunteer_arrived');

  ELSIF p_action = 'verify_pickup' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer can do this'; END IF;
    IF d.status <> 'volunteer_arrived' THEN RAISE EXCEPTION 'Must arrive at restaurant first'; END IF;
    IF d.qr_used THEN RAISE EXCEPTION 'QR token already used'; END IF;
    IF d.qr_token IS NULL OR d.qr_token::text <> COALESCE((p_extra->>'qr_token'), '') THEN
      RAISE EXCEPTION 'Invalid QR token';
    END IF;
    UPDATE donations SET status = 'food_picked_up', qr_used = true, updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'food_picked_up', picked_up_at = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.restaurant_id, 'Food Picked Up', 'Volunteer has picked up "' || d.food_name || '".', 'info');
    PERFORM log_donation_event(d.id, 'pickup_verified', p_actor_id, v_prev_status, 'food_picked_up');

  ELSIF p_action = 'start_delivery' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer can do this'; END IF;
    IF d.status <> 'food_picked_up' THEN RAISE EXCEPTION 'Must pick up food first'; END IF;
    UPDATE donations SET status = 'in_transit', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'in_transit', started_at = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM log_donation_event(d.id, 'in_transit', p_actor_id, v_prev_status, 'in_transit');

  ELSIF p_action = 'arrive_ngo' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer can do this'; END IF;
    IF d.status <> 'in_transit' THEN RAISE EXCEPTION 'Must be in transit first'; END IF;
    UPDATE donations SET status = 'delivered', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'arrived_ngo', arrived_at_ngo = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.ngo_id, 'Delivery Arrived', 'Volunteer has arrived with "' || d.food_name || '". Please confirm receipt.', 'warning');
    PERFORM log_donation_event(d.id, 'delivered', p_actor_id, v_prev_status, 'delivered');

  ELSIF p_action = 'confirm_receipt' THEN
    IF v_actor_role <> 'ngo' OR d.ngo_id <> p_actor_id THEN RAISE EXCEPTION 'Only accepting NGO can confirm'; END IF;
    IF d.status <> 'delivered' THEN RAISE EXCEPTION 'Must be delivered first'; END IF;
    v_received_qty := NULLIF(p_extra->>'received_quantity', '')::numeric;
    v_notes := p_extra->>'notes';
    UPDATE donations SET status = 'completed', received_quantity = v_received_qty, receipt_notes = v_notes, updated_at = now()
    WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'completed', completed_at = now(), updated_at = now() WHERE donation_id = d.id;
    -- Set volunteer back to available
    UPDATE profiles SET volunteer_status = 'available' WHERE id = d.volunteer_id AND role = 'volunteer';
    PERFORM notify(d.restaurant_id, 'Delivery Completed', '"' || d.food_name || '" has been successfully delivered.', 'success');
    PERFORM notify(d.volunteer_id, 'Delivery Completed', '"' || d.food_name || '" delivery completed. Thank you!', 'success');
    PERFORM log_donation_event(d.id, 'completed', p_actor_id, v_prev_status, 'completed');

  ELSIF p_action = 'cancel' THEN
    IF v_actor_role NOT IN ('restaurant', 'admin') THEN RAISE EXCEPTION 'Only restaurant or admin can cancel'; END IF;
    IF v_actor_role = 'restaurant' AND d.restaurant_id <> p_actor_id THEN RAISE EXCEPTION 'Not your donation'; END IF;
    IF d.status IN ('completed', 'cancelled', 'expired') THEN RAISE EXCEPTION 'Already finished'; END IF;
    UPDATE donations SET status = 'cancelled', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'cancelled', updated_at = now() WHERE donation_id = d.id;
    -- Free the volunteer if one was assigned
    UPDATE profiles SET volunteer_status = 'available' WHERE id = d.volunteer_id AND role = 'volunteer';
    PERFORM notify(d.ngo_id, 'Donation Cancelled', '"' || d.food_name || '" has been cancelled by the restaurant.', 'warning');
    PERFORM notify(d.volunteer_id, 'Delivery Cancelled', 'Delivery for "' || d.food_name || '" has been cancelled.', 'warning');
    PERFORM log_donation_event(d.id, 'cancelled', p_actor_id, v_prev_status, 'cancelled');
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  RETURN d;
END;
$function$;

-- 3. RLS: allow volunteers to see available unassigned deliveries
DROP POLICY IF EXISTS deliveries_select_participants ON deliveries;
CREATE POLICY deliveries_select_participants ON deliveries
  FOR SELECT TO authenticated
  USING (
    restaurant_id = auth.uid()
    OR ngo_id = auth.uid()
    OR volunteer_id = auth.uid()
    OR is_admin(auth.uid())
    -- Volunteers can see unassigned available deliveries
    OR (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'volunteer'
        AND p.status = 'verified'
      )
      AND volunteer_id IS NULL
      AND status = 'assigned'
    )
  );

-- 4. RLS: volunteers can update their own volunteer_status
DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
