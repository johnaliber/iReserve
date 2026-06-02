'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  Building, 
  Coins, 
  Clock, 
  FileCheck, 
  Calendar, 
  AlertCircle, 
  Compass, 
  Layers, 
  ArrowRight,
  Loader2,
  BellRing,
  Inbox
} from 'lucide-react';
import Link from 'next/link';
import PaymentSummaryCard from '@/components/payments/PaymentSummaryCard';
import PaymentScheduleTable from '@/components/payments/PaymentScheduleTable';

export default function CustomerDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [siteViewings, setSiteViewings] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      setUser(authUser);

      // 1. Fetch Reservations
      const { data: res } = await supabase
        .from('reservations')
        .select('*, properties(*, villages(*)), payment_plans(*, payment_schedule(*))')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false });

      setReservations(res || []);

      // 2. Fetch Payments
      const { data: pay } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false });

      setPayments(pay || []);

      // 3. Fetch Documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('customer_id', authUser.id);

      setDocuments(docs || []);

      // 4. Fetch Site Viewings
      const { data: viewings } = await supabase
        .from('site_viewings')
        .select('*, properties(*)')
        .eq('customer_id', authUser.id);

      setSiteViewings(viewings || []);

    } catch (err) {
      console.error('Error fetching customer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchDashboardData();
    });
  }, [fetchDashboardData]);

  // Countdown timer calculator
  const getRemainingTime = (expiresAtStr) => {
    const difference = new Date(expiresAtStr) - new Date();
    if (difference <= 0) return 'Expired';
    
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    return `${hours}h ${minutes}m left`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'reserved':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full select-none">Approved</span>;
      case 'pending_verification':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full select-none">Pending Verification</span>;
      case 'pending_payment':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full select-none">Pending Payment</span>;
      case 'expired':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full select-none">Expired</span>;
      default:
        return <span className="bg-slate-800 text-slate-350 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full select-none">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-950/20 border border-slate-800/80 rounded-2xl p-6 shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Welcome Back, {user?.email?.split('@')[0]}
            </h1>
            <p className="text-slate-400 text-xs mt-1 leading-normal">
              Track your subdivision booking, upload payments, or monitor document approvals in real-time.
            </p>
          </div>
          <Link
            href="/villages"
            className="self-start md:self-auto flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow"
          >
            Browse New Subdivisions
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {reservations.length === 0 ? (
          /* Empty State */
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-10 text-center max-w-lg mx-auto glass-card">
            <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-200">No Reservations Yet</h3>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              You haven&apos;t reserved any property parcels yet. Launch a smart village subdivision vector blueprint map to pick your parcel.
            </p>
            <Link
              href="/villages"
              className="mt-6 inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition shadow"
            >
              Explore Village Map Directory
            </Link>
          </div>
        ) : (
          /* Active Content Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left/Center Column: Reservations & Payments List */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Reservations Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Inbox className="w-4.5 h-4.5 text-emerald-400" />
                  Active Land Reservations ({reservations.length})
                </h3>

                <div className="divide-y divide-slate-800/80">
                  {reservations.map((res) => {
                    const prop = res.properties || {};
                    const plan = Array.isArray(res.payment_plans) ? res.payment_plans[0] : res.payment_plans;
                    const schedule = plan?.payment_schedule || [];
                    
                    return (
                      <div key={res.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-4">
                        <PaymentSummaryCard plan={plan} />
                        <PaymentScheduleTable rows={schedule} />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-100 text-sm">{prop.property_code}</span>
                            <span className="text-[10px] text-slate-500">• Block {prop.block_number} Lot {prop.lot_number}</span>
                            {getStatusBadge(res.status)}
                          </div>
                          
                          <p className="text-[11px] text-slate-400 font-medium">
                            {prop.villages?.name} • Facing {prop.orientation} • {prop.lot_size} sqm area
                          </p>
                          
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5 text-emerald-500/60" />
                              Deposit: ₱{res.reservation_fee?.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-emerald-500/60" />
                              Booked: {new Date(res.reserved_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Expiration Timer Card */}
                        {res.status !== 'approved' && res.status !== 'expired' && (
                          <div className="bg-slate-950/80 border border-slate-900 rounded-xl px-4 py-2.5 flex items-center gap-2 self-start sm:self-auto shadow shadow-slate-950">
                            <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
                            <div className="text-left">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Expiry Warning</span>
                              <span className="text-xs font-bold text-slate-350">{getRemainingTime(res.expires_at)}</span>
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payments Ledger Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Coins className="w-4.5 h-4.5 text-emerald-400" />
                  Payments Ledger Audit
                </h3>

                <div className="divide-y divide-slate-800/60 text-xs">
                  {payments.length === 0 ? (
                    <span className="text-slate-500 block py-2">No payment logs recorded yet.</span>
                  ) : (
                    payments.map((p) => (
                      <div key={p.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-300 block">GCASH Transaction</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">Ref: {p.reference_number || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white block">₱{p.amount?.toLocaleString()}</span>
                          <span className={`text-[9px] font-bold uppercase ${p.payment_status === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {p.payment_status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Required Documents and viewings checklist */}
            <div className="space-y-6">
              
              {/* Document Checklist Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative glass-card">
                <h3 className="text-sm font-bold text-slate-200 mb-4 border-b border-slate-850 pb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileCheck className="w-4.5 h-4.5 text-emerald-400" />
                  ID & Income checklist
                </h3>

                <div className="space-y-3.5">
                  {documents.length === 0 ? (
                    <span className="text-slate-500 text-xs">No documents listed.</span>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-900 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-300 block">{doc.document_type}</span>
                          <span className="text-[10px] text-slate-500 italic block mt-0.5">Checked by audit</span>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Site Viewing Schedule Cards */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative glass-card">
                <h3 className="text-sm font-bold text-slate-200 mb-4 border-b border-slate-850 pb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-4.5 h-4.5 text-emerald-400" />
                  Site viewings schedule
                </h3>

                <div className="space-y-3.5">
                  {siteViewings.length === 0 ? (
                    <div className="text-slate-500 text-xs">
                      No viewings scheduled yet.
                    </div>
                  ) : (
                    siteViewings.map((sv) => (
                      <div key={sv.id} className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-slate-300 block">Lot Viewing</span>
                        <span className="text-[10px] text-slate-400 block">
                          Date: {sv.preferred_date} • Time: {sv.preferred_time}
                        </span>
                        <span className={`text-[9px] font-bold uppercase mt-1.5 block ${sv.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {sv.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardShell>
  );
}
