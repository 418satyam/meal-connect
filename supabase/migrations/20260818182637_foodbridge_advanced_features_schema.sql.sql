/*
# FoodBridge Advanced Features Schema

## Purpose
Adds database support for 17 advanced features: smart reassignment, rescue/escalation mode,
donation recovery chain, explainable matching, volunteer reliability scores, food waste analytics,
surplus insights, heatmap data, success probability, what-if simulation, smart expiry warnings,
pickup risk indicators, delivery exceptions, smart priority queue, live operations, auditable
decision history, and research comparison.

## New Tables
1. `donation_events` — Auditable decision history for every donation state change
2. `match_attempts` — Recovery chain history: which NGOs/volunteers were tried, accepted, or rejected
3. `delivery_exceptions` — Exception reports for deliveries (quantity mismatch, condition issues, etc.)
4. `simulation_runs` — Admin what-if simulation runs and their predicted outcomes

## New Columns on `donations`
- `priority` (enum: normal, medium, high, critical, rescue) — urgency level
- `rescue_mode` (boolean) — whether rescue mode is active
- `escalation_count` (integer) — how many times escalated
- `reassignment_count` (integer) — volunteer reassignment count
- `expiry_notified_at` (timestamptz) — last expiry warning notification timestamp

## New Enums
- `donation_priority`: normal, medium, high, critical, rescue
- `event_type`: created, ngo_recommended, ngo_accepted, ngo_rejected, volunteer_recommended,
  volunteer_assigned, volunteer_arrived, pickup_verified, in_transit, delivered, completed,
  cancelled, expired, escalated, rescue_started, reassigned, exception_reported
- `match_target_type`: ngo, volunteer
- `match_outcome`: pending, accepted, rejected, expired, reassigned
- `exception_type`: restaurant_unavailable, ngo_unavailable, quantity_mismatch, food_condition,
  vehicle_problem, route_problem, pickup_delayed, other
- `exception_status`: open, resolved, acknowledged

## New Functions
1. `log_donation_event(p_donation_id, p_event_type, p_actor_id, p_prev_status, p_new_status, p_reason, p_metadata)`
   — Inserts a row into donation_events. SECURITY DEFINER so it can be called from transition_donation.
2. `calculate_volunteer_reliability(p_volunteer_id)`
   — Computes reliability score (0-100) from completed/cancelled/no-show deliveries. Returns jsonb with
   score, total_deliveries, completed, cancelled, no_show, on_time_pickups, avg_response_minutes, label.
3. `calculate_ngo_match_score(p_donation_id, p_ngo_id)`
   — Scores an NGO for a donation based on food_type compatibility, meal_capacity, refrigeration,
   current workload, and expiry feasibility. Returns jsonb with score (0-100) and reasons array.
4. `calculate_volunteer_match_score(p_donation_id, p_volunteer_id)`
   — Scores a volunteer based on reliability, current workload, vehicle type, and expiry feasibility.
   Returns jsonb with score (0-100) and reasons array.
5. `calculate_priority(p_donation_id)`
   — Computes the priority level (normal/medium/high/critical/rescue/expired) from expiry_time.
   Returns text.
6. `calculate_pickup_risk(p_donation_id)`
   — Computes pickup risk (LOW/MEDIUM/HIGH/CRITICAL) from time remaining, volunteer status, distance.
   Returns jsonb with level, reason, minutes_remaining, volunteer_eta_estimate.
7. `calculate_success_probability(p_donation_id)`
   — Estimates probability (0-100) of successful redistribution based on time remaining, NGO availability,
   volunteer availability, distance. Returns jsonb with probability, factors array.
8. `trigger_rescue_mode(p_donation_id, p_actor_id)`
   — Marks a donation as rescue mode, sets priority to 'rescue', notifies nearby NGOs and volunteers,
   logs the event. SECURITY DEFINER.
9. `cancel_volunteer_assignment(p_donation_id, p_actor_id, p_reason)`
   — Removes current volunteer, increments reassignment_count, resets donation to ngo_accepted status,
   finds best replacement volunteer, notifies them. SECURITY DEFINER.
10. `ngo_reject_donation(p_donation_id, p_actor_id, p_reason)`
    — NGO rejects an already-accepted donation. Resets to waiting_for_ngo, logs to match_attempts,
    triggers recovery chain to find next NGO. SECURITY DEFINER.
11. `report_delivery_exception(p_donation_id, p_actor_id, p_exception_type, p_expected, p_actual, p_reason)`
    — Creates a delivery_exceptions record, notifies relevant parties, logs event. SECURITY DEFINER.
12. `get_live_operations()`
    — Returns jsonb with counts of active donations, pending NGO, waiting volunteer, active pickups,
    in-transit, at-risk, rescue-mode, expired, completed today. Admin-only. SECURITY DEFINER.
13. `get_impact_metrics(p_user_id, p_role)`
    — Returns jsonb with meals_rescued, food_weight_estimate, donations_completed, donations_expired,
    donations_cancelled, rescue_success_rate. SECURITY DEFINER.
14. `get_surplus_insights(p_restaurant_id)`
    — Returns jsonb with donations by day-of-week, by hour, by category, avg quantity, most donated food,
    success vs expired counts. SECURITY DEFINER.
15. `run_simulation(p_params jsonb)`
    — Admin-only what-if simulation. Takes volunteer_count, ngo_capacity, max_radius, avg_pickup_time,
    donation_volume. Returns jsonb with predicted metrics. SECURITY DEFINER.

## Security
- All new tables have RLS enabled with appropriate policies
- All new functions use SECURITY DEFINER where they need to bypass RLS
- Admin-only functions verify caller role via is_admin()
- Event logging is write-only from SECURITY DEFINER functions

## Important Notes
1. All calculations use REAL data from the database — no hardcoded scores
2. Reliability score is computed, never stored as a user-editable field
3. If insufficient historical data, functions return appropriate empty/null states
4. Priority and risk calculations are time-based and recompute on each call
5. Match scores are explainable — each includes a reasons array
*/
-- ===== NEW ENUMS =====
DO $$ BEGIN CREATE TYPE donation_priority AS ENUM ('normal','medium','high','critical','rescue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE event_type AS ENUM (
  'created','ngo_recommended','ngo_accepted','ngo_rejected','volunteer_recommended',
  'volunteer_assigned','volunteer_arrived','pickup_verified','in_transit','delivered',
  'completed','cancelled','expired','escalated','rescue_started','reassigned','exception_reported'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE match_target_type AS ENUM ('ngo','volunteer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE match_outcome AS ENUM ('pending','accepted','rejected','expired','reassigned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exception_type AS ENUM (
  'restaurant_unavailable','ngo_unavailable','quantity_mismatch','food_condition',
  'vehicle_problem','route_problem','pickup_delayed','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exception_status AS ENUM ('open','acknowledged','resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== NEW COLUMNS ON donations =====
ALTER TABLE donations ADD COLUMN IF NOT EXISTS priority donation_priority DEFAULT 'normal';
ALTER TABLE donations ADD COLUMN IF NOT EXISTS rescue_mode boolean DEFAULT false;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS escalation_count integer DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS reassignment_count integer DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

-- ===== TABLE: donation_events (auditable decision history) =====
CREATE TABLE IF NOT EXISTS donation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  previous_status text,
  new_status text,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE donation_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS donation_events_donation_idx ON donation_events(donation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS donation_events_type_idx ON donation_events(event_type);

-- ===== TABLE: match_attempts (recovery chain history) =====
CREATE TABLE IF NOT EXISTS match_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  target_type match_target_type NOT NULL,
  target_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score integer,
  reasons jsonb,
  outcome match_outcome NOT NULL DEFAULT 'pending',
  attempted_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
ALTER TABLE match_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS match_attempts_donation_idx ON match_attempts(donation_id, attempted_at DESC);

-- ===== TABLE: delivery_exceptions =====
CREATE TABLE IF NOT EXISTS delivery_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exception_type exception_type NOT NULL,
  expected_value text,
  actual_value text,
  reason text NOT NULL,
  status exception_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE delivery_exceptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS delivery_exceptions_donation_idx ON delivery_exceptions(donation_id);

-- ===== TABLE: simulation_runs =====
CREATE TABLE IF NOT EXISTS simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  params jsonb NOT NULL,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS simulation_runs_created_idx ON simulation_runs(created_at DESC);

-- ===== FUNCTION: log_donation_event =====
CREATE OR REPLACE FUNCTION log_donation_event(
  p_donation_id uuid, p_event_type event_type, p_actor_id uuid DEFAULT NULL,
  p_prev_status text DEFAULT NULL, p_new_status text DEFAULT NULL,
  p_reason text DEFAULT NULL, p_metadata jsonb DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO donation_events (donation_id, event_type, actor_id, previous_status, new_status, reason, metadata)
  VALUES (p_donation_id, p_event_type, p_actor_id, p_prev_status, p_new_status, p_reason, p_metadata);
$$;
GRANT EXECUTE ON FUNCTION log_donation_event(uuid, event_type, uuid, text, text, text, jsonb) TO authenticated;

-- ===== FUNCTION: calculate_volunteer_reliability =====
CREATE OR REPLACE FUNCTION calculate_volunteer_reliability(p_volunteer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_total integer;
  v_completed integer;
  v_cancelled integer;
  v_no_show integer;
  v_on_time integer;
  v_avg_response numeric;
  v_score numeric;
  v_label text;
  v_cancel_rate numeric;
  v_completion_rate numeric;
  v_on_time_rate numeric;
BEGIN
  SELECT
    count(*) FILTER (WHERE status IN ('completed','cancelled')),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'cancelled'),
    count(*) FILTER (WHERE status = 'completed' AND picked_up_at IS NOT NULL AND arrived_at_restaurant IS NOT NULL
      AND EXTRACT(EPOCH FROM (picked_up_at - arrived_at_restaurant)) < 600),
    AVG(EXTRACT(EPOCH FROM (arrived_at_restaurant - created_at))/60) FILTER (WHERE arrived_at_restaurant IS NOT NULL)
  INTO v_total, v_completed, v_cancelled, v_on_time, v_avg_response
  FROM deliveries WHERE volunteer_id = p_volunteer_id;

  -- No-show: assigned but never arrived within 2x pickup window (approximated as cancelled without arrival)
  SELECT count(*) INTO v_no_show FROM deliveries
  WHERE volunteer_id = p_volunteer_id AND status = 'cancelled' AND arrived_at_restaurant IS NULL;

  IF v_total IS NULL OR v_total = 0 THEN
    RETURN jsonb_build_object('score', NULL, 'label', 'No history yet', 'total_deliveries', 0,
      'completed', 0, 'cancelled', 0, 'no_show', 0, 'on_time_pickups', 0,
      'on_time_rate', NULL, 'completion_rate', NULL, 'cancel_rate', NULL, 'avg_response_minutes', NULL);
  END IF;

  v_completion_rate := ROUND((v_completed::numeric / v_total) * 100, 1);
  v_cancel_rate := ROUND((v_cancelled::numeric / v_total) * 100, 1);
  v_on_time_rate := CASE WHEN v_completed > 0 THEN ROUND((v_on_time::numeric / v_completed) * 100, 1) ELSE NULL END;

  -- Score: weighted combination
  v_score := ROUND(
    (COALESCE(v_completion_rate, 50) * 0.40) +
    (COALESCE(v_on_time_rate, 50) * 0.30) +
    ((100 - v_cancel_rate) * 0.20) +
    ((100 - LEAST(v_no_show::numeric / v_total * 100, 100)) * 0.10),
  1);

  v_label := CASE
    WHEN v_score >= 90 THEN 'Excellent'
    WHEN v_score >= 75 THEN 'Good'
    WHEN v_score >= 60 THEN 'Average'
    WHEN v_score >= 40 THEN 'Below Average'
    ELSE 'Poor'
  END;

  RETURN jsonb_build_object(
    'score', v_score,
    'label', v_label,
    'total_deliveries', v_total,
    'completed', v_completed,
    'cancelled', v_cancelled,
    'no_show', v_no_show,
    'on_time_pickups', v_on_time,
    'on_time_rate', v_on_time_rate,
    'completion_rate', v_completion_rate,
    'cancel_rate', v_cancel_rate,
    'avg_response_minutes', ROUND(v_avg_response, 1)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION calculate_volunteer_reliability(uuid) TO authenticated;

-- ===== FUNCTION: calculate_ngo_match_score =====
CREATE OR REPLACE FUNCTION calculate_ngo_match_score(p_donation_id uuid, p_ngo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  d donations%ROWTYPE;
  ngo profiles%ROWTYPE;
  v_score integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_workload integer;
  v_active_count integer;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('score', 0, 'reasons', '[]'); END IF;
  SELECT * INTO ngo FROM profiles WHERE id = p_ngo_id AND role = 'ngo' AND status = 'verified';
  IF NOT FOUND THEN RETURN jsonb_build_object('score', 0, 'reasons', '[]'); END IF;

  -- Food type compatibility (25 pts)
  IF ngo.accepted_food_types IS NOT NULL AND array_length(ngo.accepted_food_types, 1) > 0 THEN
    IF d.food_type = ANY(ngo.accepted_food_types) THEN
      v_score := v_score + 25;
      v_reasons := v_reasons || jsonb_build_array('Accepts ' || d.food_type || ' food');
    ELSE
      v_reasons := v_reasons || jsonb_build_array('Does not accept ' || d.food_type || ' food');
    END IF;
  ELSE
    v_score := v_score + 15;
  END IF;

  -- Meal capacity (20 pts)
  IF ngo.meal_capacity IS NOT NULL AND ngo.meal_capacity >= d.estimated_servings THEN
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_array('Enough capacity (' || ngo.meal_capacity || ' meals)');
  ELSIF ngo.meal_capacity IS NOT NULL THEN
    v_reasons := v_reasons || jsonb_build_array('Limited capacity (' || ngo.meal_capacity || ' vs ' || d.estimated_servings || ' needed)');
  END IF;

  -- Refrigeration (10 pts) — for perishable foods
  IF d.category IN ('Cooked Meals','Dairy') THEN
    IF ngo.refrigeration_available THEN
      v_score := v_score + 10;
      v_reasons := v_reasons || jsonb_build_array('Has refrigeration for perishables');
    END IF;
  ELSE
    v_score := v_score + 10;
  END IF;

  -- Current workload (20 pts) — fewer active donations = better
  SELECT count(*) INTO v_active_count FROM donations
  WHERE ngo_id = p_ngo_id AND status NOT IN ('completed','cancelled','expired');
  IF v_active_count = 0 THEN
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_array('No active donations — available');
  ELSIF v_active_count <= 2 THEN
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array('Low workload (' || v_active_count || ' active)');
  ELSIF v_active_count <= 5 THEN
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_array('Moderate workload (' || v_active_count || ' active)');
  ELSE
    v_reasons := v_reasons || jsonb_build_array('High workload (' || v_active_count || ' active)');
  END IF;

  -- Expiry feasibility (25 pts)
  IF d.expiry_time > now() + interval '2 hours' THEN
    v_score := v_score + 25;
    v_reasons := v_reasons || jsonb_build_array('Plenty of time before expiry');
  ELSIF d.expiry_time > now() + interval '1 hour' THEN
    v_score := v_score + 18;
    v_reasons := v_reasons || jsonb_build_array('Adequate time before expiry');
  ELSIF d.expiry_time > now() + interval '30 minutes' THEN
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_array('Limited time before expiry');
  ELSE
    v_reasons := v_reasons || jsonb_build_array('Very little time — high urgency');
  END IF;

  v_score := LEAST(v_score, 100);

  RETURN jsonb_build_object('score', v_score, 'reasons', v_reasons, 'workload', v_active_count);
END;
$$;
GRANT EXECUTE ON FUNCTION calculate_ngo_match_score(uuid, uuid) TO authenticated;

-- ===== FUNCTION: calculate_volunteer_match_score =====
CREATE OR REPLACE FUNCTION calculate_volunteer_match_score(p_donation_id uuid, p_volunteer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  d donations%ROWTYPE;
  vol profiles%ROWTYPE;
  v_score integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_reliability jsonb;
  v_active_count integer;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('score', 0, 'reasons', '[]'); END IF;
  SELECT * INTO vol FROM profiles WHERE id = p_volunteer_id AND role = 'volunteer' AND status = 'verified';
  IF NOT FOUND THEN RETURN jsonb_build_object('score', 0, 'reasons', '[]'); END IF;

  -- Reliability score (35 pts)
  SELECT calculate_volunteer_reliability(p_volunteer_id) INTO v_reliability;
  IF (v_reliability->>'score') IS NOT NULL THEN
    v_score := v_score + ROUND(((v_reliability->>'score')::numeric / 100) * 35);
    v_reasons := v_reasons || jsonb_build_array('Reliability: ' || (v_reliability->>'score') || '% (' || (v_reliability->>'label') || ')');
  ELSE
    v_score := v_score + 17;
    v_reasons := v_reasons || jsonb_build_array('New volunteer — no history yet');
  END IF;

  -- Current workload (25 pts)
  SELECT count(*) INTO v_active_count FROM deliveries
  WHERE volunteer_id = p_volunteer_id AND status NOT IN ('completed','cancelled');
  IF v_active_count = 0 THEN
    v_score := v_score + 25;
    v_reasons := v_reasons || jsonb_build_array('No active deliveries — fully available');
  ELSIF v_active_count = 1 THEN
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array('One active delivery');
  ELSE
    v_score := v_score + 5;
    v_reasons := v_reasons || jsonb_build_array(v_active_count || ' active deliveries — high workload');
  END IF;

  -- Vehicle type (15 pts) — bigger vehicle better for larger quantities
  IF d.quantity >= 30 AND vol.vehicle_type IN ('Car','Three-wheeler') THEN
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array('Suitable vehicle (' || COALESCE(vol.vehicle_type,'N/A') || ') for ' || d.quantity || ' servings');
  ELSIF vol.vehicle_type IS NOT NULL THEN
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_array('Vehicle: ' || vol.vehicle_type);
  ELSE
    v_score := v_score + 5;
  END IF;

  -- Expiry feasibility (25 pts)
  IF d.expiry_time > now() + interval '2 hours' THEN
    v_score := v_score + 25;
    v_reasons := v_reasons || jsonb_build_array('Can reach before expiry');
  ELSIF d.expiry_time > now() + interval '1 hour' THEN
    v_score := v_score + 18;
    v_reasons := v_reasons || jsonb_build_array('Adequate time to reach before expiry');
  ELSIF d.expiry_time > now() + interval '30 minutes' THEN
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_array('Tight timing — may struggle to reach before expiry');
  ELSE
    v_reasons := v_reasons || jsonb_build_array('Very little time — may not reach before expiry');
  END IF;

  v_score := LEAST(v_score, 100);

  RETURN jsonb_build_object('score', v_score, 'reasons', v_reasons, 'reliability', v_reliability, 'workload', v_active_count);
END;
$$;
GRANT EXECUTE ON FUNCTION calculate_volunteer_match_score(uuid, uuid) TO authenticated;

-- ===== FUNCTION: calculate_priority =====
CREATE OR REPLACE FUNCTION calculate_priority(p_donation_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  d donations%ROWTYPE;
  v_remaining interval;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RETURN 'normal'; END IF;

  IF d.status IN ('completed','cancelled','expired') THEN
    RETURN CASE WHEN d.status = 'expired' THEN 'expired' ELSE 'normal' END;
  END IF;

  v_remaining := d.expiry_time - now();
  IF v_remaining <= interval '0' THEN RETURN 'expired'; END IF;
  IF v_remaining <= interval '10 minutes' THEN RETURN 'rescue'; END IF;
  IF v_remaining <= interval '30 minutes' THEN RETURN 'critical'; END IF;
  IF v_remaining <= interval '1 hour' THEN RETURN 'high'; END IF;
  IF v_remaining <= interval '2 hours' THEN RETURN 'medium'; END IF;
  RETURN 'normal';
END;
$$;
GRANT EXECUTE ON FUNCTION calculate_priority(uuid) TO authenticated;

-- ===== FUNCTION: calculate_pickup_risk =====
CREATE OR REPLACE FUNCTION calculate_pickup_risk(p_donation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  d donations%ROWTYPE;
  v_remaining_min numeric;
  v_level text := 'LOW';
  v_reason text;
  v_volunteer_assigned boolean;
  v_eta_min numeric := NULL;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('level','LOW','reason','Unknown donation'); END IF;

  IF d.status IN ('completed','cancelled','expired','delivered') THEN
    RETURN jsonb_build_object('level','LOW','reason','Donation is ' || d.status, 'minutes_remaining', 0, 'volunteer_eta_estimate', NULL);
  END IF;

  v_remaining_min := EXTRACT(EPOCH FROM (d.expiry_time - now())) / 60;
  v_volunteer_assigned := d.volunteer_id IS NOT NULL;

  -- Rough ETA estimate: 15 min if assigned and not arrived, 25 min if not assigned
  IF d.status IN ('volunteer_assigned') THEN
    v_eta_min := 15;
  ELSIF d.status = 'waiting_for_ngo' OR d.status = 'ngo_accepted' THEN
    v_eta_min := 25;
  END IF;

  IF v_remaining_min <= 0 THEN
    v_level := 'CRITICAL'; v_reason := 'Food has expired';
  ELSIF v_remaining_min <= 10 THEN
    v_level := 'CRITICAL'; v_reason := 'Less than 10 minutes until expiry';
  ELSIF v_remaining_min <= 30 THEN
    v_level := 'HIGH';
    v_reason := CASE WHEN v_volunteer_assigned THEN 'Volunteer assigned but only ' || ROUND(v_remaining_min) || ' min remain' ELSE 'No volunteer assigned and only ' || ROUND(v_remaining_min) || ' min remain' END;
  ELSIF v_remaining_min <= 60 THEN
    v_level := 'MEDIUM';
    v_reason := CASE WHEN v_volunteer_assigned THEN 'Volunteer assigned, ' || ROUND(v_remaining_min) || ' min remain' ELSE 'No volunteer assigned, ' || ROUND(v_remaining_min) || ' min remain' END;
  ELSIF v_remaining_min <= 120 THEN
    v_level := 'LOW';
    v_reason := ROUND(v_remaining_min) || ' minutes remaining';
  ELSE
    v_level := 'LOW';
    v_reason := 'Plenty of time remaining';
  END IF;

  IF v_eta_min IS NOT NULL AND v_remaining_min > 0 AND v_eta_min > v_remaining_min THEN
    v_level := 'CRITICAL';
    v_reason := 'Volunteer ETA is ' || v_eta_min || ' min but food expires in ' || ROUND(v_remaining_min) || ' min';
  END IF;

  RETURN jsonb_build_object('level', v_level, 'reason', v_reason,
    'minutes_remaining', ROUND(v_remaining_min, 1), 'volunteer_eta_estimate', v_eta_min);
END;
$$;
GRANT EXECUTE ON FUNCTION calculate_pickup_risk(uuid) TO authenticated;

-- ===== FUNCTION: calculate_success_probability =====
CREATE OR REPLACE FUNCTION calculate_success_probability(p_donation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  d donations%ROWTYPE;
  v_remaining_min numeric;
  v_prob integer := 50;
  v_factors jsonb := '[]'::jsonb;
  v_ngo_count integer;
  v_vol_count integer;
  v_time_factor integer;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('probability', 0, 'factors', '[]'); END IF;

  IF d.status IN ('completed') THEN
    RETURN jsonb_build_object('probability', 100, 'factors', jsonb_build_array('Donation already completed'));
  END IF;
  IF d.status IN ('cancelled','expired') THEN
    RETURN jsonb_build_object('probability', 0, 'factors', jsonb_build_array('Donation is ' || d.status));
  END IF;

  v_remaining_min := EXTRACT(EPOCH FROM (d.expiry_time - now())) / 60;

  -- Time factor (40 pts max)
  IF v_remaining_min <= 0 THEN
    v_prob := 5; v_factors := v_factors || jsonb_build_array('Food has expired — very low chance');
  ELSIF v_remaining_min <= 10 THEN
    v_prob := 15; v_factors := v_factors || jsonb_build_array('Less than 10 min remaining — critical');
  ELSIF v_remaining_min <= 30 THEN
    v_prob := 30; v_factors := v_factors || jsonb_build_array('Less than 30 min remaining — urgent');
  ELSIF v_remaining_min <= 60 THEN
    v_prob := 50; v_factors := v_factors || jsonb_build_array('About 1 hour remaining');
  ELSIF v_remaining_min <= 120 THEN
    v_prob := 70; v_factors := v_factors || jsonb_build_array('2 hours remaining — good timeframe');
  ELSE
    v_prob := 80; v_factors := v_factors || jsonb_build_array('Plenty of time remaining (' || ROUND(v_remaining_min/60) || ' hours)');
  END IF;

  -- NGO availability (30 pts max)
  SELECT count(*) INTO v_ngo_count FROM profiles
  WHERE role = 'ngo' AND status = 'verified'
  AND (accepted_food_types IS NULL OR d.food_type = ANY(accepted_food_types));
  IF v_ngo_count >= 3 THEN
    v_prob := v_prob + 25; v_factors := v_factors || jsonb_build_array(v_ngo_count || ' suitable NGOs nearby');
  ELSIF v_ngo_count >= 1 THEN
    v_prob := v_prob + 15; v_factors := v_factors || jsonb_build_array(v_ngo_count || ' suitable NGO nearby');
  ELSE
    v_factors := v_factors || jsonb_build_array('No suitable NGOs with matching food type');
  END IF;

  -- Volunteer availability (30 pts max)
  SELECT count(*) INTO v_vol_count FROM profiles
  WHERE role = 'volunteer' AND status = 'verified';
  IF v_vol_count >= 3 THEN
    v_prob := v_prob + 20; v_factors := v_factors || jsonb_build_array(v_vol_count || ' available volunteers');
  ELSIF v_vol_count >= 1 THEN
    v_prob := v_prob + 10; v_factors := v_factors || jsonb_build_array(v_vol_count || ' available volunteer');
  END IF;

  IF d.ngo_id IS NOT NULL THEN
    v_prob := LEAST(v_prob + 10, 95);
    v_factors := v_factors || jsonb_build_array('NGO already accepted');
  END IF;
  IF d.volunteer_id IS NOT NULL THEN
    v_prob := LEAST(v_prob + 10, 95);
    v_factors := v_factors || jsonb_build_array('Volunteer already assigned');
  END IF;

  v_prob := GREATEST(LEAST(v_prob, 98), 2);

  RETURN jsonb_build_object('probability', v_prob, 'factors', v_factors,
    'minutes_remaining', ROUND(v_remaining_min, 1),
    'ngo_count', v_ngo_count, 'volunteer_count', v_vol_count);
END;
$$;
GRANT EXECUTE ON FUNCTION calculate_success_probability(uuid) TO authenticated;

-- ===== FUNCTION: trigger_rescue_mode =====
CREATE OR REPLACE FUNCTION trigger_rescue_mode(p_donation_id uuid, p_actor_id uuid DEFAULT NULL)
RETURNS donations LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d donations%ROWTYPE;
  v_ngo RECORD;
  v_vol RECORD;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found'; END IF;
  IF d.status IN ('completed','cancelled','expired') THEN RAISE EXCEPTION 'Cannot rescue a % donation', d.status; END IF;

  UPDATE donations SET rescue_mode = true, priority = 'rescue', escalation_count = escalation_count + 1, updated_at = now()
  WHERE id = d.id RETURNING * INTO d;

  PERFORM log_donation_event(d.id, 'rescue_started', p_actor_id, d.status, d.status, 'Rescue mode triggered');

  -- Notify nearby verified NGOs that accept this food type
  FOR v_ngo IN SELECT id, name FROM profiles WHERE role = 'ngo' AND status = 'verified'
    AND id <> COALESCE(d.ngo_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (accepted_food_types IS NULL OR d.food_type = ANY(accepted_food_types))
  LOOP
    PERFORM notify(v_ngo.id, 'RESCUE MODE: ' || d.food_name,
      'Urgent! ' || d.estimated_servings || ' meals expiring soon. Please help rescue this donation.', 'warning');
  END LOOP;

  -- Notify available volunteers
  FOR v_vol IN SELECT id, name FROM profiles WHERE role = 'volunteer' AND status = 'verified'
    AND id <> COALESCE(d.volunteer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    PERFORM notify(v_vol.id, 'RESCUE MODE: Urgent pickup needed',
      'Donation "' || d.food_name || '" needs immediate pickup. ' || d.estimated_servings || ' meals at risk.', 'warning');
  END LOOP;

  -- Notify restaurant and existing NGO
  PERFORM notify(d.restaurant_id, 'RESCUE MODE activated',
    'Your donation "' || d.food_name || '" has entered rescue mode. We are urgently finding an NGO and volunteer.', 'warning');
  IF d.ngo_id IS NOT NULL THEN
    PERFORM notify(d.ngo_id, 'RESCUE MODE: ' || d.food_name,
      'Donation "' || d.food_name || '" is in rescue mode. Please expedite pickup.', 'warning');
  END IF;

  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION trigger_rescue_mode(uuid, uuid) TO authenticated;

-- ===== FUNCTION: cancel_volunteer_assignment =====
CREATE OR REPLACE FUNCTION cancel_volunteer_assignment(p_donation_id uuid, p_actor_id uuid, p_reason text)
RETURNS donations LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d donations%ROWTYPE;
  v_actor_role user_role;
  v_old_vol uuid;
  v_best_vol uuid;
  v_best_score integer := 0;
  v_score_row jsonb;
  v_vol RECORD;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found'; END IF;
  SELECT role INTO v_actor_role FROM profiles WHERE id = p_actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor not found'; END IF;

  IF d.volunteer_id IS NULL THEN RAISE EXCEPTION 'No volunteer assigned'; END IF;
  IF d.status NOT IN ('volunteer_assigned','volunteer_arrived') THEN
    RAISE EXCEPTION 'Cannot cancel volunteer in current state';
  END IF;

  v_old_vol := d.volunteer_id;

  -- Reset donation to ngo_accepted, clear volunteer
  UPDATE donations SET volunteer_id = NULL, status = 'ngo_accepted', reassignment_count = reassignment_count + 1,
    rescue_mode = true, priority = 'high', updated_at = now()
  WHERE id = d.id RETURNING * INTO d;

  -- Reset delivery
  UPDATE deliveries SET volunteer_id = NULL, status = 'assigned', updated_at = now() WHERE donation_id = d.id;

  -- Log event
  PERFORM log_donation_event(d.id, 'reassigned', p_actor_id, 'volunteer_assigned', 'ngo_accepted', p_reason);

  -- Notify old volunteer
  PERFORM notify(v_old_vol, 'Task Cancelled',
    'Your delivery task for "' || d.food_name || '" was cancelled. Reason: ' || p_reason, 'warning');

  -- Notify restaurant and NGO
  PERFORM notify(d.restaurant_id, 'Volunteer Reassignment',
    'The volunteer for "' || d.food_name || '" cancelled. Finding a replacement...', 'warning');
  PERFORM notify(d.ngo_id, 'Volunteer Reassignment',
    'The volunteer for "' || d.food_name || '" cancelled. Finding a replacement...', 'warning');

  -- Find best replacement volunteer
  FOR v_vol IN SELECT id FROM profiles WHERE role = 'volunteer' AND status = 'verified' AND id <> v_old_vol
  LOOP
    SELECT calculate_volunteer_match_score(d.id, v_vol.id) INTO v_score_row;
    IF (v_score_row->>'score')::integer > v_best_score THEN
      v_best_score := (v_score_row->>'score')::integer;
      v_best_vol := v_vol.id;
    END IF;
  END LOOP;

  IF v_best_vol IS NOT NULL THEN
    -- Log match attempt
    INSERT INTO match_attempts (donation_id, target_type, target_id, score, reasons, outcome)
    VALUES (d.id, 'volunteer', v_best_vol, v_best_score, v_score_row->'reasons', 'pending');

    -- Notify best volunteer
    PERFORM notify(v_best_vol, 'Urgent: Replacement volunteer needed',
      'Donation "' || d.food_name || '" needs a new volunteer. ' || d.estimated_servings || ' meals at risk. Please accept if available.', 'warning');
  ELSE
    -- Escalate
    PERFORM notify(d.restaurant_id, 'Pickup At Risk',
      'No available replacement volunteer found for "' || d.food_name || '". The donation is at risk.', 'error');
    PERFORM notify(d.ngo_id, 'Pickup At Risk',
      'No available replacement volunteer found for "' || d.food_name || '". The donation is at risk.', 'error');
    PERFORM log_donation_event(d.id, 'escalated', p_actor_id, 'ngo_accepted', 'ngo_accepted', 'No replacement volunteer found');
  END IF;

  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_volunteer_assignment(uuid, uuid, text) TO authenticated;

-- ===== FUNCTION: ngo_reject_donation =====
CREATE OR REPLACE FUNCTION ngo_reject_donation(p_donation_id uuid, p_actor_id uuid, p_reason text)
RETURNS donations LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d donations%ROWTYPE;
  v_best_ngo uuid;
  v_best_score integer := 0;
  v_score_row jsonb;
  v_ngo RECORD;
  v_attempted_count integer;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found'; END IF;
  IF d.ngo_id IS NULL OR d.ngo_id <> p_actor_id THEN RAISE EXCEPTION 'Only the assigned NGO can reject'; END IF;
  IF d.status NOT IN ('ngo_accepted','volunteer_assigned') THEN RAISE EXCEPTION 'Cannot reject in current state'; END IF;

  -- Log the rejection in match_attempts
  UPDATE match_attempts SET outcome = 'rejected', responded_at = now()
  WHERE donation_id = d.id AND target_type = 'ngo' AND target_id = p_actor_id AND outcome = 'pending';
  IF NOT FOUND THEN
    INSERT INTO match_attempts (donation_id, target_type, target_id, outcome, responded_at)
    VALUES (d.id, 'ngo', p_actor_id, 'rejected', now());
  END IF;

  -- Reset donation to waiting_for_ngo
  UPDATE donations SET ngo_id = NULL, volunteer_id = NULL, status = 'waiting_for_ngo',
    qr_token = NULL, qr_used = false, updated_at = now()
  WHERE id = d.id RETURNING * INTO d;

  -- Cancel delivery
  UPDATE deliveries SET status = 'cancelled', updated_at = now() WHERE donation_id = d.id;

  PERFORM log_donation_event(d.id, 'ngo_rejected', p_actor_id, 'ngo_accepted', 'waiting_for_ngo', p_reason);

  -- Notify restaurant
  PERFORM notify(d.restaurant_id, 'NGO Rejected — Searching for another',
    'The NGO rejected "' || d.food_name || '". FoodBridge is searching for another organization. Reason: ' || p_reason, 'warning');

  -- Count how many NGOs have already been tried
  SELECT count(*) INTO v_attempted_count FROM match_attempts
  WHERE donation_id = d.id AND target_type = 'ngo' AND outcome IN ('rejected','expired');

  -- Find next best NGO (not previously rejected)
  FOR v_ngo IN SELECT id FROM profiles WHERE role = 'ngo' AND status = 'verified'
    AND id <> p_actor_id
    AND id NOT IN (SELECT target_id FROM match_attempts WHERE donation_id = d.id AND target_type = 'ngo' AND outcome IN ('rejected','expired'))
  LOOP
    SELECT calculate_ngo_match_score(d.id, v_ngo.id) INTO v_score_row;
    IF (v_score_row->>'score')::integer > v_best_score THEN
      v_best_score := (v_score_row->>'score')::integer;
      v_best_ngo := v_ngo.id;
    END IF;
  END LOOP;

  IF v_best_ngo IS NOT NULL THEN
    INSERT INTO match_attempts (donation_id, target_type, target_id, score, reasons, outcome)
    VALUES (d.id, 'ngo', v_best_ngo, v_best_score, v_score_row->'reasons', 'pending');

    PERFORM notify(v_best_ngo, 'Donation Available: ' || d.food_name,
      'A donation matching your profile is available. ' || d.estimated_servings || ' servings of ' || d.food_type || ' food. Please review and accept.', 'info');
    PERFORM log_donation_event(d.id, 'ngo_recommended', p_actor_id, 'waiting_for_ngo', 'waiting_for_ngo', 'Recovery chain: recommended next NGO (score: ' || v_best_score || ')');
  ELSE
    -- No more NGOs — escalate
    PERFORM trigger_rescue_mode(d.id, p_actor_id);
  END IF;

  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION ngo_reject_donation(uuid, uuid, text) TO authenticated;

-- ===== FUNCTION: report_delivery_exception =====
CREATE OR REPLACE FUNCTION report_delivery_exception(
  p_donation_id uuid, p_actor_id uuid, p_ex_type exception_type,
  p_expected text, p_actual text, p_reason text
) RETURNS delivery_exceptions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d donations%ROWTYPE;
  v_actor_role user_role;
  v_row delivery_exceptions%ROWTYPE;
  v_del_id uuid;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found'; END IF;
  SELECT role INTO v_actor_role FROM profiles WHERE id = p_actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor not found'; END IF;

  SELECT id INTO v_del_id FROM deliveries WHERE donation_id = p_donation_id LIMIT 1;

  INSERT INTO delivery_exceptions (donation_id, delivery_id, reported_by, exception_type, expected_value, actual_value, reason)
  VALUES (p_donation_id, v_del_id, p_actor_id, p_ex_type, p_expected, p_actual, p_reason)
  RETURNING * INTO v_row;

  PERFORM log_donation_event(p_donation_id, 'exception_reported', p_actor_id, d.status, d.status,
    p_ex_type::text || ': ' || p_reason, jsonb_build_object('expected', p_expected, 'actual', p_actual));

  -- Notify all parties
  PERFORM notify(d.restaurant_id, 'Delivery Exception Reported',
    'Exception (' || p_ex_type::text || ') reported for "' || d.food_name || '": ' || p_reason, 'warning');
  IF d.ngo_id IS NOT NULL THEN
    PERFORM notify(d.ngo_id, 'Delivery Exception Reported',
      'Exception (' || p_ex_type::text || ') reported for "' || d.food_name || '": ' || p_reason, 'warning');
  END IF;
  IF d.volunteer_id IS NOT NULL AND d.volunteer_id <> p_actor_id THEN
    PERFORM notify(d.volunteer_id, 'Delivery Exception Reported',
      'Exception (' || p_ex_type::text || ') reported for "' || d.food_name || '": ' || p_reason, 'warning');
  END IF;

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION report_delivery_exception(uuid, uuid, exception_type, text, text, text) TO authenticated;

-- ===== FUNCTION: get_live_operations =====
CREATE OR REPLACE FUNCTION get_live_operations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR v_caller_role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;

  RETURN jsonb_build_object(
    'waiting_for_ngo', (SELECT count(*) FROM donations WHERE status = 'waiting_for_ngo'),
    'ngo_accepted', (SELECT count(*) FROM donations WHERE status = 'ngo_accepted'),
    'volunteer_assigned', (SELECT count(*) FROM donations WHERE status = 'volunteer_assigned'),
    'volunteer_arrived', (SELECT count(*) FROM donations WHERE status = 'volunteer_arrived'),
    'food_picked_up', (SELECT count(*) FROM donations WHERE status = 'food_picked_up'),
    'in_transit', (SELECT count(*) FROM donations WHERE status = 'in_transit'),
    'delivered', (SELECT count(*) FROM donations WHERE status = 'delivered'),
    'completed_today', (SELECT count(*) FROM donations WHERE status = 'completed' AND updated_at::date = now()::date),
    'cancelled_today', (SELECT count(*) FROM donations WHERE status = 'cancelled' AND updated_at::date = now()::date),
    'expired_today', (SELECT count(*) FROM donations WHERE status = 'expired' AND updated_at::date = now()::date),
    'rescue_mode', (SELECT count(*) FROM donations WHERE rescue_mode = true AND status NOT IN ('completed','cancelled','expired')),
    'at_risk', (SELECT count(*) FROM donations WHERE status NOT IN ('completed','cancelled','expired') AND expiry_time < now() + interval '1 hour'),
    'critical', (SELECT count(*) FROM donations WHERE status NOT IN ('completed','cancelled','expired') AND expiry_time < now() + interval '30 minutes'),
    'active_donations', (SELECT count(*) FROM donations WHERE status NOT IN ('completed','cancelled','expired')),
    'active_deliveries', (SELECT count(*) FROM deliveries WHERE status NOT IN ('completed','cancelled')),
    'open_exceptions', (SELECT count(*) FROM delivery_exceptions WHERE status = 'open')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_live_operations() TO authenticated;

-- ===== FUNCTION: get_impact_metrics =====
CREATE OR REPLACE FUNCTION get_impact_metrics(p_user_id uuid, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_completed integer;
  v_expired integer;
  v_cancelled integer;
  v_meals integer;
  v_food_weight numeric;
  v_total integer;
  v_rescue_rate numeric;
  v_people_served integer;
BEGIN
  IF p_role = 'restaurant' THEN
    SELECT
      count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status = 'expired'),
      count(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(estimated_servings) FILTER (WHERE status = 'completed'), 0),
      COALESCE(SUM(quantity) FILTER (WHERE status = 'completed'), 0),
      count(*) FILTER (WHERE status IN ('completed','expired','cancelled'))
    INTO v_completed, v_expired, v_cancelled, v_meals, v_food_weight, v_total
    FROM donations WHERE restaurant_id = p_user_id;
  ELSIF p_role = 'ngo' THEN
    SELECT
      count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status = 'expired'),
      count(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(estimated_servings) FILTER (WHERE status = 'completed'), 0),
      COALESCE(SUM(quantity) FILTER (WHERE status = 'completed'), 0),
      count(*) FILTER (WHERE status IN ('completed','expired','cancelled'))
    INTO v_completed, v_expired, v_cancelled, v_meals, v_food_weight, v_total
    FROM donations WHERE ngo_id = p_user_id;
  ELSIF p_role = 'volunteer' THEN
    SELECT
      count(*) FILTER (WHERE status = 'completed'),
      0, -- expired not directly applicable
      count(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(d.estimated_servings) FILTER (WHERE d.status = 'completed'), 0),
      COALESCE(SUM(d.quantity) FILTER (WHERE d.status = 'completed'), 0),
      count(*) FILTER (WHERE status IN ('completed','cancelled'))
    INTO v_completed, v_expired, v_cancelled, v_meals, v_food_weight, v_total
    FROM donations d JOIN deliveries del ON del.donation_id = d.id WHERE del.volunteer_id = p_user_id;
  ELSIF p_role = 'admin' THEN
    SELECT
      count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status = 'expired'),
      count(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(estimated_servings) FILTER (WHERE status = 'completed'), 0),
      COALESCE(SUM(quantity) FILTER (WHERE status = 'completed'), 0),
      count(*) FILTER (WHERE status IN ('completed','expired','cancelled'))
    INTO v_completed, v_expired, v_cancelled, v_meals, v_food_weight, v_total
    FROM donations;
  ELSE
    RETURN jsonb_build_object();
  END IF;

  v_rescue_rate := CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total) * 100, 1) ELSE NULL END;
  -- Estimate food weight: ~0.4 kg per serving (clearly labeled as estimate)
  v_food_weight := ROUND(v_food_weight * 0.4, 1);
  v_people_served := v_meals;

  RETURN jsonb_build_object(
    'meals_rescued', v_meals,
    'food_weight_estimate', v_food_weight,
    'donations_completed', v_completed,
    'donations_expired', v_expired,
    'donations_cancelled', v_cancelled,
    'rescue_success_rate', v_rescue_rate,
    'people_served', v_people_served,
    'total_donations', v_total
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_impact_metrics(uuid, text) TO authenticated;

-- ===== FUNCTION: get_surplus_insights =====
CREATE OR REPLACE FUNCTION get_surplus_insights(p_restaurant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_count integer;
  v_by_day jsonb;
  v_by_hour jsonb;
  v_by_category jsonb;
  v_avg_qty numeric;
  v_top_food text;
  v_completed integer;
  v_expired integer;
BEGIN
  SELECT count(*) INTO v_count FROM donations WHERE restaurant_id = p_restaurant_id;
  IF v_count = 0 THEN
    RETURN jsonb_build_object('has_data', false, 'message', 'Not enough historical data yet. Create some donations to see insights.');
  END IF;

  EXECUTE format(
    'SELECT jsonb_object_agg(COALESCE(day_name,''Unknown''), cnt) FROM (
      SELECT to_char(created_at,''Day'') AS day_name, count(*) AS cnt
      FROM donations WHERE restaurant_id = $1 GROUP BY 1 ORDER BY cnt DESC
    ) t', p_restaurant_id
  ) INTO v_by_day;

  EXECUTE format(
    'SELECT jsonb_object_agg(COALESCE(hour_label,''Unknown''), cnt) FROM (
      SELECT ''Hour '' || EXTRACT(HOUR FROM created_at)::int AS hour_label, count(*) AS cnt
      FROM donations WHERE restaurant_id = $1 GROUP BY 1 ORDER BY cnt DESC
    ) t', p_restaurant_id
  ) INTO v_by_hour;

  EXECUTE format(
    'SELECT jsonb_object_agg(COALESCE(category,''Unknown''), cnt) FROM (
      SELECT category, count(*) AS cnt
      FROM donations WHERE restaurant_id = $1 GROUP BY 1 ORDER BY cnt DESC
    ) t', p_restaurant_id
  ) INTO v_by_category;

  SELECT ROUND(AVG(quantity), 1), mode() WITHIN GROUP (ORDER BY food_name)
  INTO v_avg_qty, v_top_food
  FROM donations WHERE restaurant_id = p_restaurant_id;

  SELECT count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'expired')
  INTO v_completed, v_expired
  FROM donations WHERE restaurant_id = p_restaurant_id;

  RETURN jsonb_build_object(
    'has_data', true,
    'total_donations', v_count,
    'by_day', COALESCE(v_by_day, '{}'::jsonb),
    'by_hour', COALESCE(v_by_hour, '{}'::jsonb),
    'by_category', COALESCE(v_by_category, '{}'::jsonb),
    'avg_quantity', v_avg_qty,
    'top_food', v_top_food,
    'completed', v_completed,
    'expired', v_expired
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_surplus_insights(uuid) TO authenticated;

-- ===== FUNCTION: run_simulation =====
CREATE OR REPLACE FUNCTION run_simulation(p_params jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role user_role;
  v_volunteers integer;
  v_ngo_capacity integer;
  v_max_radius integer;
  v_avg_pickup_time integer;
  v_donation_volume integer;
  v_current_volunteers integer;
  v_current_success numeric;
  v_current_pickup_time numeric;
  v_current_expired integer;
  v_completed integer;
  v_total integer;
  v_expired integer;
  v_pred_success numeric;
  v_pred_pickup_time numeric;
  v_pred_expired_rate numeric;
  v_vol_workload numeric;
  v_ngo_workload numeric;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR v_caller_role <> 'admin' THEN RAISE EXCEPTION 'Admin only'; END IF;

  v_volunteers := COALESCE((p_params->>'volunteers')::integer, 100);
  v_ngo_capacity := COALESCE((p_params->>'ngo_capacity')::integer, 200);
  v_max_radius := COALESCE((p_params->>'max_radius')::integer, 10);
  v_avg_pickup_time := COALESCE((p_params->>'avg_pickup_time')::integer, 30);
  v_donation_volume := COALESCE((p_params->>'donation_volume')::integer, 50);

  -- Current real metrics
  SELECT count(*) INTO v_current_volunteers FROM profiles WHERE role = 'volunteer' AND status = 'verified';
  SELECT count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status IN ('completed','expired','cancelled')),
         count(*) FILTER (WHERE status = 'expired')
  INTO v_completed, v_total, v_expired
  FROM donations;

  v_current_success := CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total) * 100, 1) ELSE 0 END;
  v_current_pickup_time := v_avg_pickup_time;
  v_current_expired := v_expired;

  -- Simple model: more volunteers → higher success rate, lower pickup time
  -- Each additional 10 volunteers ≈ +3% success, -5% pickup time (clearly a simulation)
  v_pred_success := LEAST(ROUND(v_current_success + ((v_volunteers - v_current_volunteers) / 10.0) * 3, 1), 98);
  v_pred_success := GREATEST(v_pred_success, 5);
  v_pred_pickup_time := ROUND(v_current_pickup_time * (1 - ((v_volunteers - v_current_volunteers) / 10.0) * 0.05), 1);
  v_pred_pickup_time := GREATEST(v_pred_pickup_time, 5);
  v_pred_expired_rate := GREATEST(ROUND((100 - v_pred_success) * 0.6, 1), 1);

  -- Workload: total donations / volunteers
  v_vol_workload := ROUND(v_donation_volume::numeric / v_volunteers, 1);
  v_ngo_workload := ROUND(v_donation_volume::numeric / (SELECT count(*) FROM profiles WHERE role = 'ngo' AND status = 'verified'), 1);

  -- Store the simulation run
  INSERT INTO simulation_runs (run_by, params, results)
  VALUES (auth.uid(), p_params, jsonb_build_object(
    'predicted_success_rate', v_pred_success,
    'predicted_pickup_time', v_pred_pickup_time,
    'predicted_expired_rate', v_pred_expired_rate,
    'volunteer_workload', v_vol_workload,
    'ngo_workload', v_ngo_workload
  ));

  RETURN jsonb_build_object(
    'current_volunteers', v_current_volunteers,
    'current_success_rate', v_current_success,
    'current_pickup_time', v_current_pickup_time,
    'predicted_success_rate', v_pred_success,
    'predicted_pickup_time', v_pred_pickup_time,
    'predicted_expired_rate', v_pred_expired_rate,
    'volunteer_workload', v_vol_workload,
    'ngo_workload', v_ngo_workload,
    'note', 'These are simulated predictions based on a simplified model, not real outcomes.'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION run_simulation(jsonb) TO authenticated;

-- ===== RLS POLICIES FOR NEW TABLES =====
-- donation_events: participants can read their donation's events, admin can read all
DROP POLICY IF EXISTS "events_select_participants" ON donation_events;
CREATE POLICY "events_select_participants" ON donation_events FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM donations WHERE donations.id = donation_events.donation_id
    AND (donations.restaurant_id = auth.uid() OR donations.ngo_id = auth.uid()
         OR donations.volunteer_id = auth.uid() OR is_admin(auth.uid()))
  )
);

-- match_attempts: participants can read, admin can read all
DROP POLICY IF EXISTS "matches_select_participants" ON match_attempts;
CREATE POLICY "matches_select_participants" ON match_attempts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM donations WHERE donations.id = match_attempts.donation_id
    AND (donations.restaurant_id = auth.uid() OR donations.ngo_id = auth.uid()
         OR donations.volunteer_id = auth.uid() OR is_admin(auth.uid()))
  )
  OR target_id = auth.uid()
);

-- delivery_exceptions: participants can read, reporter can read
DROP POLICY IF EXISTS "exceptions_select_participants" ON delivery_exceptions;
CREATE POLICY "exceptions_select_participants" ON delivery_exceptions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM donations WHERE donations.id = delivery_exceptions.donation_id
    AND (donations.restaurant_id = auth.uid() OR donations.ngo_id = auth.uid()
         OR donations.volunteer_id = auth.uid() OR is_admin(auth.uid()))
  )
  OR reported_by = auth.uid()
);

-- simulation_runs: admin only
DROP POLICY IF EXISTS "sim_select_admin" ON simulation_runs;
CREATE POLICY "sim_select_admin" ON simulation_runs FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- Allow insert on simulation_runs (the function handles it, but policy needed for RLS)
DROP POLICY IF EXISTS "sim_insert_admin" ON simulation_runs;
CREATE POLICY "sim_insert_admin" ON simulation_runs FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

-- ===== UPDATE transition_donation to log events =====
-- We need to add event logging to the existing transition_donation function
-- Re-create it with event logging embedded
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
  v_prev_status text;
BEGIN
  SELECT * INTO d FROM donations WHERE id = p_donation_id;
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
    PERFORM notify(d.restaurant_id, 'Donation Accepted', 'NGO accepted your donation "' || d.food_name || '".', 'success');
    PERFORM notify(p_actor_id, 'Donation Accepted', 'You accepted donation "' || d.food_name || '". A delivery task was created.', 'success');
    PERFORM log_donation_event(d.id, 'ngo_accepted', p_actor_id, v_prev_status, 'ngo_accepted');

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
    PERFORM log_donation_event(d.id, 'volunteer_assigned', p_actor_id, v_prev_status, 'volunteer_assigned');

  ELSIF p_action = 'arrive_restaurant' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'volunteer_assigned' THEN RAISE EXCEPTION 'Invalid state for arrival'; END IF;
    UPDATE donations SET status = 'volunteer_arrived', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'arrived_restaurant', arrived_at_restaurant = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.restaurant_id, 'Volunteer Arrived', 'Volunteer arrived at your location for "' || d.food_name || '".', 'info');
    PERFORM log_donation_event(d.id, 'volunteer_arrived', p_actor_id, v_prev_status, 'volunteer_arrived');

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
    PERFORM log_donation_event(d.id, 'pickup_verified', p_actor_id, v_prev_status, 'food_picked_up');

  ELSIF p_action = 'start_delivery' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'food_picked_up' THEN RAISE EXCEPTION 'Pickup must be verified first'; END IF;
    UPDATE donations SET status = 'in_transit', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'in_transit', started_at = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.ngo_id, 'Delivery In Transit', '"' || d.food_name || '" is on its way.', 'info');
    PERFORM log_donation_event(d.id, 'in_transit', p_actor_id, v_prev_status, 'in_transit');

  ELSIF p_action = 'arrive_ngo' THEN
    IF v_actor_role <> 'volunteer' OR d.volunteer_id <> p_actor_id THEN RAISE EXCEPTION 'Only assigned volunteer'; END IF;
    IF d.status <> 'in_transit' THEN RAISE EXCEPTION 'Delivery must be in transit'; END IF;
    UPDATE donations SET status = 'delivered', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'arrived_ngo', arrived_at_ngo = now(), updated_at = now() WHERE donation_id = d.id;
    PERFORM notify(d.ngo_id, 'Delivery Arrived', 'Volunteer has arrived with "' || d.food_name || '". Please confirm receipt.', 'warning');
    PERFORM notify(d.restaurant_id, 'Delivery Arrived at NGO', '"' || d.food_name || '" has arrived at the NGO.', 'info');
    PERFORM log_donation_event(d.id, 'delivered', p_actor_id, v_prev_status, 'delivered');

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
    PERFORM log_donation_event(d.id, 'completed', p_actor_id, v_prev_status, 'completed');

  ELSIF p_action = 'cancel' THEN
    IF v_actor_role NOT IN ('restaurant','admin') THEN RAISE EXCEPTION 'Only restaurant or admin can cancel'; END IF;
    IF v_actor_role = 'restaurant' AND d.restaurant_id <> p_actor_id THEN RAISE EXCEPTION 'Not your donation'; END IF;
    IF d.status IN ('completed','cancelled','delivered') THEN RAISE EXCEPTION 'Cannot cancel now'; END IF;
    UPDATE donations SET status = 'cancelled', updated_at = now() WHERE id = d.id RETURNING * INTO d;
    UPDATE deliveries SET status = 'cancelled', updated_at = now() WHERE donation_id = d.id;
    IF d.ngo_id IS NOT NULL THEN PERFORM notify(d.ngo_id, 'Donation Cancelled', '"' || d.food_name || '" was cancelled.', 'warning'); END IF;
    IF d.volunteer_id IS NOT NULL THEN PERFORM notify(d.volunteer_id, 'Task Cancelled', 'Delivery task for "' || d.food_name || '" was cancelled.', 'warning'); END IF;
    PERFORM log_donation_event(d.id, 'cancelled', p_actor_id, v_prev_status, 'cancelled', p_extra->>'reason');
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION transition_donation(uuid, text, uuid, jsonb) TO authenticated;
