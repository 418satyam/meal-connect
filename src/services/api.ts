import { supabase } from '@/lib/supabase';
import { locationMatch } from '@/utils/helpers';
import type {
  Donation, Delivery, Notification, Profile, Role, DonationEvent, MatchAttempt,
  DeliveryException, ReliabilityScore, MatchScore, PickupRisk, SuccessProbability,
  LiveOperations, ImpactMetrics, SurplusInsights, SimulationResults, SimulationRun,
} from '@/types';

// ---------- AUTH ----------
export async function register(
  email: string,
  password: string,
  role: Role,
  data: Record<string, any>
): Promise<{ id: string; email: string; role: Role }> {
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  if (!['restaurant', 'ngo', 'volunteer'].includes(role)) throw new Error('Invalid role');

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Registration failed');

  const { data: profile, error: rpcError } = await supabase.rpc('register_profile', {
    p_role: role,
    p_data: data,
  });
  if (rpcError) {
    // Clean up the orphan auth user is not possible from client; surface error.
    throw new Error(rpcError.message);
  }
  return { id: authData.user.id, email, role };
}

export async function login(email: string, password: string): Promise<Profile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Invalid email or password');
  const { data: profile, error: perr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();
  if (perr || !profile) throw new Error('Profile not found');
  if (profile.status === 'suspended') throw new Error('Your account has been suspended');
  return profile as Profile;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

// ---------- DONATIONS ----------
const donationSelect = `*,
  restaurant:profiles!donations_restaurant_id_fkey(*),
  ngo:profiles!donations_ngo_id_fkey(*),
  volunteer:profiles!donations_volunteer_id_fkey(*)`;

export async function createDonation(
  payload: Record<string, any>
): Promise<Donation> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('donations')
    .insert({
      ...payload,
      restaurant_id: u.user.id,
      safety_confirmed: true,
      status: 'waiting_for_ngo',
    })
    .select(donationSelect)
    .single();
  if (error) throw new Error(error.message);
  return data as Donation;
}

export async function fetchDonations(opts: { mine?: boolean } = {}): Promise<Donation[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  let q = supabase.from('donations').select(donationSelect).order('created_at', { ascending: false });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', u.user.id).single();
  if (profile?.role === 'restaurant') {
    q = q.eq('restaurant_id', u.user.id);
  } else if (profile?.role === 'ngo') {
    if (opts.mine) q = q.eq('ngo_id', u.user.id);
    else q = q.or(`ngo_id.eq.${u.user.id},status.eq.waiting_for_ngo`);
  } else if (profile?.role === 'volunteer') {
    q = q.or(`volunteer_id.eq.${u.user.id},status.eq.ngo_accepted`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as Donation[];
}

export async function fetchDonation(id: string): Promise<Donation | null> {
  const { data, error } = await supabase
    .from('donations')
    .select(donationSelect)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Donation | null;
}

async function transition(donationId: string, action: string, extra: Record<string, any> = {}): Promise<Donation> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('transition_donation', {
    p_donation_id: donationId,
    p_action: action,
    p_actor_id: u.user.id,
    p_extra: extra,
  });
  if (error) throw new Error(error.message);
  return data as Donation;
}

export async function acceptDonation(donationId: string): Promise<Donation> {
  return transition(donationId, 'accept_ngo');
}
export async function cancelDonation(donationId: string): Promise<Donation> {
  return transition(donationId, 'cancel');
}
export async function assignVolunteer(donationId: string): Promise<Donation> {
  return transition(donationId, 'assign_volunteer');
}
export async function arriveAtRestaurant(donationId: string): Promise<Donation> {
  return transition(donationId, 'arrive_restaurant');
}
export async function verifyPickup(donationId: string, qrToken: string): Promise<Donation> {
  return transition(donationId, 'verify_pickup', { qr_token: qrToken });
}
export async function startDelivery(donationId: string): Promise<Donation> {
  return transition(donationId, 'start_delivery');
}
export async function arriveAtNgo(donationId: string): Promise<Donation> {
  return transition(donationId, 'arrive_ngo');
}
export async function confirmReceipt(
  donationId: string,
  receivedQuantity?: number,
  notes?: string
): Promise<Donation> {
  return transition(donationId, 'confirm_receipt', {
    received_quantity: receivedQuantity?.toString() || '',
    notes: notes || '',
  });
}

// ---------- DELIVERIES ----------
const deliverySelect = `*,
  donation:donations(*),
  restaurant:profiles!deliveries_restaurant_id_fkey(*),
  ngo:profiles!deliveries_ngo_id_fkey(*),
  volunteer:profiles!deliveries_volunteer_id_fkey(*)`;

export async function fetchDeliveries(opts: { mine?: boolean } = {}): Promise<Delivery[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  let q = supabase.from('deliveries').select(deliverySelect).order('created_at', { ascending: false });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', u.user.id).single();
  if (profile?.role === 'restaurant') q = q.eq('restaurant_id', u.user.id);
  else if (profile?.role === 'ngo') q = q.eq('ngo_id', u.user.id);
  else if (profile?.role === 'volunteer') {
    if (opts.mine) q = q.eq('volunteer_id', u.user.id);
    else q = q.or(`volunteer_id.eq.${u.user.id},status.eq.assigned`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as Delivery[];
}

export async function fetchAvailableDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(deliverySelect)
    .eq('status', 'assigned')
    .is('volunteer_id', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Delivery[];
}

export async function fetchAvailableDeliveriesForVolunteer(
  volArea: string | null,
  volAddress: string | null
): Promise<Delivery[]> {
  const all = await fetchAvailableDeliveries();
  return all.filter((d) =>
    locationMatch(volArea, volAddress, d.ngo?.service_area ?? null, d.ngo?.address ?? null)
  );
}

export async function fetchDelivery(id: string): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(deliverySelect)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Delivery | null;
}

// ---------- NOTIFICATIONS ----------
export async function fetchNotifications(): Promise<Notification[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', u.user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', u.user.id)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
}

// ---------- PROFILE ----------
export async function updateProfile(updates: Record<string, any>): Promise<Profile> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', u.user.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateVolunteerStatus(status: 'available' | 'offline' | 'busy'): Promise<void> {
  await updateProfile({ volunteer_status: status });
}

// ---------- ADMIN ----------
export async function adminDashboard() {
  const [users, donations, deliveries] = await Promise.all([
    supabase.from('profiles').select('role,status'),
    supabase.from('donations').select('status,quantity,estimated_servings'),
    supabase.from('deliveries').select('status'),
  ]);
  const u = users.data || [];
  const d = donations.data || [];
  const del = deliveries.data || [];
  const completed = d.filter((x: any) => x.status === 'completed');
  return {
    total_users: u.length,
    restaurants: u.filter((x: any) => x.role === 'restaurant').length,
    ngos: u.filter((x: any) => x.role === 'ngo').length,
    volunteers: u.filter((x: any) => x.role === 'volunteer').length,
    total_donations: d.length,
    active_donations: d.filter((x: any) => !['completed', 'cancelled', 'expired'].includes(x.status)).length,
    completed_donations: completed.length,
    active_deliveries: del.filter((x: any) => !['completed', 'cancelled'].includes(x.status)).length,
    food_rescued: completed.reduce((s: number, x: any) => s + Number(x.quantity), 0),
    meals_distributed: completed.reduce((s: number, x: any) => s + (x.estimated_servings || 0), 0),
  };
}

export async function adminFetchUsers(role?: string): Promise<Profile[]> {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (role) q = q.eq('role', role);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as Profile[];
}

export async function adminSetUserStatus(userId: string, status: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_set_user_status', {
    p_target: userId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function adminFetchDonations(): Promise<Donation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select(donationSelect)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Donation[];
}

export async function adminFetchDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(deliverySelect)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Delivery[];
}

// ---------- ADVANCED: MATCHING & SCORING ----------
export async function getNgoMatchScore(donationId: string, ngoId: string): Promise<MatchScore> {
  const { data, error } = await supabase.rpc('calculate_ngo_match_score', {
    p_donation_id: donationId, p_ngo_id: ngoId,
  });
  if (error) throw new Error(error.message);
  return data as MatchScore;
}

export async function getVolunteerMatchScore(donationId: string, volunteerId: string): Promise<MatchScore> {
  const { data, error } = await supabase.rpc('calculate_volunteer_match_score', {
    p_donation_id: donationId, p_volunteer_id: volunteerId,
  });
  if (error) throw new Error(error.message);
  return data as MatchScore;
}

export async function getVolunteerReliability(volunteerId: string): Promise<ReliabilityScore> {
  const { data, error } = await supabase.rpc('calculate_volunteer_reliability', {
    p_volunteer_id: volunteerId,
  });
  if (error) throw new Error(error.message);
  return data as ReliabilityScore;
}

export async function getPickupRisk(donationId: string): Promise<PickupRisk> {
  const { data, error } = await supabase.rpc('calculate_pickup_risk', {
    p_donation_id: donationId,
  });
  if (error) throw new Error(error.message);
  return data as PickupRisk;
}

export async function getSuccessProbability(donationId: string): Promise<SuccessProbability> {
  const { data, error } = await supabase.rpc('calculate_success_probability', {
    p_donation_id: donationId,
  });
  if (error) throw new Error(error.message);
  return data as SuccessProbability;
}

export async function getDonationPriority(donationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('calculate_priority', {
    p_donation_id: donationId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ---------- ADVANCED: RESCUE & REASSIGNMENT ----------
export async function triggerRescueMode(donationId: string): Promise<Donation> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('trigger_rescue_mode', {
    p_donation_id: donationId, p_actor_id: u.user.id,
  });
  if (error) throw new Error(error.message);
  return data as Donation;
}

export async function cancelVolunteerAssignment(donationId: string, reason: string): Promise<Donation> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('cancel_volunteer_assignment', {
    p_donation_id: donationId, p_actor_id: u.user.id, p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as Donation;
}

export async function ngoRejectDonation(donationId: string, reason: string): Promise<Donation> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('ngo_reject_donation', {
    p_donation_id: donationId, p_actor_id: u.user.id, p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as Donation;
}

// ---------- ADVANCED: DELIVERY EXCEPTIONS ----------
export async function reportDeliveryException(
  donationId: string, exceptionType: string, expected: string, actual: string, reason: string
): Promise<DeliveryException> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('report_delivery_exception', {
    p_donation_id: donationId, p_actor_id: u.user.id,
    p_ex_type: exceptionType, p_expected: expected, p_actual: actual, p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as DeliveryException;
}

export async function fetchDeliveryExceptions(donationId: string): Promise<DeliveryException[]> {
  const { data, error } = await supabase
    .from('delivery_exceptions')
    .select('*')
    .eq('donation_id', donationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as DeliveryException[];
}

// ---------- ADVANCED: DECISION HISTORY & MATCH ATTEMPTS ----------
export async function fetchDonationEvents(donationId: string): Promise<DonationEvent[]> {
  const { data, error } = await supabase
    .from('donation_events')
    .select('*')
    .eq('donation_id', donationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as DonationEvent[];
}

export async function fetchMatchAttempts(donationId: string): Promise<MatchAttempt[]> {
  const { data, error } = await supabase
    .from('match_attempts')
    .select('*')
    .eq('donation_id', donationId)
    .order('attempted_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as MatchAttempt[];
}

// ---------- ADVANCED: LIVE OPERATIONS ----------
export async function getLiveOperations(): Promise<LiveOperations> {
  const { data, error } = await supabase.rpc('get_live_operations');
  if (error) throw new Error(error.message);
  return data as LiveOperations;
}

// ---------- ADVANCED: IMPACT METRICS ----------
export async function getImpactMetrics(userId: string, role: string): Promise<ImpactMetrics> {
  const { data, error } = await supabase.rpc('get_impact_metrics', {
    p_user_id: userId, p_role: role,
  });
  if (error) throw new Error(error.message);
  return data as ImpactMetrics;
}

// ---------- ADVANCED: SURPLUS INSIGHTS ----------
export async function getSurplusInsights(restaurantId: string): Promise<SurplusInsights> {
  const { data, error } = await supabase.rpc('get_surplus_insights', {
    p_restaurant_id: restaurantId,
  });
  if (error) throw new Error(error.message);
  return data as SurplusInsights;
}

// ---------- ADVANCED: SIMULATION ----------
export async function runSimulation(params: Record<string, any>): Promise<SimulationResults> {
  const { data, error } = await supabase.rpc('run_simulation', { p_params: params });
  if (error) throw new Error(error.message);
  return data as SimulationResults;
}

export async function fetchSimulationRuns(): Promise<SimulationRun[]> {
  const { data, error } = await supabase
    .from('simulation_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data || []) as SimulationRun[];
}

// ---------- ADVANCED: HEATMAP DATA ----------
export async function fetchHeatmapData(timeRange: 'today' | '7days' | '30days', category?: string) {
  let q = supabase.from('donations').select(`
    id, status, category, food_type, quantity, estimated_servings,
    pickup_address, created_at, updated_at,
    restaurant:profiles!donations_restaurant_id_fkey(id, name, address, role),
    ngo:profiles!donations_ngo_id_fkey(id, name, address, role)
  `);
  if (timeRange === 'today') {
    q = q.gte('created_at', new Date().toISOString().split('T')[0]);
  } else if (timeRange === '7days') {
    q = q.gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
  } else if (timeRange === '30days') {
    q = q.gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
  }
  if (category && category !== 'All') q = q.eq('category', category);
  const { data: donations, error } = await q;
  if (error) throw new Error(error.message);

  const { data: profiles, error: perr } = await supabase
    .from('profiles')
    .select('id, name, address, role, status')
    .in('role', ['restaurant', 'ngo', 'volunteer']);
  if (perr) throw new Error(perr.message);

  return { donations: donations || [], profiles: profiles || [] };
}
