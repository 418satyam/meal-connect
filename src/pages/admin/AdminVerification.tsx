import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { adminFetchUsers, adminSetUserStatus } from '@/services/api';
import type { Profile } from '@/types';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { roleLabel, formatDate } from '@/utils/helpers';

export function AdminVerification() {
  const { toast } = useToast();
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const all = await adminFetchUsers();
      setPending(all.filter((u) => u.status === 'pending'));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handle = async (userId: string, status: string) => {
    try {
      await adminSetUserStatus(userId, status);
      toast(`User ${status}`, 'success');
      load();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  if (loading) return <LoadingSpinner label="Loading pending verifications..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-green-600" /> Verification Queue
        </h1>
        <p className="text-sm text-gray-500">Approve or reject new user registrations.</p>
      </div>
      {pending.length === 0 ? (
        <EmptyState title="No pending verifications" message="All users have been reviewed." icon={<CheckCircle2 className="h-8 w-8" />} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {pending.map((u) => (
            <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{u.name || u.email}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="mt-1 text-xs font-medium text-gray-600">{roleLabel(u.role)} • Joined {formatDate(u.created_at)}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handle(u.id, 'verified')} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Verify
                </button>
                <button onClick={() => handle(u.id, 'rejected')} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
