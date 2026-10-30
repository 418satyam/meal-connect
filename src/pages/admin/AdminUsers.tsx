import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, CheckCircle2, XCircle, Ban, RotateCcw, Eye } from 'lucide-react';
import { adminFetchUsers, adminSetUserStatus, getVolunteerReliability } from '@/services/api';
import type { Profile, ReliabilityScore } from '@/types';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, roleLabel, classNames } from '@/utils/helpers';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-200 text-gray-700',
};

export function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reliabilityMap, setReliabilityMap] = useState<Record<string, ReliabilityScore | null>>({});
  const roleFilter = params.get('role') || '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await adminFetchUsers(roleFilter || undefined));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [roleFilter]);

  useEffect(() => {
    if (users.length === 0) return;
    const volunteers = users.filter((u) => u.role === 'volunteer');
    if (volunteers.length === 0) return;
    (async () => {
      const entries = await Promise.all(volunteers.map(async (v) => [v.id, await getVolunteerReliability(v.id).catch(() => null)] as const));
      setReliabilityMap(Object.fromEntries(entries));
    })();
  }, [users]);

  const handleStatus = async (userId: string, status: string) => {
    try {
      await adminSetUserStatus(userId, status);
      toast(`User ${status}`, 'success');
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (loading) return <LoadingSpinner label="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500">View and manage all Meal Connect users.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-gray-400" />
          {['', 'restaurant', 'ngo', 'volunteer', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => setParams(r ? { role: r } : {})}
              className={classNames(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                roleFilter === r ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {r ? roleLabel(r) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                {roleFilter === 'volunteer' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reliability</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.name || '—'}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{roleLabel(u.role)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={u.status} color={statusColors[u.status]} />
                  </td>
                  {roleFilter === 'volunteer' && (
                    <td className="px-4 py-3">
                      {reliabilityMap[u.id]?.score !== null && reliabilityMap[u.id]?.score !== undefined ? (
                        <span className={classNames('font-semibold', reliabilityMap[u.id].score! >= 90 ? 'text-green-600' : reliabilityMap[u.id].score! >= 75 ? 'text-teal-600' : reliabilityMap[u.id].score! >= 60 ? 'text-amber-600' : 'text-red-600')}>
                          {reliabilityMap[u.id].score}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">No history</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {u.status !== 'verified' && (
                        <button onClick={() => handleStatus(u.id, 'verified')} title="Verify" className="rounded p-1.5 text-green-600 hover:bg-green-50">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {u.status !== 'suspended' && u.role !== 'admin' && (
                        <button onClick={() => handleStatus(u.id, 'suspended')} title="Suspend" className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      {u.status === 'suspended' && (
                        <button onClick={() => handleStatus(u.id, 'verified')} title="Reactivate" className="rounded p-1.5 text-blue-600 hover:bg-blue-50">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      {u.status !== 'rejected' && u.role !== 'admin' && (
                        <button onClick={() => handleStatus(u.id, 'rejected')} title="Reject" className="rounded p-1.5 text-red-500 hover:bg-red-50">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
