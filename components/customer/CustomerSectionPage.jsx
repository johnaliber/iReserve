'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar,
  CreditCard,
  Eye,
  FileText,
  Inbox,
  MapPin,
  Plus,
  ReceiptText,
  X
} from 'lucide-react';
import CustomerShell from '@/components/customer/CustomerShell';
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog';
import DelayedLoadingState from '@/components/shared/DelayedLoadingState';
import EmptyState from '@/components/shared/EmptyState';
import FriendlyStatusBadge from '@/components/customer/FriendlyStatusBadge';
import { createClient } from '@/lib/supabase/client';
import AvailabilityCalendar, { toDateKey } from '@/components/site-viewings/AvailabilityCalendar';

const pageConfig = {
  reservations: {
    title: 'My Reservations',
    description: 'View your reserved lots, current status, and payment details.',
    icon: Inbox,
    empty: 'No reservations found yet.'
  },
  payments: {
    title: 'My Payments',
    description: 'See your submitted receipts and whether Accounting has reviewed them.',
    icon: CreditCard,
    empty: 'No payment records found yet.'
  },
  documents: {
    title: 'My Documents',
    description: 'Check which documents were received, approved, or need to be uploaded again.',
    icon: FileText,
    empty: 'No documents are listed yet.'
  },
  viewings: {
    title: 'Site Viewing',
    description: 'Request a visit and check whether your preferred schedule is approved.',
    icon: Calendar,
    empty: 'No site viewings scheduled yet.'
  }
};

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

function formatDateTime(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatTime(value) {
  if (!value) return 'Time not set';
  const [hours, minutes] = value.split(':');
  const date = new Date();
  date.setHours(Number(hours), Number(minutes));
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function timeSlots(startTime, endTime, intervalMinutes = 15) {
  if (!startTime || !endTime) return [];

  const [startHour, startMinute] = startTime.slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = endTime.slice(0, 5).split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const slots = [];

  for (let minutes = start; minutes < end; minutes += intervalMinutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
    const minute = String(minutes % 60).padStart(2, '0');
    slots.push(`${hour}:${minute}`);
  }

  return slots;
}

function bookingSummary(dateValue, timeValue) {
  if (!dateValue || !timeValue) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  return `${date.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })} at ${formatTime(timeValue)}`;
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
  const [reservations, setReservations] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showViewingForm, setShowViewingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [viewingAvailability, setViewingAvailability] = useState([]);
  const [formError, setFormError] = useState('');
  const [confirmViewing, setConfirmViewing] = useState(false);
  const [viewingForm, setViewingForm] = useState({
    reservationId: '',
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });

  const fetchViewingAvailability = useCallback(async (villageId) => {
    if (!villageId) {
      setViewingAvailability([]);
      return;
    }

    setLoadingAvailability(true);
    try {
      const { data, error } = await supabase
        .from('site_viewing_availability')
        .select('*')
        .eq('village_id', villageId)
        .gte('available_date', toDateKey(new Date()))
        .order('available_date', { ascending: true });

      if (error) throw error;
      setViewingAvailability(data || []);
    } finally {
      setLoadingAvailability(false);
    }
  }, [supabase]);

  const fetchItems = useCallback(async () => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return;

      const claimResponse = await fetch('/api/customer/claim-reservations', {
        method: 'POST'
      });
      if (!claimResponse.ok) {
        console.error('Guest reservations could not be linked to this customer account.');
      }

      let query;
      if (section === 'reservations') {
        query = supabase
          .from('reservations')
          .select('*, properties(*, villages(*)), payment_plans(interest_rate, monthly_payment, installment_term_months)')
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
          .select('*, properties(block_number, lot_number), villages(name)')
          .eq('customer_id', user.id)
          .order('preferred_date', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);

      if (section === 'viewings') {
        const { data: reservationRows, error: reservationError } = await supabase
          .from('reservations')
          .select('id, reservation_code, village_id, property_id, properties(block_number, lot_number, villages(name))')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (reservationError) throw reservationError;
        setReservations(reservationRows || []);
        setViewingForm((current) => ({
          ...current,
          reservationId: current.reservationId || reservationRows?.[0]?.id || ''
        }));
        await fetchViewingAvailability(reservationRows?.[0]?.village_id);
      }
    } catch (err) {
      console.error(`Error loading customer ${section}:`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchViewingAvailability, section, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchItems]);

  const validateViewingRequest = () => {
    setFormError('');

    const reservation = reservations.find((row) => row.id === viewingForm.reservationId);
    if (!reservation) {
      setFormError('Select a reservation to request a viewing.');
      return false;
    }

    const selectedAvailability = viewingAvailability.find((item) => item.available_date === viewingForm.preferredDate);
    if (!selectedAvailability) {
      setFormError('Choose one of the available dates from the calendar.');
      return false;
    }
    if (
      viewingForm.preferredTime < selectedAvailability.start_time.slice(0, 5)
      || viewingForm.preferredTime >= selectedAvailability.end_time.slice(0, 5)
    ) {
      setFormError('Choose a time within the available viewing hours.');
      return false;
    }
    return true;
  };

  const handleViewingRequest = async () => {
    const reservation = reservations.find((row) => row.id === viewingForm.reservationId);
    if (!reservation || !validateViewingRequest()) return;
    setSubmitting(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/customer/site-viewings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: reservation.id,
          preferredDate: viewingForm.preferredDate,
          preferredTime: viewingForm.preferredTime,
          notes: viewingForm.notes.trim()
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The site viewing request could not be submitted.');

      setShowViewingForm(false);
      setConfirmViewing(false);
      setViewingForm((current) => ({
        reservationId: current.reservationId,
        preferredDate: '',
        preferredTime: '',
        notes: ''
      }));
      await fetchItems();
      await fetchViewingAvailability(reservation.village_id);
    } catch (err) {
      setFormError(err.message || 'The site viewing request could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

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
                  <h2 className="text-lg font-extrabold text-[#272727]">
                    Block {property.block_number || '-'} Lot {property.lot_number || '-'}
                  </h2>
                  <FriendlyStatusBadge status={reservation.status} />
                </div>
                <p className="mt-1 text-sm text-[#64748b]">
                  {village.name || 'Village'} - Block {property.block_number || '-'} Lot {property.lot_number || '-'}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-bold text-[#272727]">{formatMoney(reservation.reservation_fee)}</p>
                <p className="text-xs text-[#64748b]">Reserved {formatDate(reservation.reserved_at)}</p>
                <button
                  type="button"
                  onClick={() => setSelectedItem(reservation)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs font-bold text-[#272727] transition hover:bg-[#f8fafc]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </button>
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
                <FriendlyStatusBadge status={payment.payment_status} />
              </div>
              <p className="mt-1 text-sm text-[#64748b]">
                {payment.payment_method?.replaceAll('_', ' ') || 'Payment'} - Ref: {payment.reference_number || 'N/A'}
              </p>
            </div>
            <div className="text-xs text-[#64748b] md:text-right">
              <p>{payment.villages?.name || 'Village'}</p>
              <p>{formatDate(payment.created_at)}</p>
              <button
                type="button"
                onClick={() => setSelectedItem(payment)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4ee] px-3 py-2 font-bold text-[#272727] transition hover:bg-[#f8fafc]"
              >
                <ReceiptText className="h-3.5 w-3.5" />
                View Receipt
              </button>
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
                <FriendlyStatusBadge status={document.status} />
              </div>
              <p className="mt-1 text-sm text-[#64748b]">Reservation: {document.reservations?.reservation_code || 'N/A'}</p>
              {document.rejection_reason && <p className="mt-2 text-xs text-rose-600">{document.rejection_reason}</p>}
            </div>
            <button
              type="button"
              onClick={() => setSelectedItem(document)}
              className="inline-flex items-center justify-center rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-xs font-bold text-[#272727] transition hover:bg-[#f8fafc]"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview Image
            </button>
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
                <h2 className="text-lg font-extrabold text-[#272727]">
                  Block {property.block_number || '-'} Lot {property.lot_number || '-'}
                </h2>
                <FriendlyStatusBadge status={viewing.status} />
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#64748b]">
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                {viewing.villages?.name || 'Village'} - Block {property.block_number || '-'} Lot {property.lot_number || '-'}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm font-bold text-[#272727]">{formatDate(viewing.preferred_date)}</p>
              <p className="text-xs text-[#64748b]">{formatTime(viewing.preferred_time)}</p>
            </div>
          </div>
        </DataCard>
      );
    });
  }, [items, section]);

  if (loading) {
    return (
      <CustomerShell>
        <DelayedLoadingState loading message={`Loading ${config.title.toLowerCase()}...`} />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold text-[#272727]">
              <Icon className="h-8 w-8 text-emerald-500" />
              {config.title}
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">{config.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {section === 'viewings' && (
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setShowViewingForm(true);
                }}
                disabled={reservations.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Request Site Viewing
              </button>
            )}
            <Link
              href="/customer/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#272727] shadow-sm transition hover:bg-[#f8fafc]"
            >
              Back to Overview
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={config.empty}
            description="Information connected to your account will appear here automatically."
            actionLabel={section === 'reservations' ? 'Browse Villages' : undefined}
            actionHref={section === 'reservations' ? '/villages' : undefined}
          />
        ) : (
          <div className="space-y-3">{content}</div>
        )}
      </div>

      {showViewingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <form onSubmit={(event) => { event.preventDefault(); if (validateViewingRequest()) setConfirmViewing(true); }} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Appointment Request</p>
                <h2 className="text-xl font-extrabold text-[#272727]">Request a Site Viewing</h2>
              </div>
              <button type="button" onClick={() => setShowViewingForm(false)} className="rounded-full p-2 text-[#64748b] hover:bg-[#f1f5f9]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-xs font-bold text-[#475569]">
                Reserved Property
                <select
                  required
                  value={viewingForm.reservationId}
                  onChange={async (event) => {
                    const reservationId = event.target.value;
                    const reservation = reservations.find((row) => row.id === reservationId);
                    setViewingForm((current) => ({
                      ...current,
                      reservationId,
                      preferredDate: '',
                      preferredTime: ''
                    }));
                    setFormError('');
                    await fetchViewingAvailability(reservation?.village_id);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm text-[#272727] outline-none focus:border-emerald-500"
                >
                  {reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      Block {reservation.properties?.block_number || '-'} Lot {reservation.properties?.lot_number || '-'} - {reservation.properties?.villages?.name || 'Village'}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-1.5 text-xs font-bold text-[#475569]">Choose an Available Date</p>
                {loadingAvailability ? (
                  <div className="flex min-h-72 items-center justify-center rounded-2xl border border-[#e2e8f0]">
                    <DelayedLoadingState loading delay={1000} message="Loading available viewing dates..." />
                  </div>
                ) : (
                  <div className="grid overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm md:grid-cols-[1fr_180px]">
                    <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                      <AvailabilityCalendar
                        availableDates={viewingAvailability}
                        selectedDate={viewingForm.preferredDate}
                        onSelect={(date) => {
                          const availableDay = viewingAvailability.find((item) => item.available_date === date);
                          const slots = timeSlots(availableDay?.start_time, availableDay?.end_time);
                          setViewingForm((current) => ({
                            ...current,
                            preferredDate: date,
                            preferredTime: slots[0] || ''
                          }));
                          setFormError('');
                        }}
                      />
                    </div>
                    <div className="border-t border-[#e2e8f0] p-3 md:border-l md:border-t-0">
                      <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                        Available Times
                      </p>
                      {viewingForm.preferredDate ? (
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {timeSlots(
                            viewingAvailability.find((item) => item.available_date === viewingForm.preferredDate)?.start_time,
                            viewingAvailability.find((item) => item.available_date === viewingForm.preferredDate)?.end_time
                          ).map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => {
                                setViewingForm((current) => ({ ...current, preferredTime: time }));
                                setFormError('');
                              }}
                              className={`w-full rounded-xl border px-3 py-2.5 text-sm font-extrabold transition ${
                                viewingForm.preferredTime === time
                                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100'
                                  : 'border-[#dbe4ee] bg-white text-[#272727] hover:border-emerald-300 hover:bg-emerald-50'
                              }`}
                            >
                              {formatTime(time)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-48 items-center justify-center px-3 text-center text-sm font-medium text-[#52635b]">
                          Select an available date to view times.
                        </div>
                      )}
                    </div>
                    <div className="border-t border-[#e2e8f0] bg-[#fafafa] px-5 py-4 md:col-span-2">
                      {viewingForm.preferredDate && viewingForm.preferredTime ? (
                        <p className="text-sm text-[#272727]">
                          Your site viewing is scheduled for{' '}
                          <strong>{bookingSummary(viewingForm.preferredDate, viewingForm.preferredTime)}.</strong>
                        </p>
                      ) : (
                        <p className="text-sm text-[#64748b]">Select a date and time for your site viewing.</p>
                      )}
                    </div>
                  </div>
                )}
                {!loadingAvailability && viewingAvailability.length === 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                    The admin has not published any viewing dates for this village yet.
                  </p>
                )}
              </div>
              <label className="block text-xs font-bold text-[#475569]">
                Notes (optional)
                <textarea
                  rows={3}
                  value={viewingForm.notes}
                  onChange={(event) => setViewingForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Add access needs, questions, or preferred instructions."
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm text-[#272727] outline-none focus:border-emerald-500"
                />
              </label>
              {formError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{formError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] p-4">
              <button type="button" onClick={() => setShowViewingForm(false)} className="rounded-xl border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#272727]">
                Cancel
              </button>
              <button disabled={submitting} type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Request Site Viewing'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedItem && section === 'reservations' && (() => {
        const plan = Array.isArray(selectedItem.payment_plans)
          ? selectedItem.payment_plans[0]
          : selectedItem.payment_plans;
        const interestRate = plan?.interest_rate ?? selectedItem.properties?.interest_rate ?? 0;
        const monthlyPayment = plan?.monthly_payment ?? selectedItem.monthly_payment;
        const termMonths = plan?.installment_term_months ?? selectedItem.installment_term_months;
        const isFullPayment = selectedItem.payment_type === 'full_payment';
        return (
          <DetailModal title="Reservation Details" eyebrow={selectedItem.reservation_code} onClose={() => setSelectedItem(null)}>
            <DetailGrid rows={[
              ['Property', `Block ${selectedItem.properties?.block_number || '-'}, Lot ${selectedItem.properties?.lot_number || '-'}`],
              ['Village', selectedItem.properties?.villages?.name || 'N/A'],
              ['Status', selectedItem.status?.replaceAll('_', ' ')],
              ['Reservation Fee', formatMoney(selectedItem.reservation_fee)],
              ['Reserved On', formatDateTime(selectedItem.reserved_at)],
              ['Expires On', formatDateTime(selectedItem.expires_at)],
              ['Payment Type', selectedItem.payment_type?.replaceAll('_', ' ') || 'Not set'],
              ['Contract Price', formatMoney(selectedItem.total_contract_price || selectedItem.properties?.price)],
              ['Interest Rate', isFullPayment ? 'Not applicable' : `${Number(interestRate)}% per annum`],
              ['Monthly Payment', isFullPayment ? 'Not applicable' : (monthlyPayment ? formatMoney(monthlyPayment) : 'N/A')],
              ['Installment Term', isFullPayment ? 'Not applicable' : (termMonths ? `${termMonths} months (${Math.round(termMonths / 12)} years)` : 'N/A')],
              ['Amount Paid', formatMoney(selectedItem.amount_paid)],
              ['Remaining Balance', formatMoney(selectedItem.remaining_balance)]
            ]} />
          </DetailModal>
        );
      })()}

      {selectedItem && section === 'payments' && (
        <DetailModal title="Payment Receipt" eyebrow={selectedItem.official_receipt_number || 'Customer Payment Copy'} onClose={() => setSelectedItem(null)}>
          <div className="relative overflow-hidden rounded-2xl border border-[#e2e8f0] p-5">
          <Image src="/brand/ireserve-logo.png" alt="" width={420} height={270} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-3/4 -translate-x-1/2 -translate-y-1/2 opacity-[0.045]" />
          <div className="relative border-y border-dashed border-[#cbd5e1] py-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#64748b]">Amount Paid</p>
            <p className="mt-1 text-4xl font-extrabold text-[#272727]">{formatMoney(selectedItem.accepted_amount || selectedItem.amount)}</p>
            <div className="mt-3 flex justify-center"><FriendlyStatusBadge status={selectedItem.payment_status} /></div>
          </div>
          <div className="relative mt-4"><DetailGrid rows={[
            ['Receipt No.', selectedItem.official_receipt_number || 'Pending issuance'],
            ['Reservation', selectedItem.reservations?.reservation_code || 'N/A'],
            ['Village', selectedItem.villages?.name || 'N/A'],
            ['Payment For', selectedItem.payment_purpose?.replaceAll('_', ' ') || 'Reservation payment'],
            ['Method', selectedItem.payment_method?.replaceAll('_', ' ') || 'N/A'],
            ['Reference', selectedItem.reference_number || 'N/A'],
            ['Transaction Date', formatDateTime(selectedItem.created_at)],
            ['Verified Date', formatDateTime(selectedItem.verified_at)]
          ]} /></div>
          <p className="rounded-xl bg-[#f8fafc] p-3 text-center text-[10px] text-[#64748b]">
            This is an electronic customer copy of the payment record stored in iReserve.
          </p>
          </div>
        </DetailModal>
      )}

      {selectedItem && section === 'documents' && (
        <DetailModal title={selectedItem.document_type} eyebrow="Document Preview" onClose={() => setSelectedItem(null)} wide>
          <div className="relative min-h-[55vh] overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
            <Image
              src={selectedItem.file_url}
              alt={`${selectedItem.document_type} preview`}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        </DetailModal>
      )}
      <ConfirmActionDialog
        open={confirmViewing}
        title="Request Site Viewing?"
        message="Your selected date and time will be sent for review. You will be notified once approved."
        cancelLabel="Cancel"
        confirmLabel="Send Request"
        busy={submitting}
        onCancel={() => setConfirmViewing(false)}
        onConfirm={handleViewingRequest}
      />
    </CustomerShell>
  );
}

function DetailGrid({ rows }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-[#f8fafc] p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">{label}</dt>
          <dd className="mt-1 text-sm font-bold capitalize text-[#272727]">{value || 'N/A'}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailModal({ title, eyebrow, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">{eyebrow}</p>
            <h2 className="text-xl font-extrabold text-[#272727]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#64748b] hover:bg-[#f1f5f9]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  );
}
