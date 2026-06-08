'use client';

import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import HelpText from '@/components/shared/HelpText';

const inputClass = 'mt-1.5 min-h-12 w-full rounded-xl border border-[#dbe4ee] bg-white px-4 text-sm text-[#272727] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';

export default function InquiryForm({ villageId }) {
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    payment_type: 'full_payment',
    preferred_installment_term: '12',
    estimated_budget: '',
    message: ''
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('inquiries').insert({
      village_id: villageId,
      customer_id: user?.id || null,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      message: form.message.trim(),
      payment_type: form.payment_type,
      preferred_installment_term: form.payment_type === 'installment' ? Number(form.preferred_installment_term) : null,
      estimated_budget: form.payment_type === 'installment' && form.estimated_budget ? Number(form.estimated_budget) : null
    });
    setSubmitting(false);
    if (insertError) return setError(insertError.message);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-extrabold text-[#272727]">Your inquiry has been sent.</h2>
        <p className="mt-2 text-sm text-[#64748b]">We will contact you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
      <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Ask a Question</p>
      <h2 className="mt-1 text-2xl font-extrabold text-[#272727]">Need help before reserving?</h2>
      <p className="mt-2 text-sm text-[#64748b]">Send a short message to the village team.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-[#475569]">Full Name<input required className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <label className="text-sm font-bold text-[#475569]">Email<input required type="email" className={inputClass} value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
        <label className="text-sm font-bold text-[#475569]">Phone Number<input className={inputClass} value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
        <label className="text-sm font-bold text-[#475569]">
          Preferred Payment Option
          <select className={inputClass} value={form.payment_type} onChange={(event) => update('payment_type', event.target.value)}>
            <option value="full_payment">Full Payment</option>
            <option value="partial_payment">Partial / Downpayment</option>
            <option value="installment">Installment</option>
          </select>
        </label>
        {form.payment_type === 'installment' && (
          <>
            <label className="text-sm font-bold text-[#475569]">Preferred Term<select className={inputClass} value={form.preferred_installment_term} onChange={(event) => update('preferred_installment_term', event.target.value)}><option value="12">12 months</option><option value="24">24 months</option><option value="36">36 months</option><option value="60">5 years</option></select></label>
            <label className="text-sm font-bold text-[#475569]">Estimated Monthly Budget<input type="number" min="0" className={inputClass} value={form.estimated_budget} onChange={(event) => update('estimated_budget', event.target.value)} /></label>
          </>
        )}
      </div>
      <label className="mt-4 block text-sm font-bold text-[#475569]">Message / Question<textarea required rows={4} className={`${inputClass} py-3`} value={form.message} onChange={(event) => update('message', event.target.value)} /></label>
      <div className="mt-4"><HelpText>Your inquiry will be reviewed by the village admin. You will be contacted for the next step.</HelpText></div>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <button disabled={submitting} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60 sm:w-auto">
        <Send className="h-4 w-4" /> {submitting ? 'Sending...' : 'Send Inquiry'}
      </button>
    </form>
  );
}
