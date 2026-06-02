'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Home,
  Loader2,
  MapPin,
  PhilippinePeso,
  RefreshCcw,
  Search,
  TrendingUp
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/client';

const cardClass = 'rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm';
const inputClass = 'rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-sm text-[#272727] shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const STATUS_COLORS = {
  pending: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  pending_payment: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  pending_documents: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  pending_verification: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  reserved: 'border-blue-200 bg-blue-50 text-blue-700',
  sold: 'border-purple-200 bg-purple-50 text-purple-700',
  converted_to_sale: 'border-purple-200 bg-purple-50 text-purple-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-gray-200 bg-gray-50 text-gray-700',
  expired: 'border-gray-200 bg-gray-50 text-gray-700',
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unpaid: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  refunded: 'border-gray-200 bg-gray-50 text-gray-700'
};

function money(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: Number(value || 0) >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function compact(value) {
  return new Intl.NumberFormat('en-PH', { notation: 'compact' }).format(Number(value || 0));
}

function statusBadge(status) {
  const key = status || 'pending';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${STATUS_COLORS[key] || STATUS_COLORS.pending}`}>
      {key.replaceAll('_', ' ')}
    </span>
  );
}

function periodKey(dateValue, period) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  if (period === 'daily') {
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  if (period === 'weekly') {
    const first = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date - first) / 86400000) + first.getDay() + 1) / 7);
    return `W${week} ${date.getFullYear()}`;
  }

  if (period === 'yearly') {
    return String(date.getFullYear());
  }

  return date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

function KpiCard({ title, value, icon: Icon, accent = 'emerald', sub }) {
  const accentClass = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600'
  }[accent];

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#64748b]">{title}</p>
          <p className="mt-3 text-2xl font-extrabold text-[#272727]">{value}</p>
          {sub && <p className="mt-1 text-xs font-medium text-[#64748b]">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalyticsDashboard({ scope = 'global' }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    villages: [],
    properties: [],
    reservations: [],
    payments: [],
    viewings: [],
    refunds: [],
    customers: []
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      let villages = [];
      if (scope === 'village' && profile?.role !== 'super_admin') {
        const { data: assigned } = await supabase
          .from('user_villages')
          .select('village_id, villages(*)')
          .eq('user_id', user.id)
          .eq('role', 'village_admin');
        villages = (assigned || []).map((item) => item.villages).filter(Boolean);
      } else {
        const { data: allVillages } = await supabase
          .from('villages')
          .select('*')
          .order('name', { ascending: true });
        villages = allVillages || [];
      }

      const villageIds = villages.map((village) => village.id);
      const shouldScope = scope === 'village' && villageIds.length > 0;

      const propertyQuery = supabase.from('properties').select('*, villages(*)');
      const reservationQuery = supabase.from('reservations').select('*, properties(*, villages(*))').order('created_at', { ascending: false });
      const paymentQuery = supabase.from('payments').select('*, villages(*)').order('created_at', { ascending: false });
      const viewingQuery = supabase.from('site_viewings').select('*, villages(*)').order('created_at', { ascending: false });
      const refundQuery = supabase.from('refunds').select('*').order('created_at', { ascending: false });

      if (shouldScope) {
        propertyQuery.in('village_id', villageIds);
        reservationQuery.in('village_id', villageIds);
        paymentQuery.in('village_id', villageIds);
        viewingQuery.in('village_id', villageIds);
      }

      const [
        { data: properties },
        { data: reservations },
        { data: payments },
        { data: viewings },
        { data: refunds },
        { data: customers }
      ] = await Promise.all([
        propertyQuery,
        reservationQuery,
        paymentQuery,
        viewingQuery,
        refundQuery,
        supabase.from('profiles').select('id, full_name, email')
      ]);

      setData({
        villages,
        properties: properties || [],
        reservations: reservations || [],
        payments: payments || [],
        viewings: viewings || [],
        refunds: refunds || [],
        customers: customers || []
      });
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [scope, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDashboardData]);

  const customerById = useMemo(() => new Map(data.customers.map((customer) => [customer.id, customer])), [data.customers]);
  const verifiedRevenue = data.payments
    .filter((payment) => payment.payment_status === 'verified')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const soldLots = data.properties.filter((property) => property.status === 'sold');
  const pendingReservations = data.reservations.filter((reservation) => reservation.status?.startsWith('pending')).length;
  const approvedReservations = data.reservations.filter((reservation) => ['approved', 'reserved'].includes(reservation.status)).length;
  const pendingPayments = data.payments.filter((payment) => ['unpaid', 'pending_verification', 'overdue'].includes(payment.payment_status)).length;
  const pendingViewings = data.viewings.filter((viewing) => viewing.status === 'pending').length;
  const refundRequests = data.refunds.filter((refund) => ['requested', 'approved'].includes(refund.status)).length;

  const salesData = useMemo(() => {
    const grouped = new Map();
    data.payments
      .filter((payment) => payment.payment_status === 'verified')
      .forEach((payment) => {
        const key = periodKey(payment.created_at, period);
        const current = grouped.get(key) || { label: key, revenue: 0, sales: 0 };
        current.revenue += Number(payment.amount || 0);
        current.sales += 1;
        grouped.set(key, current);
      });
    return Array.from(grouped.values()).slice(-12);
  }, [data.payments, period]);

  const villagePerformance = useMemo(() => {
    return data.villages.map((village) => {
      const villagePayments = data.payments.filter((payment) => payment.village_id === village.id && payment.payment_status === 'verified');
      return {
        village: village.name,
        revenue: villagePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        reservations: data.reservations.filter((reservation) => reservation.village_id === village.id).length,
        soldLots: data.properties.filter((property) => property.village_id === village.id && property.status === 'sold').length
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [data]);

  const lotAvailability = [
    { name: 'Available', value: data.properties.filter((p) => p.status === 'available').length, color: '#10b981' },
    { name: 'Reserved', value: data.properties.filter((p) => p.status === 'reserved').length, color: '#3b82f6' },
    { name: 'Sold', value: soldLots.length, color: '#8b5cf6' },
    { name: 'Under Construction', value: data.properties.filter((p) => p.status === 'under_maintenance').length, color: '#f59e0b' },
    { name: 'Not Available', value: data.properties.filter((p) => p.status === 'hidden').length, color: '#64748b' }
  ];

  const filteredReservations = data.reservations.filter((reservation) => {
    const property = reservation.properties || {};
    const customer = customerById.get(reservation.customer_id);
    const text = [
      reservation.reservation_code,
      reservation.guest_name,
      customer?.full_name,
      property.property_code,
      property.villages?.name,
      property.block_number,
      property.lot_number
    ].join(' ').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredReservations.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedReservations = filteredReservations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[520px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">
              {scope === 'village' ? 'Assigned Village Reports' : 'Multi-Village Portfolio'}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#272727]">Admin Dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#64748b]">
              Monitor villages, inventory, reservations, payments, approvals, and sales performance from one operational command center.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-sm font-bold text-[#272727] shadow-sm transition hover:bg-[#f8fafc]"
          >
            <RefreshCcw className="h-4 w-4 text-emerald-600" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Total Sales" value={compact(soldLots.length)} icon={TrendingUp} accent="purple" sub="Sold lots" />
          <KpiCard title="Total Revenue" value={money(verifiedRevenue)} icon={PhilippinePeso} accent="emerald" sub="Verified payments" />
          <KpiCard title="Pending Reservations" value={compact(pendingReservations)} icon={Clock} accent="yellow" />
          <KpiCard title="Approved Reservations" value={compact(approvedReservations)} icon={CheckCircle2} accent="emerald" />
          <KpiCard title="Available Lots" value={compact(lotAvailability[0].value)} icon={Home} accent="blue" />
          <KpiCard title="Reserved Lots" value={compact(lotAvailability[1].value)} icon={MapPin} accent="blue" />
          <KpiCard title="Sold Lots" value={compact(lotAvailability[2].value)} icon={TrendingUp} accent="purple" />
          <KpiCard title="Pending Payments" value={compact(pendingPayments)} icon={CreditCard} accent="yellow" />
          <KpiCard title="Site Viewing Requests" value={compact(pendingViewings)} icon={CalendarCheck} accent="blue" />
          <KpiCard title="Cancellation / Refund Requests" value={compact(refundRequests)} icon={RefreshCcw} accent="red" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className={`${cardClass} xl:col-span-2`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[#272727]">Sales Overview</h2>
                <p className="text-sm text-[#64748b]">Verified revenue grouped by selected period.</p>
              </div>
              <select className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => compact(value)} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-extrabold text-[#272727]">Lot Availability</h2>
            <p className="text-sm text-[#64748b]">Inventory by property status.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={lotAvailability} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3}>
                    {lotAvailability.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {lotAvailability.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-[#64748b]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-extrabold text-[#272727]">{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className={cardClass}>
          <div className="mb-5">
            <h2 className="text-lg font-extrabold text-[#272727]">Village Performance</h2>
            <p className="text-sm text-[#64748b]">
              {scope === 'village' ? 'Performance for your assigned village scope.' : 'Revenue, reservations, and sold lots across villages.'}
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={villagePerformance} layout="vertical" margin={{ left: 24, right: 24 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(value) => compact(value)} />
                <YAxis type="category" dataKey="village" stroke="#64748b" fontSize={12} width={160} />
                <Tooltip formatter={(value, name) => name === 'revenue' ? money(value) : value} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[0, 8, 8, 0]} />
                <Bar dataKey="reservations" fill="#10b981" radius={[0, 8, 8, 0]} />
                <Bar dataKey="soldLots" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#272727]">Recent Reservations</h2>
              <p className="text-sm text-[#64748b]">{filteredReservations.length} search result{filteredReservations.length === 1 ? '' : 's'}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className={`${inputClass} pl-9`}
                  placeholder="Search reservations"
                />
              </label>
              <Link
                href="/village-admin/reservations"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500"
              >
                View All
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-y border-[#e2e8f0] bg-[#f8fafc] text-xs font-extrabold uppercase tracking-wider text-[#64748b]">
                  <th className="px-3 py-3">Reservation ID</th>
                  <th className="px-3 py-3">Customer Name</th>
                  <th className="px-3 py-3">Village</th>
                  <th className="px-3 py-3">Phase</th>
                  <th className="px-3 py-3">Block</th>
                  <th className="px-3 py-3">Lot</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Payment Status</th>
                  <th className="px-3 py-3">Reservation Status</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {paginatedReservations.map((reservation) => {
                  const property = reservation.properties || {};
                  const customer = customerById.get(reservation.customer_id);
                  const latestPayment = data.payments.find((payment) => payment.reservation_id === reservation.id);
                  return (
                    <tr key={reservation.id} className="transition hover:bg-[#f8fafc]">
                      <td className="px-3 py-4 font-mono text-xs font-bold text-[#272727]">{reservation.reservation_code}</td>
                      <td className="px-3 py-4 text-[#272727]">{customer?.full_name || reservation.guest_name || 'Guest Customer'}</td>
                      <td className="px-3 py-4 text-[#64748b]">{property.villages?.name || 'Unassigned'}</td>
                      <td className="px-3 py-4 text-[#64748b]">{property.street_name || property.model_name || 'Phase 1'}</td>
                      <td className="px-3 py-4 text-[#64748b]">{property.block_number || '-'}</td>
                      <td className="px-3 py-4 text-[#64748b]">{property.lot_number || '-'}</td>
                      <td className="px-3 py-4 font-bold text-[#272727]">{money(reservation.reservation_fee)}</td>
                      <td className="px-3 py-4">{statusBadge(latestPayment?.payment_status || 'unpaid')}</td>
                      <td className="px-3 py-4">{statusBadge(reservation.status)}</td>
                      <td className="px-3 py-4 text-[#64748b]">{new Date(reservation.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-4 text-right">
                        <Link href="/village-admin/reservations" className="font-extrabold text-emerald-600 hover:text-emerald-500">
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {paginatedReservations.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-12 text-center text-[#64748b]">
                      No reservations match the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#64748b]">
              Page {currentPage} of {pageCount}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-sm font-bold text-[#272727] disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={currentPage === pageCount}
                className="rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-sm font-bold text-[#272727] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
