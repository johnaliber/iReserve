'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import { 
  Calendar, 
  Search, 
  Check, 
  X, 
  Loader2, 
  Clock, 
  User, 
  Building,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export default function VillageAdminSiteViewingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [viewings, setViewings] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Notifications
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  const fetchViewings = useCallback(async (villageId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_viewings')
        .select('*, properties(*), profiles(*)')
        .eq('village_id', villageId)
        .order('preferred_date', { ascending: true });

      if (!error && data) {
        setViewings(data);
      }
    } catch (err) {
      console.error('Error fetching viewings list:', err);
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
        await fetchViewings(vList[0].id);
      }
    } catch (err) {
      console.error('Error fetching viewing configurations:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchViewings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitData]);

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
    fetchViewings(vId);
  };

  const handleUpdateStatus = async (viewingId, newStatus) => {
    setActionMsg('');
    setActionErr('');
    try {
      const { error } = await supabase
        .from('site_viewings')
        .update({ status: newStatus })
        .eq('id', viewingId);

      if (error) throw error;

      setActionMsg(`Site viewing appointment successfully ${newStatus}!`);
      setTimeout(() => setActionMsg(''), 3000);
      fetchViewings(selectedVillageId);
    } catch (err) {
      setActionErr(err.message || 'Error updating viewing schedule.');
      setTimeout(() => setActionErr(''), 4000);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-800';
    }
  };

  // Local filter
  const filteredViewings = viewings.filter((v) => {
    const clientName = v.profiles?.full_name || v.guest_name || 'Client Visitor';
    const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.properties?.property_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? v.status === statusFilter : true;
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
              <Calendar className="w-8 h-8 text-emerald-400" />
              Site Viewing Appointments
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Verify holding client requests to physically inspect property bounds, assign sales representatives, and schedule timings.
            </p>
          </div>

          <div className="flex items-center gap-3">
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

        {/* Feedback indicators */}
        {actionMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4.5 h-4.5" />
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
              placeholder="Search visitor profiles or property codes..."
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
              <option value="">All Viewings Statuses</option>
              <option value="pending">Pending schedules</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* List of viewing logs */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card shadow">
          {loading ? (
            <div className="py-12 flex justify-center text-slate-400">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : filteredViewings.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-450">No viewing appointments booked</h4>
              <p className="text-[11px] mt-1">Clients have not scheduled physical bounds visitations in this scope.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 select-none uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Appointment date</th>
                    <th className="py-3 px-3">Preferred Time</th>
                    <th className="py-3 px-3">Visitor Info</th>
                    <th className="py-3 px-3">Property Lot</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {filteredViewings.map((v) => {
                    const clientName = v.profiles?.full_name || v.guest_name || 'Client Buyer';
                    const clientEmail = v.profiles?.email || v.guest_email || 'N/A';
                    return (
                      <tr key={v.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-3.5 px-3 font-extrabold text-white flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          {new Date(v.preferred_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-3 text-slate-300">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{v.preferred_time}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>{clientName}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{clientEmail}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <Building className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-extrabold">{v.properties?.property_code}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Block {v.properties?.block_number} Lot {v.properties?.lot_number}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full select-none ${getStatusBadge(v.status)}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {v.status === 'pending' ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleUpdateStatus(v.id, 'approved')}
                                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                                title="Approve viewing"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(v.id, 'rejected')}
                                className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold text-xs transition cursor-pointer"
                                title="Decline viewing"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-650 italic font-normal">Closed schedule</span>
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
