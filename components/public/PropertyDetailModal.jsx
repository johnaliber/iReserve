'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  X, 
  MapPin, 
  Home, 
  BedDouble, 
  Bath, 
  Car, 
  Compass, 
  Sun, 
  ShieldAlert, 
  Calculator, 
  Coins, 
  Calendar,
  Building,
  Navigation,
  TrendingUp,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { calculatePaymentPlan, getInterestRateForTerm } from '@/lib/payments/paymentMath';

export default function PropertyDetailModal({ property, isOpen, onClose, showInternalCode = false }) {
  const supabase = createClient();
  const [role, setRole] = useState(null);

  useEffect(() => {
    async function fetchUserRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile) {
          setRole(profile.role);
        }
      }
    }
    fetchUserRole();
  }, [supabase]);

  // Calculators State
  const [downpaymentPercent, setDownpaymentPercent] = useState(20); // 20% default
  const [loanTermYears, setLoanTermYears] = useState(15); // 15 years default

  useEffect(() => {
    if (!property) return undefined;
    const timer = setTimeout(() => {
      setDownpaymentPercent(Number(property.downpayment_percentage || 20));
      setLoanTermYears(Number(property.default_loan_term_years || 15));
    }, 0);
    return () => clearTimeout(timer);
  }, [property]);

  if (!isOpen || !property) return null;

  const {
    id,
    property_code,
    block_number,
    lot_number,
    street_name = 'Green Valley Dr',
    property_type,
    model_name = 'Emerald Eco-Villa',
    description,
    price = 4500000,
    reservation_fee = 5000,
    interest_rate = 0,
    default_loan_term_years = 15,
    lot_size = 120,
    floor_area = 85,
    bedrooms = 3,
    bathrooms = 2,
    parking_slots = 1,
    orientation = 'East',
    flood_risk = 'low',
    sunlight_exposure = 'morning',
    status,
    thumbnail_url,
    floor_plan_url
  } = property;

  // Dynamic interest rate based on selected loan term
  const effectiveInterestRate = getInterestRateForTerm(interest_rate, loanTermYears);
  const downpaymentAmount = price * (downpaymentPercent / 100);

  const estimate = calculatePaymentPlan({
    propertyPrice: price,
    reservationFee: reservation_fee,
    paymentType: 'installment',
    downpaymentPercentage: downpaymentPercent,
    installmentTermMonths: loanTermYears * 12,
    interestRate: effectiveInterestRate
  });

  const monthlyAmortization = estimate.monthlyPayment;
  const reserveHref = `/reserve/${id}?downpayment_percentage=${encodeURIComponent(downpaymentPercent)}&loan_term_years=${encodeURIComponent(loanTermYears)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm transition-opacity md:items-center md:p-4">
      
      {/* Modal card box */}
      <div className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-900 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 md:max-h-[calc(100dvh-8rem)] md:flex-row md:rounded-3xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80 transition outline-none cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. Left half: Property Images & Specs Grid */}
        <div className="w-full md:w-[45%] border-b md:border-b-0 md:border-r border-slate-800/80 overflow-y-auto p-6 space-y-6">
          <div className="relative h-44 rounded-xl overflow-hidden shadow border border-slate-800">
            <img
              src={thumbnail_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80'}
              alt={model_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-slate-950/70 border border-slate-800 text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full select-none uppercase tracking-wide">
              {property_type?.replace('_', ' ') || 'house & lot'}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              {showInternalCode ? 'Property Identifier' : 'Lot Location'}
            </span>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">
              {showInternalCode ? property_code : `Block ${block_number}, Lot ${lot_number}`}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {showInternalCode ? `Block ${block_number}, Lot ${lot_number} - ` : ''}{street_name}
            </p>
          </div>

          {floor_plan_url && (
            <a href={floor_plan_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
              <img src={floor_plan_url} alt="Floor plan preview" className="h-36 w-full object-contain" />
              <span className="block border-t border-slate-800 px-3 py-2 text-center text-xs font-bold text-emerald-400">View Floor Plan</span>
            </a>
          )}

          {/* Quick Specs Grid */}
          <div className="grid grid-cols-2 gap-3.5 bg-slate-950/40 border border-slate-900 rounded-xl p-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Lot Size Area</span>
              <span className="font-bold text-slate-200">{lot_size} sqm</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Floor Area</span>
              <span className="font-bold text-slate-200">{floor_area || 'N/A'} sqm</span>
            </div>
            <div className="col-span-2 border-t border-slate-900/60 pt-2.5 flex items-center justify-between text-slate-400 font-medium">
              <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-emerald-400" /> {bedrooms} Beds</span>
              <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-emerald-400" /> {bathrooms} Baths</span>
              <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5 text-emerald-400" /> {parking_slots} Parking</span>
            </div>
          </div>

          {/* Safety & Climate Layers Info */}
          <div className="space-y-3.5">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Climate & Surroundings Layer</h5>
            
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-350">
                <ShieldAlert className={`w-4 h-4 ${flood_risk === 'high' ? 'text-red-400' : flood_risk === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span>Flood Risk:</span>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                flood_risk === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                flood_risk === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {flood_risk} Risk
              </span>
            </div>

            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-350">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Sunlight:</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {sunlight_exposure} exposure
              </span>
            </div>

            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-350">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>Orientation:</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Facing {orientation}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Right half: Pricing & Calculator */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Lot / House Details</p>
              <h2 className="mt-1 text-2xl font-extrabold text-white">Everything you need before reserving</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Review the price, size, surroundings, and payment choices below.</p>
            </div>
            <div className="flex items-end justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Acquisition Price</span>
                <span className="text-3xl font-extrabold text-white">₱{price.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Hold Fee</span>
                <span className="text-base font-bold text-emerald-400">₱{reservation_fee.toLocaleString()}</span>
                <span className="block text-[9px] font-bold text-emerald-500">Applied to downpayment</span>
              </div>
            </div>

            {/* Amortization Calculator widget */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5 space-y-5">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-900 pb-2 mb-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                Monthly Amortization Estimate
              </h4>

              {/* Slider Downpayment */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Downpayment ({downpaymentPercent}%)</span>
                  <span className="text-slate-200">₱{downpaymentAmount.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="1"
                  value={downpaymentPercent}
                  onChange={(e) => setDownpaymentPercent(Number(e.target.value))}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer outline-none"
                />
              </div>

              {/* Selection Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Loan Term Length
                  </label>
                  <select
                    value={loanTermYears}
                    onChange={(e) => setLoanTermYears(parseInt(e.target.value))}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-lg p-2 text-xs outline-none cursor-pointer font-medium"
                  >
                    <option value={5}>5 Years (60 mos)</option>
                    <option value={10}>10 Years (120 mos)</option>
                    <option value={15}>15 Years (180 mos)</option>
                    <option value={20}>20 Years (240 mos)</option>
                    {![5, 10, 15, 20].includes(Number(default_loan_term_years)) && (
                      <option value={Number(default_loan_term_years)}>{default_loan_term_years} Years ({Number(default_loan_term_years) * 12} mos)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Annual Interest Rate
                  </label>
                  <div className="w-full bg-slate-950/40 border border-slate-900 text-emerald-400 rounded-lg p-2 text-xs font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" />
                    {effectiveInterestRate}% per annum
                  </div>
                </div>
              </div>

              {/* Dynamic rate note */}
              {Number(interest_rate) > 0 && (
                <div className="flex items-start gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                  <Info className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                  <span className="text-[10px] text-slate-500 leading-relaxed">
                    Interest rate adjusts based on loan term. Base rate: {Number(interest_rate)}%. Shorter terms get lower rates.
                  </span>
                </div>
              )}

              {/* Live result output */}
              <div className="pt-3 border-t border-slate-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estimated Monthly Amortization</span>
                  <span className="text-[9px] text-slate-500 italic block mt-0.5">Calculated at {effectiveInterestRate}% fixed interest</span>
                </div>
                <span className="text-xl font-black text-emerald-400">
                  ₱{Math.round(monthlyAmortization).toLocaleString()}/mo
                </span>
              </div>
            </div>

            {/* Estimated Computation Breakdown */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-900 pb-2 mb-1">
                <Coins className="w-4 h-4 text-emerald-400" />
                Estimated Computation Breakdown
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Contract Price</span>
                  <span className="font-bold text-slate-200">₱{estimate.totalContractPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Reservation Fee (Hold Fee)</span>
                  <span className="font-bold text-slate-200">₱{estimate.reservationFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Downpayment ({downpaymentPercent}%)</span>
                  <span className="font-bold text-slate-200">₱{estimate.downpaymentAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Remaining Downpayment (after hold fee)</span>
                  <span className="font-bold text-slate-200">₱{estimate.remainingDownpayment.toLocaleString()}</span>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Principal Balance (to finance)</span>
                    <span className="font-bold text-white">₱{estimate.principalBalance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Interest Rate</span>
                  <span className="font-bold text-emerald-400">{effectiveInterestRate}% p.a.</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Loan Term</span>
                  <span className="font-bold text-slate-200">{loanTermYears} years ({loanTermYears * 12} months)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Interest Over Term</span>
                  <span className={`font-bold ${estimate.totalInterest > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    ₱{estimate.totalInterest.toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-bold">Total Amount Payable</span>
                    <span className="font-extrabold text-emerald-400 text-sm">₱{estimate.totalPayable.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <h4 className="text-sm font-extrabold text-white">Payment Options</h4>
              <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                <p><strong className="text-slate-200">Full Payment:</strong> Pay the full property amount.</p>
                <p><strong className="text-slate-200">Partial / Downpayment:</strong> Pay a downpayment first.</p>
                <p><strong className="text-slate-200">Installment:</strong> Pay monthly based on your selected term.</p>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              onClick={onClose}
              className="min-h-12 rounded-xl border border-slate-800 px-4 text-xs font-bold transition"
            >
              Close
            </button>
            <Link href={`/customer/site-viewing?property=${id}`} className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-center text-xs font-extrabold text-emerald-400">
              Schedule Site Viewing
            </Link>
            
            {status === 'available' ? (
              role && role !== 'customer' ? (
                <div className="flex min-h-12 items-center justify-center rounded-xl border border-slate-900 bg-slate-950 px-4 text-center text-xs font-bold text-slate-500">
                  Staff Account: Reservation Restrict
                </div>
              ) : (
                <Link
                  href={reserveHref}
                  className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-500"
                >
                  <Coins className="w-4 h-4" />
                  Reserve This Lot
                </Link>
              )
            ) : (
              <div className="flex min-h-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 text-center text-xs font-bold text-amber-400">
                This lot is currently not available for reservation.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
