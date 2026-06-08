'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  CheckCircle, 
  ArrowRight, 
  ShieldCheck, 
  Inbox, 
  UserPlus
} from 'lucide-react';
import Link from 'next/link';
import ReservationProgressSteps from '@/components/customer/ReservationProgressSteps';
import DelayedLoadingState from '@/components/shared/DelayedLoadingState';

function SuccessContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const code = searchParams.get('reservation_code') || 'RES-DEMO';
  const email = searchParams.get('email') || 'you@example.com';
  
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsGuest(false);
      }
    }
    checkAuth();
  }, [supabase]);

  return (
    <div className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 text-center space-y-6">
      
      {/* Checkmark animation */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 shadow-lg shadow-emerald-500/10">
        <CheckCircle className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#272727]">
          Reservation Sent for Review
        </h1>
        <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
          We received your reservation and receipt. Accounting will review the payment and you will receive an update.
        </p>
      </div>

      {/* Info panel */}
      <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 text-left text-xs space-y-3.5">
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-900">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Reservation Number</span>
          <span className="font-extrabold text-emerald-400 font-mono tracking-wide">{code}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Expected Review</span>
          <span className="font-bold text-slate-200">Within 24 Hours</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Hold Expiration</span>
          <span className="font-bold text-slate-200">48 Hours (Unpaid)</span>
        </div>
      </div>

      {/* 1. If Guest: Account Creation Promo CTA */}
      {isGuest ? (
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 text-left space-y-4">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <UserPlus className="w-4.5 h-4.5" />
            Create an Account to Track Your Reservation
          </h3>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Use the same reservation email (<strong className="text-slate-200">{email}</strong>). Your reservation will appear automatically in your customer account.
          </p>
          <Link
            href={`/auth/register?email=${encodeURIComponent(email)}`}
            className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition text-xs shadow-lg shadow-emerald-500/15 cursor-pointer"
          >
            Create Customer Account
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        /* 2. If logged in: Go to customer area dashboard */
        <div className="flex gap-4">
          <Link
            href="/"
            className="flex-1 py-3 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Back to Home
          </Link>
          <Link
            href="/customer/dashboard"
            className="flex-1 flex items-center justify-center gap-1 bg-slate-950 border border-slate-800 hover:border-emerald-500/20 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Inbox className="w-3.5 h-3.5 text-emerald-400" />
            My Dashboard
          </Link>
        </div>
      )}

      <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-center gap-1 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/40" />
        <span>Your reservation information is securely recorded.</span>
      </div>
    </div>
  );
}

export default function ReservationSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-950/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-teal-950/20 blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-3xl space-y-5">
        <ReservationProgressSteps currentStep={5} />
        <Suspense fallback={<DelayedLoadingState loading message="Loading your reservation..." />}>
          <SuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
