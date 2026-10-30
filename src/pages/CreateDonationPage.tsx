import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { createDonation } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { classNames } from '@/utils/helpers';

const categories = ['Cooked Meals', 'Bakery', 'Fruits', 'Vegetables', 'Dairy', 'Packaged Food', 'Beverages', 'Other'];
const foodTypes = ['Vegetarian', 'Non-Vegetarian', 'Vegan'];
const units = ['servings', 'kg', 'boxes', 'trays', 'litres', 'pieces', 'packets'];

export function CreateDonationPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({
    food_type: 'Vegetarian',
    category: 'Cooked Meals',
    unit: 'servings',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.food_name) e.food_name = 'Food name is required';
    if (!form.category) e.category = 'Category is required';
    if (!form.food_type) e.food_type = 'Food type is required';
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = 'Quantity must be greater than 0';
    if (!form.unit) e.unit = 'Unit is required';
    if (!form.estimated_servings || Number(form.estimated_servings) <= 0) e.estimated_servings = 'Servings must be greater than 0';
    if (!form.preparation_time) e.preparation_time = 'Preparation time is required';
    if (!form.expiry_time) e.expiry_time = 'Expiry time is required';
    if (form.preparation_time && form.expiry_time && new Date(form.expiry_time) <= new Date(form.preparation_time)) {
      e.expiry_time = 'Expiry must be after preparation time';
    }
    if (!form.pickup_address) e.pickup_address = 'Pickup address is required';
    if (!form.pickup_date) e.pickup_date = 'Pickup date is required';
    if (!form.pickup_start_time) e.pickup_start_time = 'Pickup start time is required';
    if (!form.pickup_deadline) e.pickup_deadline = 'Pickup deadline is required';
    if (form.pickup_start_time && form.pickup_deadline && form.pickup_deadline <= form.pickup_start_time) {
      e.pickup_deadline = 'Deadline must be after start time';
    }
    if (!form.contact_person) e.contact_person = 'Contact person is required';
    if (!form.contact_number) e.contact_number = 'Contact number is required';
    if (!form.safety_confirmed) e.safety_confirmed = 'You must confirm food safety';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast('Please fix the errors in the form', 'error');
      return;
    }
    setLoading(true);
    try {
      const prepISO = new Date(form.preparation_time).toISOString();
      const expiryISO = new Date(form.expiry_time).toISOString();
      const d = await createDonation({
        food_name: form.food_name,
        category: form.category,
        food_type: form.food_type,
        description: form.description || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        estimated_servings: Number(form.estimated_servings),
        preparation_time: prepISO,
        expiry_time: expiryISO,
        packaging: form.packaging || null,
        allergens: form.allergens || null,
        storage_requirements: form.storage_requirements || null,
        food_condition: form.food_condition || null,
        image: form.image || null,
        pickup_address: form.pickup_address,
        pickup_date: form.pickup_date,
        pickup_start_time: form.pickup_start_time,
        pickup_deadline: form.pickup_deadline,
        contact_person: form.contact_person,
        contact_number: form.contact_number,
        pickup_instructions: form.pickup_instructions || null,
      });
      toast('Donation created successfully!', 'success');
      navigate(`/donations/${d.id}`);
    } catch (err: any) {
      toast(err.message || 'Failed to create donation', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner label="Creating donation..." />;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900">Create Food Donation</h1>
      <p className="mt-1 text-sm text-gray-500">Fill in the details of the surplus food you want to donate.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Basic info */}
        <Section title="Food Information">
          <Grid>
            <FieldText label="Food Name *" value={form.food_name || ''} onChange={(v) => set('food_name', v)} error={errors.food_name} placeholder="e.g. Veg Biryani" />
            <FieldSelect label="Category *" value={form.category || ''} onChange={(v) => set('category', v)} options={categories} error={errors.category} />
            <FieldSelect label="Food Type *" value={form.food_type || ''} onChange={(v) => set('food_type', v)} options={foodTypes} error={errors.food_type} />
            <FieldText label="Estimated Servings *" value={form.estimated_servings || ''} onChange={(v) => set('estimated_servings', v)} error={errors.estimated_servings} type="number" placeholder="40" />
            <FieldText label="Quantity *" value={form.quantity || ''} onChange={(v) => set('quantity', v)} error={errors.quantity} type="number" placeholder="40" />
            <FieldSelect label="Unit *" value={form.unit || ''} onChange={(v) => set('unit', v)} options={units} error={errors.unit} />
          </Grid>
          <FieldText label="Description" value={form.description || ''} onChange={(v) => set('description', v)} placeholder="Brief description of the food" full />
        </Section>

        {/* Times */}
        <Section title="Time & Freshness">
          <Grid>
            <FieldText label="Preparation Date/Time *" value={form.preparation_time || ''} onChange={(v) => set('preparation_time', v)} error={errors.preparation_time} type="datetime-local" />
            <FieldText label="Expiry Date/Time *" value={form.expiry_time || ''} onChange={(v) => set('expiry_time', v)} error={errors.expiry_time} type="datetime-local" />
          </Grid>
          <Grid>
            <FieldText label="Packaging" value={form.packaging || ''} onChange={(v) => set('packaging', v)} placeholder="e.g. Sealed containers" />
            <FieldText label="Allergens" value={form.allergens || ''} onChange={(v) => set('allergens', v)} placeholder="e.g. Dairy, Nuts" />
            <FieldText label="Storage Requirements" value={form.storage_requirements || ''} onChange={(v) => set('storage_requirements', v)} placeholder="e.g. Keep refrigerated" />
            <FieldText label="Food Condition" value={form.food_condition || ''} onChange={(v) => set('food_condition', v)} placeholder="e.g. Fresh" />
          </Grid>
        </Section>

        {/* Pickup */}
        <Section title="Pickup Details">
          <FieldText label="Pickup Address *" value={form.pickup_address || ''} onChange={(v) => set('pickup_address', v)} error={errors.pickup_address} placeholder="Full address" full />
          <Grid>
            <FieldText label="Pickup Date *" value={form.pickup_date || ''} onChange={(v) => set('pickup_date', v)} error={errors.pickup_date} type="date" />
            <FieldText label="Pickup Start Time *" value={form.pickup_start_time || ''} onChange={(v) => set('pickup_start_time', v)} error={errors.pickup_start_time} type="time" />
            <FieldText label="Pickup Deadline *" value={form.pickup_deadline || ''} onChange={(v) => set('pickup_deadline', v)} error={errors.pickup_deadline} type="time" />
            <FieldText label="Contact Person *" value={form.contact_person || ''} onChange={(v) => set('contact_person', v)} error={errors.contact_person} placeholder="Name" />
            <FieldText label="Contact Number *" value={form.contact_number || ''} onChange={(v) => set('contact_number', v)} error={errors.contact_number} placeholder="Phone" />
          </Grid>
          <FieldText label="Pickup Instructions" value={form.pickup_instructions || ''} onChange={(v) => set('pickup_instructions', v)} placeholder="Any special instructions for pickup" full />
        </Section>

        {/* Safety */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.safety_confirmed === 'true'}
              onChange={(e) => set('safety_confirmed', e.target.checked ? 'true' : '')}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <div>
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <ShieldCheck className="h-4 w-4 text-green-600" /> Food Safety Confirmation
              </span>
              <p className="mt-0.5 text-xs text-gray-500">
                I confirm this food is safe for consumption, has been stored properly, and meets food safety standards.
              </p>
              {errors.safety_confirmed && <p className="mt-1 text-xs text-red-600">{errors.safety_confirmed}</p>}
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Create Donation
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none';

function FieldText({
  label, value, onChange, error, placeholder, type = 'text', full,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string; full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={classNames(inputClass, error && 'border-red-300 focus:border-red-500 focus:ring-red-100')}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FieldSelect({
  label, value, onChange, options, error,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={classNames(inputClass, error && 'border-red-300')}
      >
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
