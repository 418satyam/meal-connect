import type { DonationStatus, DeliveryStatus } from '@/types';

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Status display helpers
const donationStatusMap: Record<DonationStatus, { label: string; color: string }> = {
  created: { label: 'Created', color: 'bg-gray-100 text-gray-700' },
  waiting_for_ngo: { label: 'Waiting for NGO', color: 'bg-blue-100 text-blue-700' },
  ngo_accepted: { label: 'NGO Accepted', color: 'bg-indigo-100 text-indigo-700' },
  volunteer_assigned: { label: 'Volunteer Assigned', color: 'bg-cyan-100 text-cyan-700' },
  volunteer_arrived: { label: 'Volunteer Arrived', color: 'bg-amber-100 text-amber-700' },
  food_picked_up: { label: 'Food Picked Up', color: 'bg-teal-100 text-teal-700' },
  in_transit: { label: 'In Transit', color: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Delivered', color: 'bg-lime-100 text-lime-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700' },
};

const deliveryStatusMap: Record<DeliveryStatus, { label: string; color: string }> = {
  assigned: { label: 'Waiting for Volunteer', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Volunteer Assigned', color: 'bg-indigo-100 text-indigo-700' },
  arrived_restaurant: { label: 'At Restaurant', color: 'bg-amber-100 text-amber-700' },
  food_picked_up: { label: 'Picked Up', color: 'bg-teal-100 text-teal-700' },
  in_transit: { label: 'In Transit', color: 'bg-purple-100 text-purple-700' },
  arrived_ngo: { label: 'At NGO', color: 'bg-lime-100 text-lime-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export function donationStatusBadge(status: DonationStatus) {
  return donationStatusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
}

export function deliveryStatusBadge(status: DeliveryStatus) {
  return deliveryStatusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
}

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ----- Priority helpers -----
export function priorityInfo(priority: string): { label: string; color: string; icon: string } {
  switch (priority) {
    case 'rescue': return { label: 'Rescue', color: 'bg-red-600 text-white', icon: '🚨' };
    case 'critical': return { label: 'Critical', color: 'bg-red-100 text-red-700 border border-red-300', icon: '🔥' };
    case 'high': return { label: 'High', color: 'bg-orange-100 text-orange-700 border border-orange-300', icon: '⚠' };
    case 'medium': return { label: 'Medium', color: 'bg-amber-100 text-amber-700', icon: '•' };
    default: return { label: 'Normal', color: 'bg-gray-100 text-gray-600', icon: '○' };
  }
}

export function priorityRank(priority: string): number {
  const order: Record<string, number> = { rescue: 5, critical: 4, high: 3, medium: 2, normal: 1, expired: 0 };
  return order[priority] ?? 1;
}

// Sort donations by urgency (priority first, then time to expiry)
export function sortByPriority<T extends { expiry_time: string; status: string }>(items: T[]): T[] {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aExpiry = new Date(a.expiry_time).getTime();
    const bExpiry = new Date(b.expiry_time).getTime();
    const aActive = !['completed', 'cancelled', 'expired'].includes(a.status);
    const bActive = !['completed', 'cancelled', 'expired'].includes(b.status);
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive && bActive) {
      const aUrgent = aExpiry - now < 3600000;
      const bUrgent = bExpiry - now < 3600000;
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return aExpiry - bExpiry;
    }
    return 0;
  });
}

// ----- Time-to-expiry helpers -----
export function minutesUntilExpiry(expiryTime: string): number {
  return Math.round((new Date(expiryTime).getTime() - Date.now()) / 60000);
}

export function timeUntilExpiry(expiryTime: string): string {
  const mins = minutesUntilExpiry(expiryTime);
  if (mins <= 0) return 'Expired';
  if (mins < 60) return `${mins} min left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return `${hrs}h ${rem}m left`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h left`;
}

export function urgencyLevel(expiryTime: string): 'normal' | 'high' | 'critical' | 'rescue' | 'expired' {
  const mins = minutesUntilExpiry(expiryTime);
  if (mins <= 0) return 'expired';
  if (mins <= 10) return 'rescue';
  if (mins <= 30) return 'critical';
  if (mins <= 60) return 'high';
  return 'normal';
}

export function urgencyColor(level: string): string {
  switch (level) {
    case 'rescue': return 'text-red-600';
    case 'critical': return 'text-red-500';
    case 'high': return 'text-orange-600';
    case 'expired': return 'text-red-700';
    default: return 'text-gray-500';
  }
}

// ----- Risk helpers -----
export function riskColor(level: string): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-300';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-300';
    default: return 'bg-green-100 text-green-700 border-green-300';
  }
}

// ----- Match score helpers -----
export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-amber-600 bg-amber-50';
  if (score >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Fair match';
  return 'Weak match';
}

// ----- Reliability helpers -----
export function reliabilityColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-teal-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

// ----- Probability helpers -----
export function probabilityColor(prob: number): string {
  if (prob >= 70) return 'text-green-600';
  if (prob >= 50) return 'text-amber-600';
  if (prob >= 30) return 'text-orange-600';
  return 'text-red-600';
}

export function probabilityLabel(prob: number): string {
  if (prob >= 70) return 'Highly likely to be rescued';
  if (prob >= 50) return 'Moderately likely to be rescued';
  if (prob >= 30) return 'At risk — may not be rescued';
  return 'Low chance of rescue';
}

// ----- Number formatting -----
export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

// ----- Location matching helpers -----
function normalize(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

/**
 * Check if a volunteer's location matches an NGO's service area.
 * Uses case-insensitive substring matching on address and service_area fields.
 * Returns true if there's any overlap, or if the NGO has no service area set.
 */
export function locationMatch(
  volArea: string | null,
  volAddress: string | null,
  ngoArea: string | null,
  ngoAddress: string | null
): boolean {
  const va = normalize(volArea);
  const vaddr = normalize(volAddress);
  const na = normalize(ngoArea);
  const naddr = normalize(ngoAddress);

  if (na === '') return true;
  if (va === '' && vaddr === '') return true;

  return (
    (na !== '' && va !== '' && (na.includes(va) || va.includes(na))) ||
    (na !== '' && vaddr !== '' && na.includes(vaddr)) ||
    (naddr !== '' && va !== '' && va.includes(naddr)) ||
    (naddr !== '' && vaddr !== '' && (vaddr.includes(naddr) || naddr.includes(vaddr)))
  );
}

/**
 * Check if a donation's pickup location matches an NGO's service area.
 */
export function ngoDonationLocationMatch(
  ngoArea: string | null,
  pickupAddress: string,
  restaurantAddress: string | null
): { match: boolean; reason: string } {
  const na = normalize(ngoArea);
  if (na === '') return { match: true, reason: 'No service area set — showing all donations' };

  const pa = normalize(pickupAddress);
  const ra = normalize(restaurantAddress);

  if (pa && pa.includes(na)) return { match: true, reason: 'Pickup location in your service area' };
  if (ra && ra.includes(na)) return { match: true, reason: 'Restaurant in your service area' };
  if (ra && na.includes(ra)) return { match: true, reason: 'Restaurant in your service area' };

  return { match: false, reason: 'Outside your service area' };
}
