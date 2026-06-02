'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Building, Lock, Mail, User, Phone, Loader2, ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer'); // Default to customer
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            role,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to login page after 2 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden px-4">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-950/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-teal-950/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 my-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-lg shadow-emerald-500/5">
            <Building className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#272727]">
            Join <span className="text-emerald-600">iReserve</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Create an account to browse and reserve property blueprints
          </p>
        </div>

        {success ? (
          <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center text-sm font-medium">
            Account created successfully! Redirecting you to login...
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 transition outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 transition outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+63 917 123 4567"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 transition outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 transition outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Sign up as (Role Selection for MVP Testing)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Shield className="w-4 h-4" />
                  </span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 transition outline-none text-sm appearance-none cursor-pointer"
                  >
                    <option value="customer" className="bg-slate-900">Customer (Buyer)</option>
                    <option value="village_admin" className="bg-slate-900">Village Admin (Assigned Village Manager)</option>
                    <option value="accounting" className="bg-slate-900">Accounting User (Payment Verifier)</option>
                    <option value="architect" className="bg-slate-900">Architect (Blueprint Designer)</option>
                    <option value="super_admin" className="bg-slate-900">Super Admin (System Manager)</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 italic">
                  Note: Role-based permissions are enforced via Supabase RLS and Next.js middleware.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 transform active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign Up
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
