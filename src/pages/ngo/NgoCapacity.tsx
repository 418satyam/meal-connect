import { useEffect, useState } from 'react';
import { Boxes, Save } from 'lucide-react';
import { fetchProfile, updateProfile } from '@/services/api';
import type { Profile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorState } from '@/components/ErrorState';

export function NgoCapacity() {
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        setProfile(p);
        if (p) {
          setForm({
            organization_name: p.organization_name || '',
            registration_number: p.registration_number || '',
            contact_person: p.contact_person || '',
            phone: p.phone || '',
            address: p.address || '',
            service_area: p.service_area || '',
            meal_capacity: p.meal_capacity?.toString() || '',
            storage_capacity: p.storage_capacity || '',
            refrigeration_available: p.refrigeration_available ? 'true' : 'false',
            accepted_food_types: (p.accepted_food_types || []).join(', '),
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        organization_name: form.organization_name,
        registration_number: form.registration_number,
        contact_person: form.contact_person,
        phone: form.phone,
        address: form.address,
        service_area: form.service_area,
        meal_capacity: form.meal_capacity ? Number(form.meal_capacity) : null,
        storage_capacity: form.storage_capacity,
        refrigeration_available: form.refrigeration_available === 'true',
        accepted_food_types: form.accepted_food_types
          ? form.accepted_food_types.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      await updateProfile(updates);
      await refreshProfile();
      toast('Capacity updated successfully', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading capacity..." />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <ErrorState message="Profile not found" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-green-600" /> NGO Capacity
        </h1>
        <p className="text-sm text-gray-500">Manage your organization's capacity and preferences.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Organization Name" value={form.organization_name || ''} onChange={(v) => set('organization_name', v)} />
          <Field label="Registration Number" value={form.registration_number || ''} onChange={(v) => set('registration_number', v)} />
          <Field label="Contact Person" value={form.contact_person || ''} onChange={(v) => set('contact_person', v)} />
          <Field label="Phone" value={form.phone || ''} onChange={(v) => set('phone', v)} />
          <Field label="Address" value={form.address || ''} onChange={(v) => set('address', v)} full />
          <Field label="Service Area" value={form.service_area || ''} onChange={(v) => set('service_area', v)} full />
          <Field label="Meal Capacity" value={form.meal_capacity || ''} onChange={(v) => set('meal_capacity', v)} type="number" />
          <div>
            <label className="block text-sm font-medium text-gray-700">Storage Capacity</label>
            <select value={form.storage_capacity || ''} onChange={(e) => set('storage_capacity', e.target.value)} className={inputClass}>
              <option value="">Select</option>
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Refrigeration Available</label>
            <select value={form.refrigeration_available || ''} onChange={(e) => set('refrigeration_available', e.target.value)} className={inputClass}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <Field label="Accepted Food Types (comma separated)" value={form.accepted_food_types || ''} onChange={(v) => set('accepted_food_types', v)} full />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none';

function Field({ label, value, onChange, type = 'text', full }: { label: string; value: string; onChange: (v: string) => void; type?: string; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}
