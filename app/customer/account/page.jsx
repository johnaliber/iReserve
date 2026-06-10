'use client';

import { useEffect, useState } from 'react';
import { Mail, Phone, Save, User } from 'lucide-react';
import CustomerShell from '@/components/customer/CustomerShell';
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog';
import DelayedLoadingState from '@/components/shared/DelayedLoadingState';
import HelpText from '@/components/shared/HelpText';
import { createClient } from '@/lib/supabase/client';

const inputClass = 'mt-1.5 min-h-12 w-full rounded-xl border border-[#dbe4ee] bg-white px-4 text-sm text-[#272727] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';

export default function CustomerAccountPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single();
      setUserId(user.id);
      setForm({ full_name: profile?.full_name || '', phone: profile?.phone || '', email: user.email || '' });
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage('');
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      phone: form.phone.trim()
    }).eq('id', userId);
    setSaving(false);
    setConfirmSave(false);
    setMessage(error ? error.message : 'Your account information has been updated.');
  };

  if (loading) return <CustomerShell><DelayedLoadingState loading message="Loading your account..." /></CustomerShell>;

  return (
    <CustomerShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-[#e2e8f0] pb-5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Your Profile</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#272727]">Account Settings</h1>
          <p className="mt-1 text-sm font-medium text-[#475b52]">Keep your contact information current so the village team can reach you.</p>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); setConfirmSave(true); }} className="space-y-5 rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <label className="block text-sm font-bold text-[#475569]">
            Full Name
            <span className="relative block">
              <User className="absolute left-4 top-5 h-4 w-4 text-[#5f7068]" />
              <input className={`${inputClass} pl-11`} value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required />
            </span>
          </label>
          <label className="block text-sm font-bold text-[#475569]">
            Email Address
            <span className="relative block">
              <Mail className="absolute left-4 top-5 h-4 w-4 text-[#5f7068]" />
              <input className={`${inputClass} cursor-not-allowed bg-[#f8fafc] pl-11`} value={form.email} readOnly />
            </span>
          </label>
          <label className="block text-sm font-bold text-[#475569]">
            Phone Number
            <span className="relative block">
              <Phone className="absolute left-4 top-5 h-4 w-4 text-[#5f7068]" />
              <input className={`${inputClass} pl-11`} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+63 917 123 4567" />
            </span>
          </label>
          <HelpText>Your email is used to connect reservations made before account creation. Contact support if you need to change it.</HelpText>
          {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white hover:bg-emerald-500 sm:w-auto">
            <Save className="h-4 w-4" /> Save Changes
          </button>
        </form>
      </div>
      <ConfirmActionDialog open={confirmSave} title="Save Account Changes?" message="Please confirm that your updated information is correct." cancelLabel="Cancel" confirmLabel="Save Changes" busy={saving} onCancel={() => setConfirmSave(false)} onConfirm={saveProfile} />
    </CustomerShell>
  );
}
