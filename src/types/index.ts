export type Role = 'restaurant' | 'ngo' | 'volunteer' | 'admin';
export type UserStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type VolunteerStatus = 'available' | 'offline' | 'busy';
export type DonationStatus =
  | 'created'
  | 'waiting_for_ngo'
  | 'ngo_accepted'
  | 'volunteer_assigned'
  | 'volunteer_arrived'
  | 'food_picked_up'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired';
export type DeliveryStatus =
  | 'assigned'
  | 'accepted'
  | 'arrived_restaurant'
  | 'food_picked_up'
  | 'in_transit'
  | 'arrived_ngo'
  | 'completed'
  | 'cancelled';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Profile {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  name: string;
  phone: string;
  address: string;
  owner_name: string | null;
  operating_hours: string | null;
  organization_name: string | null;
  registration_number: string | null;
  contact_person: string | null;
  service_area: string | null;
  meal_capacity: number | null;
  storage_capacity: string | null;
  refrigeration_available: boolean | null;
  accepted_food_types: string[] | null;
  vehicle_type: string | null;
  availability: string | null;
  volunteer_status: VolunteerStatus | null;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  restaurant_id: string;
  ngo_id: string | null;
  volunteer_id: string | null;
  food_name: string;
  category: string;
  food_type: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimated_servings: number;
  preparation_time: string;
  expiry_time: string;
  packaging: string | null;
  allergens: string | null;
  storage_requirements: string | null;
  food_condition: string | null;
  image: string | null;
  pickup_address: string;
  pickup_date: string;
  pickup_start_time: string;
  pickup_deadline: string;
  contact_person: string;
  contact_number: string;
  pickup_instructions: string | null;
  safety_confirmed: boolean;
  qr_token: string | null;
  qr_used: boolean;
  status: DonationStatus;
  priority?: DonationPriority;
  rescue_mode?: boolean;
  escalation_count?: number;
  reassignment_count?: number;
  expiry_notified_at?: string | null;
  received_quantity: number | null;
  receipt_notes: string | null;
  created_at: string;
  updated_at: string;
  restaurant?: Profile;
  ngo?: Profile | null;
  volunteer?: Profile | null;
}

export interface Delivery {
  id: string;
  donation_id: string;
  restaurant_id: string;
  ngo_id: string;
  volunteer_id: string | null;
  pickup_address: string;
  drop_address: string;
  quantity: number;
  status: DeliveryStatus;
  arrived_at_restaurant: string | null;
  picked_up_at: string | null;
  started_at: string | null;
  arrived_at_ngo: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  donation?: Donation;
  restaurant?: Profile;
  ngo?: Profile;
  volunteer?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export type DonationPriority = 'normal' | 'medium' | 'high' | 'critical' | 'rescue';
export type EventType =
  | 'created' | 'ngo_recommended' | 'ngo_accepted' | 'ngo_rejected'
  | 'volunteer_recommended' | 'volunteer_assigned' | 'volunteer_arrived'
  | 'pickup_verified' | 'in_transit' | 'delivered' | 'completed'
  | 'cancelled' | 'expired' | 'escalated' | 'rescue_started'
  | 'reassigned' | 'exception_reported';
export type MatchTargetType = 'ngo' | 'volunteer';
export type MatchOutcome = 'pending' | 'accepted' | 'rejected' | 'expired' | 'reassigned';
export type ExceptionType =
  | 'restaurant_unavailable' | 'ngo_unavailable' | 'quantity_mismatch'
  | 'food_condition' | 'vehicle_problem' | 'route_problem'
  | 'pickup_delayed' | 'other';
export type ExceptionStatus = 'open' | 'acknowledged' | 'resolved';

export interface DonationEvent {
  id: string;
  donation_id: string;
  event_type: EventType;
  actor_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface MatchAttempt {
  id: string;
  donation_id: string;
  target_type: MatchTargetType;
  target_id: string;
  score: number | null;
  reasons: string[] | null;
  outcome: MatchOutcome;
  attempted_at: string;
  responded_at: string | null;
}

export interface DeliveryException {
  id: string;
  donation_id: string;
  delivery_id: string | null;
  reported_by: string;
  exception_type: ExceptionType;
  expected_value: string | null;
  actual_value: string | null;
  reason: string;
  status: ExceptionStatus;
  created_at: string;
  updated_at: string;
}

export interface SimulationRun {
  id: string;
  run_by: string;
  params: Record<string, any>;
  results: Record<string, any>;
  created_at: string;
}

export interface ReliabilityScore {
  score: number | null;
  label: string;
  total_deliveries: number;
  completed: number;
  cancelled: number;
  no_show: number;
  on_time_pickups: number;
  on_time_rate: number | null;
  completion_rate: number | null;
  cancel_rate: number | null;
  avg_response_minutes: number | null;
}

export interface MatchScore {
  score: number;
  reasons: string[];
  workload?: number;
  reliability?: ReliabilityScore;
}

export interface PriorityInfo {
  level: string;
  label: string;
  color: string;
  icon: string;
}

export interface PickupRisk {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  minutes_remaining: number;
  volunteer_eta_estimate: number | null;
}

export interface SuccessProbability {
  probability: number;
  factors: string[];
  minutes_remaining: number;
  ngo_count: number;
  volunteer_count: number;
}

export interface LiveOperations {
  waiting_for_ngo: number;
  ngo_accepted: number;
  volunteer_assigned: number;
  volunteer_arrived: number;
  food_picked_up: number;
  in_transit: number;
  delivered: number;
  completed_today: number;
  cancelled_today: number;
  expired_today: number;
  rescue_mode: number;
  at_risk: number;
  critical: number;
  active_donations: number;
  active_deliveries: number;
  open_exceptions: number;
}

export interface ImpactMetrics {
  meals_rescued: number;
  food_weight_estimate: number;
  donations_completed: number;
  donations_expired: number;
  donations_cancelled: number;
  rescue_success_rate: number | null;
  people_served: number;
  total_donations: number;
}

export interface SurplusInsights {
  has_data: boolean;
  message?: string;
  total_donations?: number;
  by_day?: Record<string, number>;
  by_hour?: Record<string, number>;
  by_category?: Record<string, number>;
  avg_quantity?: number;
  top_food?: string;
  completed?: number;
  expired?: number;
}

export interface SimulationResults {
  current_volunteers: number;
  current_success_rate: number;
  current_pickup_time: number;
  predicted_success_rate: number;
  predicted_pickup_time: number;
  predicted_expired_rate: number;
  volunteer_workload: number;
  ngo_workload: number;
  note: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
}
