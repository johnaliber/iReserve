'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/brand/BrandLogo';
import { ArrowRight, ChevronLeft, Eye, EyeOff, Home, Loader2, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const claimResponse = await fetch('/api/customer/claim-reservations', {
          method: 'POST'
        });
        if (!claimResponse.ok) {
          console.error('Guest reservations could not be linked during sign in.');
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        router.push('/customer/dashboard');
        router.refresh();
        return;
      }

      const role = profile.role;
      if (role === 'super_admin') router.push('/super-admin/dashboard');
      else if (role === 'village_admin') router.push('/village-admin/dashboard');
      else if (role === 'accounting') router.push('/accounting/dashboard');
      else if (role === 'architect') router.push('/architect/dashboard');
      else router.push('/customer/dashboard');

      router.refresh();
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e9f0f0] px-4 py-8 text-[#272727]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.16),transparent_30%)]" />

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] lg:min-h-[640px] lg:grid-cols-[1.08fr_.92fr]">
      <Link
        href="/"
        className="absolute right-4 top-4 z-20 inline-flex h-12 w-12 items-center justify-center bg-transparent text-[#334155] transition-transform duration-200 hover:scale-110 md:right-8 md:top-8"
        aria-label="Back to home"
      >
        <ChevronLeft className="h-7 w-7 stroke-[2.5]" />
      </Link>
        <section className="relative hidden overflow-hidden bg-slate-900 lg:block">
          <Image
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"
            alt="Modern home exterior"
            fill
            priority
            sizes="(min-width: 1024px) 620px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 via-slate-950/25 to-slate-950/50" />
          <div className="absolute inset-x-0 top-0 p-10 text-white">
            <BrandLogo className="brightness-0 invert" />
            <p className="mt-5 max-w-md text-base font-semibold leading-7 text-white/90">
              Reserve your future home with a guided, visual property experience.
            </p>
          </div>
          <div className="absolute bottom-10 left-10 right-10 border border-white/20 bg-white/15 p-6 text-white shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center bg-emerald-500 text-white">
                <Home className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-extrabold">Welcome back</p>
                <p className="mt-1 text-sm leading-6 text-white/80">
                  Access dashboards, reservations, payments, and viewing schedules.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <BrandLogo className="h-24 w-72 [&_img]:object-center" />
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight text-emerald-600">
                Welcome
              </h1>
              <p className="mt-2 text-sm text-[#64748b]">
                Login with Email
              </p>
            </div>

            {error && (
              <div className="mb-6 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#0f766e]">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#334155]">
                    <Mail className="h-5 w-5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="min-h-14 w-full border-2 border-cyan-400/80 bg-white py-3 pl-12 pr-4 text-sm font-semibold text-[#272727] outline-none transition placeholder:text-[#94a3b8] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#0f766e]">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#334155]">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="min-h-14 w-full border-2 border-cyan-400/80 bg-white py-3 pl-12 pr-14 text-sm font-semibold text-[#272727] outline-none transition placeholder:text-[#94a3b8] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-[#64748b] transition hover:text-emerald-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 w-full max-w-44 items-center justify-center gap-2 bg-emerald-600 px-8 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Login
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-xs leading-6 text-[#64748b]">
              Customer accounts are created after a property reservation is started.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
