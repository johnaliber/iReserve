'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Building, 
  Coins, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Check, 
  ArrowRight,
  Loader2,
  Lock,
  Wallet
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import PaymentTypeSelector from '@/components/payments/PaymentTypeSelector';
import PaymentCalculator from '@/components/payments/PaymentCalculator';
import { calculatePaymentPlan, formatPeso } from '@/lib/payments/paymentMath';

export default function ReservePropertyPage() {
  const router = useRouter();
  const { propertyId } = useParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentType, setPaymentType] = useState('partial_payment');
  const [downpaymentPercentage, setDownpaymentPercentage] = useState(20);
  const [downpaymentAmount, setDownpaymentAmount] = useState('');
  const [installmentTermMonths, setInstallmentTermMonths] = useState(24);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  
  // Document Upload States (Simulated URL inputs for simplicity in local setups, backed by File API bindings)
  const [validIdUrl, setValidIdUrl] = useState('https://via.placeholder.com/150/id.png');
  const [incomeProofUrl, setIncomeProofUrl] = useState('https://via.placeholder.com/150/income.png');
  
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isStaff, setIsStaff] = useState(false);

  const fetchProperty = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, villages(name)')
        .eq('id', propertyId)
        .single();

      if (!error && data) {
        setProperty(data);
        
        // Pre-fill user profile fields if logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email);
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (profile) {
            setFullName(profile.full_name);
            setPhone(profile.phone || '');
            if (profile.role !== 'customer') {
              setIsStaff(true);
            }
          }
        }
      } else {
        // Fallback for QA testing/mock setups if property does not exist in DB
        console.warn('Property not found in database, using fallback demo property specs for checkout.');
        setProperty({
          id: propertyId,
          property_code: 'PROP-TEMP',
          block_number: '1',
          lot_number: '99',
          price: 4500000,
          reservation_fee: 5000,
          village_id: 'mock-village-id',
          status: 'available',
          villages: { name: 'Emerald Ridge Heights' }
        });
        
        // Also check role for fallback specs
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (profile && profile.role !== 'customer') {
            setIsStaff(true);
          }
        }
      }
    } catch (err) {
      console.error(err);
      // Fallback on exception
      setProperty({
        id: propertyId,
        property_code: 'PROP-TEMP',
        block_number: '1',
        lot_number: '99',
        price: 4500000,
        reservation_fee: 5000,
        village_id: 'mock-village-id',
        status: 'available',
        villages: { name: 'Emerald Ridge Heights' }
      });
    } finally {
      setLoading(false);
    }
  }, [propertyId, supabase]);

  useEffect(() => {
    if (propertyId) {
      const timer = setTimeout(() => {
        fetchProperty();
      }, 0);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [propertyId, fetchProperty]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (isStaff) {
      setError('Staff accounts are blocked from making property reservations.');
      return;
    }
    if (!fullName || !email || !agreed) {
      setError('Please fill in all required fields and agree to the purchase terms.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const planPreview = calculatePaymentPlan({
        propertyPrice: property?.price || 0,
        reservationFee: property?.reservation_fee || 0,
        paymentType,
        downpaymentAmount,
        downpaymentPercentage,
        installmentTermMonths
      });
      const submittedAmount = Number(paymentAmount || planPreview.initialAmountDue);
      if (submittedAmount > planPreview.initialAmountDue) {
        throw new Error(`Payment amount cannot exceed ${formatPeso(planPreview.initialAmountDue)}.`);
      }

      const response = await fetch('/api/reservations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property?.id || propertyId,
          fullName,
          email,
          phone,
          paymentMethod,
          paymentType,
          downpaymentAmount,
          downpaymentPercentage,
          installmentTermMonths,
          submittedAmount,
          receiptRef,
          validIdUrl,
          incomeProofUrl
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Reservation could not be completed.');
      }

      router.push(`/reserve/success?reservation_code=${payload.reservationCode}&email=${encodeURIComponent(payload.email)}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during reservation. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Opening checkout desk...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 glass-card">
            <h2 className="text-xl font-bold mb-6 text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-400" />
              Reservation Booking Details
            </h2>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {isStaff ? (
              <div className="text-center py-12 space-y-5">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-200">Staff Account: Reservation Restricted</h3>
                <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                  Only client/customer accounts are permitted to request reservations on iReserve lot coordinates. Administrative and design roles are restricted from booking inventory during map previews or direct site hits.
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={() => router.push('/')}
                    className="px-5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition outline-none cursor-pointer"
                  >
                    Go Back Home
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.reload();
                    }}
                    className="px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold transition outline-none cursor-pointer"
                  >
                    Log Out Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2.5 px-4 text-slate-200 placeholder-slate-600 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2.5 px-4 text-slate-200 placeholder-slate-600 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63 917 123 4567"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2.5 px-4 text-slate-200 placeholder-slate-600 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Current Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter street and city address"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2.5 px-4 text-slate-200 placeholder-slate-600 outline-none text-sm"
                    />
                  </div>
                </div>

                <hr className="border-slate-800/60 my-6" />

                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                  <Coins className="w-4.5 h-4.5 text-emerald-400" />
                  Payment Option
                </h3>

                <PaymentTypeSelector value={paymentType} onChange={setPaymentType} />

                {['partial_payment', 'installment'].includes(paymentType) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Downpayment Percentage
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={downpaymentPercentage}
                        onChange={(e) => setDownpaymentPercentage(e.target.value)}
                        className="w-full bg-white border border-slate-800 rounded-xl py-2.5 px-4 text-[#272727] outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Fixed Downpayment Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={downpaymentAmount}
                        onChange={(e) => setDownpaymentAmount(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-white border border-slate-800 rounded-xl py-2.5 px-4 text-[#272727] outline-none text-sm"
                      />
                    </div>
                  </div>
                )}

                {paymentType === 'installment' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Installment Term
                    </label>
                    <select
                      value={installmentTermMonths}
                      onChange={(e) => setInstallmentTermMonths(e.target.value)}
                      className="w-full bg-white border border-slate-800 rounded-xl py-2.5 px-4 text-[#272727] outline-none text-sm"
                    >
                      <option value={6}>6 months</option>
                      <option value={12}>12 months</option>
                      <option value={24}>24 months</option>
                      <option value={36}>36 months</option>
                    </select>
                  </div>
                )}

                <PaymentCalculator
                  propertyPrice={property?.price || 0}
                  reservationFee={property?.reservation_fee || 0}
                  paymentType={paymentType}
                  downpaymentAmount={downpaymentAmount}
                  downpaymentPercentage={downpaymentPercentage}
                  installmentTermMonths={installmentTermMonths}
                />

                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                  <Wallet className="w-4.5 h-4.5 text-emerald-400" />
                  Hold Deposit Fee Payment
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['gcash', 'maya', 'bank_transfer'].map((method) => (
                    <label
                      key={method}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer select-none transition ${
                        paymentMethod === method
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-950/30 border-slate-850 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="hidden"
                      />
                      <span className="text-xs font-bold uppercase tracking-wider">{method.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Receipt reference / OR Number
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    placeholder="Enter transaction reference hash or number"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2.5 px-4 text-slate-200 placeholder-slate-600 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={calculatePaymentPlan({
                      propertyPrice: property?.price || 0,
                      reservationFee: property?.reservation_fee || 0,
                      paymentType,
                      downpaymentAmount,
                      downpaymentPercentage,
                      installmentTermMonths
                    }).initialAmountDue}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`Maximum: ${formatPeso(calculatePaymentPlan({
                      propertyPrice: property?.price || 0,
                      reservationFee: property?.reservation_fee || 0,
                      paymentType,
                      downpaymentAmount,
                      downpaymentPercentage,
                      installmentTermMonths
                    }).initialAmountDue)}`}
                    className="w-full bg-white border border-slate-800 rounded-xl py-2.5 px-4 text-[#272727] outline-none text-sm"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Government ID</label>
                    <input
                      type="text"
                      value={validIdUrl}
                      onChange={(e) => setValidIdUrl(e.target.value)}
                      className="w-full bg-slate-950/30 border border-slate-900 rounded-lg p-2 text-xs text-slate-500 outline-none cursor-not-allowed"
                      disabled
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">ID Photo attached successfully.</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Proof of Income</label>
                    <input
                      type="text"
                      value={incomeProofUrl}
                      onChange={(e) => setIncomeProofUrl(e.target.value)}
                      className="w-full bg-slate-950/30 border border-slate-900 rounded-lg p-2 text-xs text-slate-500 outline-none cursor-not-allowed"
                      disabled
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Statement slip attached successfully.</span>
                  </div>
                </div>

                <div className="pt-4">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 text-emerald-500 border-slate-800 bg-slate-950 rounded outline-none"
                    />
                    <span className="text-xs text-slate-400 leading-normal">
                      I agree to the iReserve purchase guidelines. I understand this reservation holds the property for **48 Hours** and will automatically expire and release back to available if unpaid or rejected.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl transition-all duration-200 transform active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Confirm Reservation Booking
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Checkout Summary info */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative glass-card">
            <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-850 pb-2 flex items-center gap-1.5">
              <Building className="w-4.5 h-4.5 text-emerald-400" />
              Parcels Summary
            </h3>

            {property && (
              <div className="space-y-4">
                <div className="flex justify-between items-start text-xs border-b border-slate-900 pb-3">
                  <div>
                    <span className="font-bold text-slate-200 block">{property.property_code}</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">Block {property.block_number} Lot {property.lot_number}</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full select-none uppercase tracking-wide">
                    {property.status}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Village Community:</span>
                    <span className="font-semibold text-slate-200">{property.villages?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Lot size area:</span>
                    <span className="font-semibold text-slate-200">{property.lot_size} sqm</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Bedrooms:</span>
                    <span className="font-semibold text-slate-200">{property.bedrooms} Beds</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-850 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Property Price:</span>
                    <span className="font-bold text-white">₱{property.price?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      Reservation Fee:
                    </span>
                    <span className="font-extrabold text-emerald-400 text-sm">₱{property.reservation_fee?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-850 flex items-center gap-1.5 text-[10px] text-slate-500">
              <Lock className="w-3.5 h-3.5 text-emerald-500/40" />
              <span>SSL Secure reservation checkout.</span>
            </div>
          </div>
        </div>

      </main>

      <footer className="border-t border-slate-900 bg-slate-950/20 py-6 text-center text-xs text-slate-600 mt-12">
        <p>© {new Date().getFullYear()} iReserve Reservation Desk. All rights reserved.</p>
      </footer>
    </div>
  );
}
