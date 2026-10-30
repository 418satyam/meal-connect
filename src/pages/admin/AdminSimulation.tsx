import { useEffect, useState } from 'react';
import { Beaker, Users, Building2, MapPin, Clock, Package, Play, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { runSimulation, fetchSimulationRuns } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { classNames, formatNumber } from '@/utils/helpers';
import type { SimulationResults, SimulationRun } from '@/types';

export function AdminSimulation() {
  const { toast } = useToast();
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [params, setParams] = useState({
    volunteers: 120,
    ngo_capacity: 200,
    max_radius: 10,
    avg_pickup_time: 30,
    donation_volume: 50,
  });

  const loadHistory = async () => {
    try {
      setHistory(await fetchSimulationRuns());
    } catch { /* non-critical */ }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleRun = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await runSimulation(params);
      setResults(r);
      toast('Simulation complete.', 'success');
      loadHistory();
    } catch (err: any) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Beaker className="h-6 w-6 text-purple-600" /> What-If Simulation
        </h1>
        <p className="text-sm text-gray-500">Adjust variables to model how changes would affect food rescue outcomes.</p>
      </div>

      <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 text-sm text-purple-700 flex items-start gap-2">
        <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <p>These results are <strong>simulated predictions</strong> based on a simplified model, not real outcomes. They are intended for research and planning purposes only.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Parameters */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Simulation Parameters</h2>
          <div className="space-y-4">
            <ParamInput
              icon={Users}
              label="Number of volunteers"
              value={params.volunteers}
              onChange={(v) => setParams({ ...params, volunteers: v })}
              min={1}
              max={1000}
            />
            <ParamInput
              icon={Building2}
              label="NGO capacity (meals)"
              value={params.ngo_capacity}
              onChange={(v) => setParams({ ...params, ngo_capacity: v })}
              min={10}
              max={10000}
            />
            <ParamInput
              icon={MapPin}
              label="Max pickup radius (km)"
              value={params.max_radius}
              onChange={(v) => setParams({ ...params, max_radius: v })}
              min={1}
              max={50}
            />
            <ParamInput
              icon={Clock}
              label="Average pickup time (min)"
              value={params.avg_pickup_time}
              onChange={(v) => setParams({ ...params, avg_pickup_time: v })}
              min={5}
              max={120}
            />
            <ParamInput
              icon={Package}
              label="Donation volume (per day)"
              value={params.donation_volume}
              onChange={(v) => setParams({ ...params, donation_volume: v })}
              min={1}
              max={500}
            />
          </div>
          <button
            onClick={handleRun}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {loading ? 'Running simulation...' : 'Run Simulation'}
          </button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {loading ? (
            <LoadingSpinner label="Running simulation..." />
          ) : results ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Results</h2>

              {/* Current vs Predicted */}
              <div className="space-y-4">
                <ComparisonRow
                  label="Rescue success rate"
                  current={`${results.current_success_rate}%`}
                  predicted={`${results.predicted_success_rate}%`}
                  improvement={results.predicted_success_rate - results.current_success_rate}
                  unit="%"
                />
                <ComparisonRow
                  label="Average pickup time"
                  current={`${results.current_pickup_time} min`}
                  predicted={`${results.predicted_pickup_time} min`}
                  improvement={results.current_pickup_time - results.predicted_pickup_time}
                  unit=" min"
                  invertColor
                />
                <ComparisonRow
                  label="Predicted expiry rate"
                  current="—"
                  predicted={`${results.predicted_expired_rate}%`}
                  improvement={null}
                  unit="%"
                />
                <ComparisonRow
                  label="Volunteer workload"
                  current="—"
                  predicted={`${results.volunteer_workload} donations/vol`}
                  improvement={null}
                  unit=""
                />
                <ComparisonRow
                  label="NGO workload"
                  current="—"
                  predicted={`${results.ngo_workload} donations/NGO`}
                  improvement={null}
                  unit=""
                />
              </div>

              <div className="mt-6 rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Current volunteers: <strong>{results.current_volunteers}</strong></span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-gray-600">
                    Simulated with <strong>{params.volunteers}</strong> volunteers
                    ({params.volunteers > results.current_volunteers ? '+' : ''}{params.volunteers - results.current_volunteers} change)
                  </span>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-400 italic">{results.note}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <Beaker className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-4 text-sm text-gray-500">Adjust parameters and run a simulation to see predicted outcomes.</p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Recent Simulations</h3>
              <div className="space-y-2 text-sm">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-gray-600">
                      {h.params?.volunteers || '?'} volunteers, {h.params?.donation_volume || '?'} donations
                    </span>
                    <span className="font-semibold text-purple-600">
                      {h.results?.predicted_success_rate || '?'}% predicted
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ParamInput({
  icon: Icon, label, value, onChange, min, max,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Icon className="h-4 w-4 text-gray-400" /> {label}
      </label>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-purple-600"
        />
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center outline-none"
        />
      </div>
    </div>
  );
}

function ComparisonRow({
  label, current, predicted, improvement, unit, invertColor,
}: {
  label: string; current: string; predicted: string;
  improvement: number | null; unit: string; invertColor?: boolean;
}) {
  const isPositive = improvement !== null && (invertColor ? improvement > 0 : improvement > 0);
  const isNegative = improvement !== null && improvement < 0;
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Current</p>
          <p className="text-sm font-semibold text-gray-700">{current}</p>
        </div>
        <div className="text-center">
          {improvement !== null && improvement !== 0 ? (
            <span className={classNames(
              'flex items-center gap-1 text-xs font-semibold',
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
            )}>
              {improvement > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {improvement > 0 ? '+' : ''}{improvement}{unit}
            </span>
          ) : (
            <span className="text-gray-300">→</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-purple-400">Predicted</p>
          <p className="text-sm font-bold text-purple-700">{predicted}</p>
        </div>
      </div>
    </div>
  );
}
