'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, CreditCard, FileText, Inbox, Loader2, MapPin } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/client';

const pageConfig = {
  reservations: {
    title: 'My Reservations',
    description: 'Track active and historical lot reservations from your customer account.',
    icon: Inbox,
    empty: 'No reservations found yet.'
  },
  payments: {
    title: 'Payments Ledger',
    description: 'Review reservation fee payments, proof uploads, and verification status.',
    icon: CreditCard,
    empty: 'No payment records found yet.'
  },
  documents: {
    title: 'My Documents',
    description: 'Monitor ID, income, and reservation document review status.',
    icon: FileText,
    empty: 'No documents are listed yet.'
  },
  viewings: {
    title: 'Site Viewings',
    description: 'Check requested site viewing schedules and approval status.',
    icon: Calendar,
    empty: 'No site viewings scheduled yet.'
  }
};

function StatusBadge({ status }) {
  const normalized = status || 'pending';
  const palette = {
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    reserved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
    cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
    expired: 'border-slate-200 bg-slate-50 text-slate-600',
    pending_payment: 'border-amber-200 bg-amber-50 text-amber-700',
    pending_documents: 'border-amber-200 bg-amber-50 text-amber-700',
    pending_verification: 'border-amber-200 bg-amber-50 text-amber-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700'
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${palette[normalized] || palette.pending}`}>
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function DataCard({ children }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

export default function CustomerSectionPage({ section }) {
  const supabase = createClient();
  const config = pageConfig[section] || pageConfig.reservations;
  const Icon = config.icon;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const fetchItems = useCallback(async () => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return;

      let query;
      if (section === 'reservations') {
        query = supabase
          .from('reservations')
          .select('*, properties(*, villages(*))')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });
      } else if (section === 'payments') {
        query = supabase
          .from('payments')
          .select('*, reservations(reservation_code), villages(name)')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });
      } else if (section === 'documents') {
        query = supabase
          .from('documents')
          .select('*, reservations(reservation_code)')
          .eq('customer_id', user.id)
          .order('uploaded_at', { ascending: false });
      } else {
        query = supabase
          .from('site_viewings')
          .select('*, properties(property_code, block_number, lot_number), villages(name)')
          .eq('customer_id', user.id)
          .order('preferred_date', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error(`Error loading customer ${section}:`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [section, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchItems]);

  const content = useMemo(() => {
    if (section === 'reservations') {
      return items.map((reservation) => {
        const property = reservation.properties || {};
        const village = property.villages || {};
        return (
          <DataCard key={reservation.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[#272727]">{property.property_code || reservation.reservation_code}</h2>
                  <StatusBadge status={reservation.status} />
                </div>
                <p className="mt-1 text-sm text-[#64748b]">
                  {village.name || 'Village'} - Block {property.block_number || '-'} Lot {property.lot_number || '-'}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-bold text-[#272727]">{formatMoney(reservation.reservation_fee)}</p>
                <p className="text-xs text-[#64748b]">Reserved {formatDate(reservation.reserved_at)}</p>
              </div>
            </div>
          </DataCard>
        );
      });
    }

    if (section === 'payments') {
      return items.map((payment) => (
        <DataCard key={payment.id}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#272727]">{formatMoney(payment.amount)}</h2>
                <StatusBadge status={payment.payment_status} />
              </div>
              <p className="mt-1 text-sm text-[#64748b]">
                {payment.payment_method?.replaceAll('_', ' ') || 'Payment'} - Ref: {payment.reference_number || 'N/A'}
              </p>
            </div>
            <div className="text-xs text-[#64748b] md:text-right">
              <p>{payment.villages?.name || 'Village'}</p>
              <p>{formatDate(payment.created_at)}</p>
            </div>
          </div>
        </DataCard>
      ));
    }

    if (section === 'documents') {
      return items.map((document) => (
        <DataCard key={document.id}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#272727]">{document.document_type}</h2>
                <StatusBadge status={document.status} />
              </div>
              <p className="mt-1 text-sm text-[#64748b]">Reservation: {document.reservations?.reservation_code || 'N/A'}</p>
              {document.rejection_reason && <p className="mt-2 text-xs text-rose-600">{document.rejection_reason}</p>}
            </div>
            <a
              href={document.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-xs font-bold text-[#272727] transition hover:bg-[#f8fafc]"
            >
              View File
            </a>
          </div>
        </DataCard>
      ));
    }

    return items.map((viewing) => {
      const property = viewing.properties || {};
      return (
        <DataCard key={viewing.id}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#272727]">{property.property_code || 'Site Viewing'}</h2>
                <StatusBadge status={viewing.status} />
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#64748b]">
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                {viewing.villages?.name || 'Village'} - Block {property.block_number || '-'} Lot {property.lot_number || '-'}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm font-bold text-[#272727]">{formatDate(viewing.preferred_date)}</p>
              <p className="text-xs text-[#64748b]">{viewing.preferred_time || 'Time not set'}</p>
            </div>
          </div>
        </DataCard>
      );
    });
  }, [items, section]);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold text-[#272727]">
              <Icon className="h-8 w-8 text-emerald-500" />
              {config.title}
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">{config.description}</p>
          </div>
          <Link
            href="/customer/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#272727] shadow-sm transition hover:bg-[#f8fafc]"
          >
            Back to Overview
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-10 text-center shadow-sm">
            <Icon className="mx-auto mb-4 h-10 w-10 text-[#94a3b8]" />
            <h2 className="text-lg font-extrabold text-[#272727]">{config.empty}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#64748b]">
              Any records connected to your customer account will appear here once they are created.
            </p>
          </div>
        ) : (
          <div className="space-y-3">{content}</div>
        )}
      </div>
    </DashboardShell>
  );
}
