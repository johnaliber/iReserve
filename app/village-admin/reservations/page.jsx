'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import { 
  Inbox, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink,
  Calendar,
  User,
  Coins,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function VillageAdminReservationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  
  // Search query & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Toast / Status notification
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  const fetchReservations = useCallback(async (villageId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, properties(*), profiles(*)')
        .eq('village_id', villageId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReservations(data);
      }
    } catch (err) {
      console.error('Error loading reservations:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchInitData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const vList = await getManageableVillages(supabase, user.id);
      setVillages(vList);

      if (vList.length > 0) {
        setSelectedVillageId(vList[0].id);
        await fetchReservations(vList[0].id);
      }
    } catch (err) {
      console.error('Error fetching reservations setup:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchReservations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitData]);

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
    fetchReservations(vId);
  };

  const handleUpdateStatus = async (reservationId, propertyId, newStatus) => {
    setActionMsg('');
    setActionErr('');
    try {
      const response = await fetch('/api/village-admin/reservations/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, propertyId, status: newStatus })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Error processing reservation status.');

      const deliveryNote = payload.emailSent
        ? ' Customer notification and email sent.'
        : payload.notificationCreated
          ? ' Customer in-app notification sent.'
          : '';
      setActionMsg(`Reservation successfully updated to ${newStatus.replace('_', ' ')}.${deliveryNote}`);
      setTimeout(() => setActionMsg(''), 3000);
      
      // Refresh list
      fetchReservations(selectedVillageId);
    } catch (err) {
      setActionErr(err.message || 'Error processing reservation status.');
      setTimeout(() => setActionErr(''), 4000);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'reserved':
      case 'approved':
      case 'converted_to_sale':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'pending_verification':
      case 'pending_payment':
      case 'pending_documents':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'rejected':
      case 'cancelled':
      case 'expired':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-800';
    }
  };

  // Local filter
  const filteredReservations = reservations.filter((r) => {
    const custName = r.profiles?.full_name || r.guest_name || 'Guest Client';
    const matchesSearch = r.reservation_code?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.properties?.property_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? r.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  if (loading && villages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <Inbox className="w-8 h-8 text-emerald-400" />
              Reservation Ledger
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Verify holding fee payment receipts, track ID document uploads, approve property bounds reservation holds, or release expired locks.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider select-none">Scope:</span>
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              disabled={villages.length === 0}
              className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-semibold outline-none text-slate-200 cursor-pointer shadow"
            >
              {villages.length === 0 ? (
                <option value="">No active villages found</option>
              ) : (
                villages.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Action Feedbacks Toast */}
        {actionMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5" />
            {actionMsg}
          </div>
        )}
        {actionErr && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5" />
            {actionErr}
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow glass-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by reservation code, lot code, or buyer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 outline-none placeholder-slate-650"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-350 outline-none cursor-pointer"
            >
              <option value="">All Reservation Statuses</option>
              <option value="pending_verification">Pending Audit</option>
              <option value="approved">Approved Holds</option>
              <option value="rejected">Rejected holds</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired holds</option>
            </select>
          </div>
        </div>

        {/* Table list */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card shadow">
          {loading ? (
            <div className="py-12 flex justify-center text-slate-400">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-450">No reservation holds found</h4>
              <p className="text-[11px] mt-1">No locks have been requested in this scope yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 select-none uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Booking Code</th>
                    <th className="py-3 px-3">Lot Parcel</th>
                    <th className="py-3 px-3">Buyer Profile</th>
                    <th className="py-3 px-3">Deposited Amount</th>
                    <th className="py-3 px-3">Expires At</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Verification Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {filteredReservations.map((r) => {
                    const clientName = r.profiles?.full_name || r.guest_name || 'Client Buyer';
                    const clientEmail = r.profiles?.email || r.guest_email || 'N/A';
                    return (
                      <tr key={r.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-3.5 px-3 font-extrabold text-white">
                          {r.reservation_code}
                          <span className="text-[10px] text-slate-500 block font-normal mt-0.5">
                            Reserved: {new Date(r.reserved_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-extrabold text-slate-200 block">{r.properties?.property_code}</span>
                          <span className="text-[10px] text-slate-500 block font-normal">Block {r.properties?.block_number} Lot {r.properties?.lot_number}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <User className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{clientName}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{clientEmail}</span>
                        </td>
                        <td className="py-3.5 px-3 text-white">
                          <span className="font-extrabold">?{r.reservation_fee?.toLocaleString()}</span>
                          <span className="text-[10px] text-emerald-400 block font-normal flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> Manual upload verified
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{new Date(r.expires_at).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full select-none ${getStatusBadge(r.status)}`}>
                            {r.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {r.status === 'pending_verification' || r.status === 'pending_payment' ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleUpdateStatus(r.id, r.properties?.id, 'approved')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve Hold
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(r.id, r.properties?.id, 'rejected')}
                                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-extrabold text-xs transition cursor-pointer flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-650 italic font-normal">Audit log locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardShell>
  );
}
