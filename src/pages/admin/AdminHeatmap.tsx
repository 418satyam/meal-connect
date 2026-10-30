import { useEffect, useState, useMemo } from 'react';
import { MapPin, Building2, Store, Bike, Filter, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { fetchHeatmapData } from '@/services/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { classNames, formatNumber } from '@/utils/helpers';

const timeRanges = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
] as const;

const categories = ['All', 'Cooked Meals', 'Bakery', 'Fruits', 'Vegetables', 'Dairy', 'Packaged Food', 'Beverages', 'Other'];

interface AreaData {
  area: string;
  donationCount: number;
  completedCount: number;
  expiredCount: number;
  ngoCount: number;
  volunteerCount: number;
  restaurantCount: number;
  estimatedDemand: number;
  surplusLevel: 'high' | 'balanced' | 'low';
}

export function AdminHeatmap() {
  const [data, setData] = useState<{ donations: any[]; profiles: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('7days');
  const [category, setCategory] = useState('All');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchHeatmapData(timeRange, category));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [timeRange, category]);

  const areas = useMemo<AreaData[]>(() => {
    if (!data) return [];
    const areaMap = new Map<string, AreaData>();

    const getArea = (address: string): string => {
      if (!address) return 'Unknown';
      const parts = address.split(',');
      return parts[parts.length - 1].trim() || parts[0].trim() || 'Unknown';
    };

    // Count profiles by area
    for (const p of data.profiles) {
      const area = getArea(p.address);
      if (!areaMap.has(area)) {
        areaMap.set(area, {
          area, donationCount: 0, completedCount: 0, expiredCount: 0,
          ngoCount: 0, volunteerCount: 0, restaurantCount: 0, estimatedDemand: 0,
          surplusLevel: 'balanced',
        });
      }
      const a = areaMap.get(area)!;
      if (p.role === 'ngo') a.ngoCount++;
      if (p.role === 'volunteer') a.volunteerCount++;
      if (p.role === 'restaurant') a.restaurantCount++;
    }

    // Count donations by area
    for (const d of data.donations) {
      const area = getArea(d.pickup_address);
      if (!areaMap.has(area)) {
        areaMap.set(area, {
          area, donationCount: 0, completedCount: 0, expiredCount: 0,
          ngoCount: 0, volunteerCount: 0, restaurantCount: 0, estimatedDemand: 0,
          surplusLevel: 'balanced',
        });
      }
      const a = areaMap.get(area)!;
      a.donationCount++;
      if (d.status === 'completed') a.completedCount++;
      if (d.status === 'expired') a.expiredCount++;
      a.estimatedDemand += (d.estimated_servings || 0) * (d.ngo_id ? 0 : 1);
    }

    // Determine surplus level
    for (const a of areaMap.values()) {
      const supplyRatio = a.restaurantCount > 0 ? a.donationCount / a.restaurantCount : 0;
      const demandRatio = a.ngoCount > 0 ? a.donationCount / a.ngoCount : a.donationCount;
      if (supplyRatio > 2 && a.ngoCount < a.restaurantCount) {
        a.surplusLevel = 'high';
      } else if (a.ngoCount > a.restaurantCount && a.donationCount > 0) {
        a.surplusLevel = 'low';
      } else {
        a.surplusLevel = 'balanced';
      }
    }

    return Array.from(areaMap.values()).sort((a, b) => b.donationCount - a.donationCount);
  }, [data]);

  if (loading) return <LoadingSpinner label="Loading heatmap data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ErrorState message="Could not load heatmap." />;

  const hasData = areas.length > 0 && areas.some((a) => a.donationCount > 0 || a.restaurantCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surplus vs Demand Heatmap</h1>
        <p className="text-sm text-gray-500">Geographic distribution of food surplus and demand across areas.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          {timeRanges.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeRange(t.value)}
              className={classNames(
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                timeRange === t.value ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none"
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <LegendItem color="bg-red-500" label="High surplus / Low demand" icon={TrendingDown} />
        <LegendItem color="bg-green-500" label="High demand / Low supply" icon={TrendingUp} />
        <LegendItem color="bg-amber-400" label="Balanced" icon={Minus} />
      </div>

      {!hasData ? (
        <EmptyState
          title="No location data available"
          message="Heatmap data will appear once restaurants, NGOs, and donations with addresses are in the system."
          icon={<MapPin className="h-8 w-8" />}
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Area list (heatmap representation) */}
          <div className="lg:col-span-2 space-y-3">
            {areas.map((a) => (
              <button
                key={a.area}
                onClick={() => setSelectedArea(a.area)}
                className={classNames(
                  'w-full rounded-xl border p-4 text-left transition-all hover:shadow-md',
                  selectedArea === a.area ? 'border-green-500 ring-1 ring-green-200' : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={classNames(
                      'flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold',
                      a.surplusLevel === 'high' ? 'bg-red-500' :
                      a.surplusLevel === 'low' ? 'bg-green-500' : 'bg-amber-400'
                    )}>
                      {a.donationCount}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{a.area}</p>
                      <p className="text-xs text-gray-500">
                        {a.restaurantCount} restaurants • {a.ngoCount} NGOs • {a.volunteerCount} volunteers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {a.surplusLevel === 'high' ? 'High surplus' :
                       a.surplusLevel === 'low' ? 'High demand' : 'Balanced'}
                    </p>
                    <p className="text-xs text-gray-500">{a.completedCount} completed • {a.expiredCount} expired</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="space-y-4">
            {selectedArea ? (
              <AreaDetail area={areas.find((a) => a.area === selectedArea)!} />
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                Click an area to see detailed statistics.
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 italic">
        Areas are derived from address data in profiles and donations. Demand is estimated from unaccepted donation servings and is not a scientifically exact measurement.
      </p>
    </div>
  );
}

function LegendItem({ color, label, icon: Icon }: { color: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2">
      <div className={classNames('h-4 w-4 rounded', color)} />
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function AreaDetail({ area }: { area: AreaData }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-gray-400" /> {area.area}
      </h3>
      <div className={classNames(
        'mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        area.surplusLevel === 'high' ? 'bg-red-100 text-red-700' :
        area.surplusLevel === 'low' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      )}>
        {area.surplusLevel === 'high' ? 'High surplus / Low demand' :
         area.surplusLevel === 'low' ? 'High demand / Low supply' : 'Balanced area'}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <DetailRow icon={Package} label="Donations" value={formatNumber(area.donationCount)} />
        <DetailRow icon={Store} label="Restaurants" value={formatNumber(area.restaurantCount)} />
        <DetailRow icon={Building2} label="NGOs" value={formatNumber(area.ngoCount)} />
        <DetailRow icon={Bike} label="Volunteers" value={formatNumber(area.volunteerCount)} />
        <DetailRow icon={CheckCircle} label="Completed" value={formatNumber(area.completedCount)} />
        <DetailRow icon={XCircle} label="Expired" value={formatNumber(area.expiredCount)} />
        <DetailRow icon={TrendingUp} label="Est. demand (servings)" value={formatNumber(area.estimatedDemand)} />
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
      <span className="flex items-center gap-2 text-gray-600">
        <Icon className="h-4 w-4 text-gray-400" /> {label}
      </span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function Package({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>;
}
function CheckCircle({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>;
}
function XCircle({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
}
