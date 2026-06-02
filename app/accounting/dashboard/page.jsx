'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  CreditCard, 
  Check, 
  X, 
  Coins, 
  ShieldCheck, 
  Loader2, 
  Filter, 
  Download,
  AlertTriangle,
  FileCheck,
  Building,
  User
} from 'lucide-react';
import PaymentVerificationPanel from '@/components/accounting/PaymentVerificationPanel';

export default function AccountingDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  
  // Filtering states
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  // Audit Dialog state
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [orNumber, setOrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [auditing, setAuditing] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, payment_plans(*), reservations(*, properties(*, villages(*)), profiles(full_name))')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPayments(data);
      }
    } catch (err) {
      console.error('Error fetching payments ledger:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPayments();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPayments]);

  // Auditing Action: VERIFY PAYMENT
  const handleVerifyPayment = async (payId, reservationId, propertyId) => {
    setAuditing(true);
    try {
      if (typeof payId === 'string' && payId.startsWith('mock-')) {
        // Handle mock payment records gracefully for testing and QA
        const currentList = payments.length > 0 ? payments : getMockPayments();
        const updatedPayments = currentList.map(p => {
          if (p.id === payId) {
            return {
              ...p,
              payment_status: 'verified',
              official_receipt_number: orNumber || generateReceiptNumber(),
              accounting_notes: notes || 'Hold fee deposit successfully verified by accounting audit.'
            };
          }
          return p;
        });
        setPayments(updatedPayments);
        setOrNumber('');
        setNotes('');
        setSelectedPayment(null);
        setAuditing(false);
        return;
      }

      const response = await fetch('/api/accounting/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payId,
          reservationId,
          propertyId,
          officialReceiptNumber: orNumber || generateReceiptNumber(),
          notes
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Payment verification failed.');
      }

      setOrNumber('');
      setNotes('');
      setSelectedPayment(null);
      fetchPayments();
    } catch (err) {
      alert(err.message || 'Audit verification failed.');
    } finally {
      setAuditing(false);
    }
  };

  // Auditing Action: REJECT PAYMENT
  const handleRejectPayment = async (payId, reservationId, propertyId) => {
    if (!rejectionReason) {
      alert('Please specify a rejection reason.');
      return;
    }
    setAuditing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (typeof payId === 'string' && payId.startsWith('mock-')) {
        // Handle mock payment records gracefully for testing and QA
        const currentList = payments.length > 0 ? payments : getMockPayments();
        const updatedPayments = currentList.map(p => {
          if (p.id === payId) {
            return {
              ...p,
              payment_status: 'rejected',
              rejection_reason: rejectionReason
            };
          }
          return p;
        });
        setPayments(updatedPayments);
        setRejectionReason('');
        setSelectedPayment(null);
        setAuditing(false);
        return;
      }

      // 1. Update Payment Status to 'rejected'
      const { error: payError } = await supabase
        .from('payments')
        .update({
          payment_status: 'rejected',
          rejection_reason: rejectionReason,
          verified_by: user.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', payId);

      if (payError) throw payError;

      // 2. Update Reservation Status to 'rejected'
      const { error: resError } = await supabase
        .from('reservations')
        .update({
          status: 'rejected',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (resError) throw resError;

      // 3. Release property status back to 'available'
      await supabase
        .from('properties')
        .update({ status: 'available' })
        .eq('id', propertyId);

      // 4. Create client notification
      const payRecord = payments.find(p => p.id === payId);
      const customerId = payRecord?.customer_id;
      if (customerId) {
        await supabase.from('notifications').insert({
          user_id: customerId,
          title: 'Hold Fee Receipt Rejected',
          message: `Your hold fee receipt upload has been rejected. Reason: ${rejectionReason}. The property has been released back to available.`,
          type: 'payment_rejected'
        });
      }

      setRejectionReason('');
      setSelectedPayment(null);
      fetchPayments();
    } catch (err) {
      alert(err.message || 'Rejection audit failed.');
    } finally {
      setAuditing(false);
    }
  };


  // Pre-configured mock data if empty
  const getMockPayments = () => [
    {
      id: 'mock-pay-1',
      amount: 5000,
      payment_method: 'gcash',
      payment_status: 'pending_verification',
      reference_number: 'GC-90123847',
      created_at: new Date().toISOString(),
      reservations: {
        id: 'mock-res-1',
        reservation_code: 'RES-89104',
        properties: { id: 'mock-prop-1', property_code: 'ERR-B1L1', price: 4500000, villages: { name: 'Emerald Ridge Heights' } },
        profiles: { full_name: 'John Miller' }
      }
    },
    {
      id: 'mock-pay-2',
      amount: 5000,
      payment_method: 'bank_transfer',
      payment_status: 'verified',
      reference_number: 'TX-BNK901',
      official_receipt_number: 'OR-890123',
      created_at: new Date().toISOString(),
      reservations: {
        id: 'mock-res-2',
        reservation_code: 'RES-90128',
        properties: { id: 'mock-prop-2', property_code: 'TLR-B3L5', price: 3800000, villages: { name: 'Teal Lagoon Residences' } },
        profiles: { full_name: 'Samantha Cruz' }
      }
    }
  ];

  const displayedPayments = payments.length > 0 ? payments : getMockPayments();

  // Filter payments
  const filteredPayments = displayedPayments.filter((p) => {
    if (statusFilter && p.payment_status !== statusFilter) return false;
    if (methodFilter && p.payment_method !== methodFilter) return false;
    return true;
  });

  // Export Sales ledger to CSV
  const handleExportCSV = () => {
    const headers = ['OR Number', 'Reservation Code', 'Customer', 'Subdivision', 'Property Code', 'Amount', 'Method', 'Reference ID', 'Status', 'Date'];
    const rows = filteredPayments.map(p => [
      p.official_receipt_number || 'N/A',
      p.reservations?.reservation_code || 'N/A',
      p.reservations?.profiles?.full_name || 'Guest User',
      p.reservations?.properties?.villages?.name || 'N/A',
      p.reservations?.properties?.property_code || 'N/A',
      p.amount,
      p.payment_method,
      p.reference_number || 'N/A',
      p.payment_status,
      new Date(p.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-ledger-audit.csv';
    a.click();
  };

  const pendingCount = displayedPayments.filter(p => p.payment_status === 'pending_verification').length;
  const verifiedCount = displayedPayments.filter(p => p.payment_status === 'verified').length;
  const totalCollections = displayedPayments.filter(p => p.payment_status === 'verified').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-emerald-400" />
              Accounting Audit Desk
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Verify customer receipts, record official receipt numbers, verify downpayments, or cancel expired unpaid reserves.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="self-start md:self-auto flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Sales Ledger CSV
          </button>
        </div>

        {/* Audit Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Collections</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">₱{totalCollections.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pending Verifications</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">{pendingCount} payments</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Verified Deposits</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">{verifiedCount} deposits</span>
            </div>
          </div>
        </div>

        {/* Filtering Options */}
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-wrap gap-4 items-center glass-card">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold select-none">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter Transactions:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-350 outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending_verification">Pending Audit</option>
            <option value="verified">Verified Ledger</option>
            <option value="rejected">Rejected Entries</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-350 outline-none cursor-pointer"
          >
            <option value="">All Methods</option>
            <option value="gcash">GCash Transfer</option>
            <option value="maya">Maya Account</option>
            <option value="bank_transfer">Bank Wire</option>
          </select>
        </div>

        {/* Audit Ledger Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4.5 h-4.5 text-emerald-400" />
            Receipts Audit Ledger
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 select-none">
                  <th className="py-3 px-2">Reservation Info</th>
                  <th className="py-3 px-2">Customer / Client</th>
                  <th className="py-3 px-2">Subdivision & Plot</th>
                  <th className="py-3 px-2">Deposit Fee</th>
                  <th className="py-3 px-2">Transfer Method</th>
                  <th className="py-3 px-2">Reference ID</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredPayments.map((p) => {
                  const res = p.reservations || {};
                  const prop = res.properties || {};
                  return (
                    <tr key={p.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3.5 px-2 font-mono font-semibold text-emerald-400">{res.reservation_code}</td>
                      <td className="py-3.5 px-2 text-slate-250 font-semibold">{res.profiles?.full_name || 'Guest Buyer'}</td>
                      <td className="py-3.5 px-2">
                        <span className="block text-slate-200">{prop.villages?.name || 'Smart Subd'}</span>
                        <span className="text-[10px] text-slate-500">Block {prop.block_number} Lot {prop.lot_number}</span>
                      </td>
                      <td className="py-3.5 px-2 font-bold text-white">₱{p.amount?.toLocaleString()}</td>
                      <td className="py-3.5 px-2 uppercase text-slate-400">{p.payment_method?.replace('_', ' ')}</td>
                      <td className="py-3.5 px-2 font-mono text-slate-500">{p.reference_number || 'N/A'}</td>
                      <td className="py-3.5 px-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          p.payment_status === 'verified' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : p.payment_status === 'rejected'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {p.payment_status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        {p.payment_status === 'pending_verification' ? (
                          <button
                            onClick={() => setSelectedPayment(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-lg transition cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            Audit
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-semibold select-none italic">
                            Receipt: {p.official_receipt_number || 'Logged'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Audit Verification Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative z-10 glass-card animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-base font-bold text-slate-200 mb-4 border-b border-slate-850 pb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <FileCheck className="w-4.5 h-4.5 text-emerald-400" />
                Audit Hold Deposit Receipt
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Customer Name</span>
                  <span className="font-semibold text-slate-350 block mt-0.5">{selectedPayment.reservations?.profiles?.full_name || 'Guest Buyer'}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Reservation code</span>
                  <span className="font-mono text-emerald-400 font-bold block mt-0.5">{selectedPayment.reservations?.reservation_code}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Property details</span>
                  <span className="font-semibold text-slate-350 block mt-0.5">
                    {selectedPayment.reservations?.properties?.property_code} (B{selectedPayment.reservations?.properties?.block_number} L{selectedPayment.reservations?.properties?.lot_number})
                  </span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Hold deposit amount</span>
                  <span className="font-bold text-white block mt-0.5">₱{selectedPayment.amount?.toLocaleString()}</span>
                </div>
              </div>

              <PaymentVerificationPanel plan={selectedPayment.payment_plans} />

              {/* Input for OR Number */}
              <div className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Record OR Number</label>
                  <input
                    type="text"
                    value={orNumber}
                    onChange={(e) => setOrNumber(e.target.value)}
                    placeholder="e.g. OR-789012 (Leave blank for auto-generation)"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-2.5 outline-none text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Audit internal notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter audit check verification comments..."
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-2.5 outline-none text-slate-300 resize-none"
                  />
                </div>

                <hr className="border-slate-850" />

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 text-red-400">Specify Rejection Reason (If rejecting)</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Invalid reference code or incomplete slip image."
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-red-500/50 rounded-xl p-2.5 outline-none text-slate-300"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-5 border-t border-slate-850 mt-6">
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="py-2 px-4 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold outline-none cursor-pointer"
                >
                  Close
                </button>
                <button
                  disabled={auditing}
                  onClick={() => handleRejectPayment(
                    selectedPayment.id,
                    selectedPayment.reservation_id,
                    selectedPayment.reservations?.properties?.id
                  )}
                  className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold text-xs py-2.5 px-4 rounded-xl transition outline-none cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject Receipt
                </button>
                <button
                  disabled={auditing}
                  onClick={() => handleVerifyPayment(
                    selectedPayment.id,
                    selectedPayment.reservation_id,
                    selectedPayment.reservations?.properties?.id
                  )}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs py-2.5 px-5 rounded-xl transition outline-none cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Verify Deposit
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}

function generateReceiptNumber() {
  return `OR-${Math.floor(Math.random() * 900000) + 100000}`;
}
