import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Clock, Package, Award, AlertTriangle, Calendar } from 'lucide-react';
import { getSurplusInsights } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { formatNumber, classNames } from '@/utils/helpers';
import type { SurplusInsights } from '@/types';

export function RestaurantInsights() {
  const { profile } = useAuth();
  const [insights, setInsights] = useState<SurplusInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!profile) return;
      try {
        setInsights(await getSurplusInsights(profile.id));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  if (loading) return <LoadingSpinner label="Analyzing your donation patterns..." />;
  if (error) return <ErrorState message={error} />;
  if (!insights) return <ErrorState message="Could not load insights." />;

  if (!insights.has_data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Waste Insights</h1>
          <p className="text-sm text-gray-500">Understand your surplus donation patterns.</p>
        </div>
        <EmptyState
          title="Not enough historical data yet"
          message="Create some donations to see insights about your surplus patterns, peak donation times, and food category breakdowns."
          icon={<BarChart3 className="h-8 w-8" />}
        />
      </div>
    );
  }

  const dayEntries = insights.by_day ? Object.entries(insights.by_day).sort((a, b) => b[1] - a[1]) : [];
  const hourEntries = insights.by_hour ? Object.entries(insights.by_hour).sort((a, b) => b[1] - a[1]) : [];
  const catEntries = insights.by_category ? Object.entries(insights.by_category).sort((a, b) => b[1] - a[1]) : [];
  const maxDay = Math.max(...dayEntries.map(([, v]) => v), 1);
  const maxCat = Math.max(...catEntries.map(([, v]) => v), 1);
  const topDay = dayEntries[0];
  const topCat = catEntries[0];
  const total = insights.total_donations || 0;
  const catPct = topCat ? Math.round((topCat[1] / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Food Waste Insights</h1>
        <p className="text-sm text-gray-500">Understand your surplus donation patterns to reduce food waste.</p>
      </div>

      {/* Auto-generated insights */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 className="font-semibold text-green-900 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Key Insights
        </h2>
        <div className="mt-3 space-y-2 text-sm text-green-800">
          {topDay && (
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              Your surplus donations are highest on <strong>{topDay[0].trim()}</strong> ({topDay[1]} donations).
            </p>
          )}
          {topCat && (
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <strong>{topCat[0]}</strong> items represent <strong>{catPct}%</strong> of your donated food.
            </p>
          )}
          {insights.top_food && (
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              Most frequently donated food: <strong>{insights.top_food}</strong>.
            </p>
          )}
          {insights.avg_quantity && (
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              Average donation quantity: <strong>{formatNumber(insights.avg_quantity)}</strong> units.
            </p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Package} label="Total Donations" value={formatNumber(total)} color="bg-green-50 text-green-600" />
        <SummaryCard icon={Award} label="Most Donated" value={insights.top_food || '—'} color="bg-blue-50 text-blue-600" />
        <SummaryCard icon={CheckCircle} label="Completed" value={formatNumber(insights.completed || 0)} color="bg-teal-50 text-teal-600" />
        <SummaryCard icon={AlertTriangle} label="Expired" value={formatNumber(insights.expired || 0)} color="bg-red-50 text-red-600" />
      </div>

      {/* By Day of Week */}
      {dayEntries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" /> Donations by Day of Week
          </h2>
          <div className="mt-4 space-y-2">
            {dayEntries.map(([day, count]) => (
              <BarRow key={day} label={day.trim()} value={count} max={maxDay} color="bg-green-500" />
            ))}
          </div>
        </div>
      )}

      {/* By Category */}
      {catEntries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400" /> Donations by Food Category
          </h2>
          <div className="mt-4 space-y-2">
            {catEntries.map(([cat, count]) => (
              <BarRow key={cat} label={cat} value={count} max={maxCat} color="bg-blue-500" />
            ))}
          </div>
        </div>
      )}

      {/* By Hour */}
      {hourEntries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" /> Donations by Time of Day
          </h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {hourEntries.slice(0, 12).map(([hour, count]) => (
              <div key={hour} className="rounded-lg bg-gray-50 p-2 text-center">
                <p className="text-xs text-gray-500">{hour}</p>
                <p className="text-lg font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 italic">
        Insights are generated from your real donation history. Patterns become more accurate as you create more donations.
      </p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className={classNames('rounded-lg p-2.5 w-fit', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 truncate">{value}</p>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>;
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={classNames('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
