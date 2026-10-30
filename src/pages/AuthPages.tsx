import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sprout, Mail, Lock, Utensils, HeartHandshake, Bike, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Role } from '@/types';
import { classNames } from '@/utils/helpers';

export function LoginPage() {
  const { login, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) navigate(`/${profile.role}`, { replace: true });
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const p = await login(email, password);
      toast(`Welcome back, ${p.name || p.email}!`, 'success');
      navigate(`/${p.role}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-emerald-700 p-12 flex-col justify-between text-white">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">Meal Connect</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Rescue Food. Share Hope.</h2>
          <p className="mt-4 text-green-50 text-lg">
            Connect restaurants, NGOs, and volunteers to end food waste and feed communities.
          </p>
        </div>
        <p className="text-green-100 text-sm">© 2026 Meal Connect</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-gray-900">Meal Connect</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your Meal Connect account</p>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-green-600 hover:text-green-700">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register, login, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [role, setRole] = useState<Role>((params.get('role') as Role) || 'restaurant');
  const [form, setForm] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) navigate(`/${profile.role}`, { replace: true });
  }, [profile, navigate]);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!form.email || !form.name || !form.phone || !form.address) {
      setError('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const data: Record<string, any> = {
        name: form.name,
        phone: form.phone,
        address: form.address,
      };
      if (role === 'restaurant') data.owner_name = form.owner_name || form.name;
      if (role === 'ngo') {
        data.organization_name = form.organization_name || form.name;
        data.registration_number = form.registration_number || '';
        data.contact_person = form.contact_person || form.name;
        data.service_area = form.service_area || '';
        data.meal_capacity = form.meal_capacity || '';
        data.storage_capacity = form.storage_capacity || '';
        data.refrigeration_available = form.refrigeration_available === 'true';
        data.accepted_food_types = form.accepted_food_types || '';
      }
      if (role === 'volunteer') {
        data.vehicle_type = form.vehicle_type || '';
        data.availability = form.availability || '';
      }
      await register(form.email, password, role, data);
      await login(form.email, password);
      toast('Account created successfully!', 'success');
      navigate(`/${role}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const roles: { value: Role; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'restaurant', label: 'Restaurant', icon: Utensils },
    { value: 'ngo', label: 'NGO', icon: HeartHandshake },
    { value: 'volunteer', label: 'Volunteer', icon: Bike },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-gray-900">Meal Connect</span>
        </Link>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">Join Meal Connect and start making a difference.</p>

          {/* Role selector */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={classNames(
                    'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-colors',
                    role === r.value
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-6 w-6" />
                  {r.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={role === 'restaurant' ? 'Restaurant Name *' : role === 'ngo' ? 'Organization Name *' : 'Full Name *'}>
                <input
                  required
                  value={form.name || ''}
                  onChange={(e) => set('name', e.target.value)}
                  className={inputClass}
                  placeholder={role === 'restaurant' ? 'Spice Garden' : role === 'ngo' ? 'Hope Foundation' : 'Arjun Kumar'}
                />
              </Field>
              <Field label="Email *">
                <input
                  type="email"
                  required
                  value={form.email || ''}
                  onChange={(e) => set('email', e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Phone *">
                <input
                  required
                  value={form.phone || ''}
                  onChange={(e) => set('phone', e.target.value)}
                  className={inputClass}
                  placeholder="9876543210"
                />
              </Field>
              <Field label="Password *">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 6 characters"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address *">
                  <input
                    required
                    value={form.address || ''}
                    onChange={(e) => set('address', e.target.value)}
                    className={inputClass}
                    placeholder="Street, City, State"
                  />
                </Field>
              </div>

              {role === 'restaurant' && (
                <Field label="Owner Name">
                  <input value={form.owner_name || ''} onChange={(e) => set('owner_name', e.target.value)} className={inputClass} placeholder="Owner name" />
                </Field>
              )}
              {role === 'restaurant' && (
                <Field label="Operating Hours">
                  <input value={form.operating_hours || ''} onChange={(e) => set('operating_hours', e.target.value)} className={inputClass} placeholder="11 AM - 11 PM" />
                </Field>
              )}

              {role === 'ngo' && (
                <>
                  <Field label="Registration Number">
                    <input value={form.registration_number || ''} onChange={(e) => set('registration_number', e.target.value)} className={inputClass} placeholder="NGO/BLR/2026/001" />
                  </Field>
                  <Field label="Contact Person">
                    <input value={form.contact_person || ''} onChange={(e) => set('contact_person', e.target.value)} className={inputClass} placeholder="Contact person" />
                  </Field>
                  <Field label="Service Area">
                    <input value={form.service_area || ''} onChange={(e) => set('service_area', e.target.value)} className={inputClass} placeholder="Areas you serve" />
                  </Field>
                  <Field label="Meal Capacity">
                    <input type="number" value={form.meal_capacity || ''} onChange={(e) => set('meal_capacity', e.target.value)} className={inputClass} placeholder="e.g. 200" />
                  </Field>
                  <Field label="Storage Capacity">
                    <select value={form.storage_capacity || ''} onChange={(e) => set('storage_capacity', e.target.value)} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                      <option value="Large">Large</option>
                    </select>
                  </Field>
                  <Field label="Refrigeration Available">
                    <select value={form.refrigeration_available || ''} onChange={(e) => set('refrigeration_available', e.target.value)} className={inputClass}>
                      <option value="">Select</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Accepted Food Types (comma separated)">
                      <input value={form.accepted_food_types || ''} onChange={(e) => set('accepted_food_types', e.target.value)} className={inputClass} placeholder="Vegetarian, Non-Vegetarian" />
                    </Field>
                  </div>
                </>
              )}

              {role === 'volunteer' && (
                <>
                  <Field label="Vehicle Type">
                    <select value={form.vehicle_type || ''} onChange={(e) => set('vehicle_type', e.target.value)} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Two-wheeler">Two-wheeler</option>
                      <option value="Car">Car</option>
                      <option value="Bicycle">Bicycle</option>
                      <option value="On foot">On foot</option>
                    </select>
                  </Field>
                  <Field label="Availability">
                    <input value={form.availability || ''} onChange={(e) => set('availability', e.target.value)} className={inputClass} placeholder="Weekdays evening, Weekends" />
                  </Field>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-green-600 hover:text-green-700">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
