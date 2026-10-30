import { Link } from 'react-router-dom';
import {
  Utensils,
  HeartHandshake,
  Bike,
  ArrowRight,
  Sprout,
  Users,
  Network,
  ClipboardCheck,
  LogIn,
  Apple,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function LandingPage() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-gray-900">Meal Connect</span>
          </div>
          <div className="flex items-center gap-2">
            {profile ? (
              <Link
                to={`/${profile.role}`}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <LogIn className="h-4 w-4" /> Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-emerald-50" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                <Apple className="h-3.5 w-3.5" /> Rescue Food. Share Hope.
              </span>
              <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
                Rescue Food. <span className="text-green-600">Share Hope.</span>
              </h1>
              <p className="mt-6 text-lg text-gray-600 max-w-xl">
                Meal Connect connects restaurants with NGOs and volunteers to rescue surplus food and
                deliver it to people who need it.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register?role=restaurant"
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                >
                  <Utensils className="h-4 w-4" /> Donate Food
                </Link>
                <Link
                  to="/register?role=ngo"
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <HeartHandshake className="h-4 w-4" /> Join as NGO
                </Link>
                <Link
                  to="/register?role=volunteer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Bike className="h-4 w-4" /> Become a Volunteer
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Login <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-green-600 p-6 text-white shadow-lg">
                      <Utensils className="h-8 w-8 mb-3" />
                      <p className="font-semibold">Restaurants</p>
                      <p className="text-sm text-green-50">Donate surplus food</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                      <Bike className="h-8 w-8 mb-3 text-amber-500" />
                      <p className="font-semibold text-gray-900">Volunteers</p>
                      <p className="text-sm text-gray-500">Pick up & deliver</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-8">
                    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                      <HeartHandshake className="h-8 w-8 mb-3 text-blue-500" />
                      <p className="font-semibold text-gray-900">NGOs</p>
                      <p className="text-sm text-gray-500">Receive & distribute</p>
                    </div>
                    <div className="rounded-2xl bg-gray-900 p-6 text-white shadow-lg">
                      <ClipboardCheck className="h-8 w-8 mb-3" />
                      <p className="font-semibold">QR Verified</p>
                      <p className="text-sm text-gray-300">Secure pickup</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">How Meal Connect Works</h2>
            <p className="mt-3 text-gray-600">A simple five-step journey from surplus to served.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { n: 1, title: 'Restaurant Donates', icon: Utensils, color: 'bg-green-100 text-green-600' },
              { n: 2, title: 'NGO Accepts', icon: HeartHandshake, color: 'bg-blue-100 text-blue-600' },
              { n: 3, title: 'Volunteer Picks Up', icon: Bike, color: 'bg-amber-100 text-amber-600' },
              { n: 4, title: 'NGO Receives', icon: PackageCheck, color: 'bg-teal-100 text-teal-600' },
              { n: 5, title: 'Food Reaches People', icon: Users, color: 'bg-purple-100 text-purple-600' },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="rounded-xl bg-white border border-gray-200 p-6 text-center shadow-sm">
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${step.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-xs font-bold text-gray-400">STEP {step.n}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{step.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Meal Connect */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Why Meal Connect?</h2>
            <p className="mt-3 text-gray-600">Real benefits for everyone in the chain.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Reduce Food Waste', desc: 'Save edible surplus from going to landfill.', icon: Sprout },
              { title: 'Help Communities', desc: 'Feed people who need it most.', icon: HeartHandshake },
              { title: 'Connect Organizations', desc: 'Bridge restaurants, NGOs, and volunteers.', icon: Network },
              { title: 'Track Donations', desc: 'Full visibility from kitchen to plate.', icon: ClipboardCheck },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900">{b.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-green-600">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to make a difference?</h2>
          <p className="mt-3 text-green-50">Join Meal Connect today and be part of the food rescue movement.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-green-700 hover:bg-green-50"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600 text-white">
              <Sprout className="h-4 w-4" />
            </div>
            <span className="font-bold text-gray-900">Meal Connect</span>
          </div>
          <p className="text-sm text-gray-500">Rescue Food. Share Hope. © 2026 Meal Connect.</p>
        </div>
      </footer>
    </div>
  );
}
