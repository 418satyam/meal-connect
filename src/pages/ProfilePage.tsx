import { useEffect, useState } from 'react';
import { Save, Mail, Phone, MapPin, User } from 'lucide-react';
import { fetchProfile, updateProfile, updateVolunteerStatus } from '@/services/api';
import type { Profile, VolunteerStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';
import { roleLabel, formatDate, classNames } from '@/utils/helpers';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [volStatus, setVolStatus] = useState<VolunteerStatus | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        owner_name: profile.owner_name || '',
        operating_hours: profile.operating_hours || '',
        organization_name: profile.organization_name || '',
        registration_number: profile.registration_number || '',
        contact_person: profile.contact_person || '',
        service_area: profile.service_area || '',
        vehicle_type: profile.vehicle_type || '',
        availability: profile.availability || '',
      });
      setVolStatus(profile.volunteer_status || 'offline');
    }
    setLoading(false);
  }, [profile]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        name: form.name, phone: form.phone, address: form.address,
      };
      if (profile?.role === 'restaurant') {
        updates.owner_name = form.owner_name;
        updates.operating_hours = form.operating_hours;
      } else if (profile?.role === 'ngo') {
        updates.organization_name = form.organization_name;
        updates.registration_number = form.registration_number;
        updates.contact_person = form.contact_person;
        updates.service_area = form.service_area;
      } else if (profile?.role === 'volunteer') {
        updates.vehicle_type = form.vehicle_type;
        updates.availability = form.availability;
      }
      await updateProfile(updates);
      await refreshProfile();
      toast('Profile updated successfully', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (status: VolunteerStatus) => {
    setVolStatus(status);
    setStatusSaving(true);
    try {
      await updateVolunteerStatus(status);
      await refreshProfile();
      toast(`You are now ${status}`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
      setVolStatus(profile?.volunteer_status || 'offline');
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading profile..." />;
  if (!profile) return <ErrorState message="Profile not found" />;

  const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500">Manage your account information.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-xl font-bold text-white">
            {(profile.name || profile.email)[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile.name || profile.email}</p>
            <p className="text-sm text-gray-500">{roleLabel(profile.role)} • Member since {formatDate(profile.created_at)}</p>
            <p className="text-xs text-gray-400">{profile.email}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email (read-only)</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={profile.email} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2 text-sm text-gray-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input value={form.address || ''} onChange={(e) => set('address', e.target.value)} className={inputClass} />
            </div>
          </div>

          {profile.role === 'restaurant' && (
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700">Restaurant Name</label>
                <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Owner Name</label>
                <input value={form.owner_name || ''} onChange={(e) => set('owner_name', e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Operating Hours</label>
                <input value={form.operating_hours || ''} onChange={(e) => set('operating_hours', e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {profile.role === 'ngo' && (
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <input value={form.organization_name || ''} onChange={(e) => set('organization_name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                <input value={form.registration_number || ''} onChange={(e) => set('registration_number', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                <input value={form.contact_person || ''} onChange={(e) => set('contact_person', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Service Area</label>
                <input value={form.service_area || ''} onChange={(e) => set('service_area', e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {profile.role === 'volunteer' && (
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Vehicle Type</label>
                <input value={form.vehicle_type || ''} onChange={(e) => set('vehicle_type', e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Availability</label>
                <input value={form.availability || ''} onChange={(e) => set('availability', e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Delivery Status</label>
                <div className="mt-2 flex gap-2">
                  {(['available', 'busy', 'offline'] as VolunteerStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={statusSaving}
                      className={classNames(
                        'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors',
                        volStatus === s
                          ? s === 'available' ? 'bg-green-600 text-white'
                            : s === 'busy' ? 'bg-amber-600 text-white'
                            : 'bg-gray-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                        statusSaving && 'opacity-60'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">Set yourself to Available to claim delivery tasks. Busy means you're on a delivery.</p>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
