'use client';

import { useEffect, useState } from 'react';
import { Lock, Mail, Phone, Save, User } from 'lucide-react';
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
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmPasswordChange, setConfirmPasswordChange] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [userId, setUserId] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });

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

  const changePassword = async () => {
    setPasswordMessage({ type: '', text: '' });

    if (passwordForm.password.length < 6) {
      setConfirmPasswordChange(false);
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setConfirmPasswordChange(false);
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
    setChangingPassword(false);
    setConfirmPasswordChange(false);

    if (error) {
      setPasswordMessage({ type: 'error', text: error.message });
      return;
    }

    fetch('/api/customer/account/password-changed', { method: 'POST' }).catch((notificationError) => {
      console.error('Password change notification failed:', notificationError);
    });
    setPasswordForm({ password: '', confirmPassword: '' });
    setPasswordMessage({ type: 'success', text: 'Your password has been updated.' });
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

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPasswordMessage({ type: '', text: '' });

            if (passwordForm.password !== passwordForm.confirmPassword) {
              setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
              return;
            }

            setConfirmPasswordChange(true);
          }}
          className="space-y-5 rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-extrabold text-[#272727]">Change Password</h2>
            <p className="mt-1 text-sm font-medium text-[#475b52]">Use at least 6 characters and enter the same password twice.</p>
          </div>

          <label className="block text-sm font-bold text-[#475569]">
            New Password
            <span className="relative block">
              <Lock className="absolute left-4 top-5 h-4 w-4 text-[#5f7068]" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={`${inputClass} pl-11`}
                value={passwordForm.password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Enter a new password"
              />
            </span>
          </label>

          <label className="block text-sm font-bold text-[#475569]">
            Confirm New Password
            <span className="relative block">
              <Lock className="absolute left-4 top-5 h-4 w-4 text-[#5f7068]" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword)}
                className={`${inputClass} pl-11`}
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="Enter the new password again"
              />
            </span>
            {passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword && (
              <span className="mt-1.5 block text-xs font-semibold text-red-600">Passwords do not match.</span>
            )}
          </label>

          {passwordMessage.text && (
            <p className={`rounded-xl p-3 text-sm font-bold ${
              passwordMessage.type === 'error'
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              {passwordMessage.text}
            </p>
          )}

          <button
            type="submit"
            disabled={changingPassword}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Lock className="h-4 w-4" />
            {changingPassword ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>
      <ConfirmActionDialog open={confirmSave} title="Save Account Changes?" message="Please confirm that your updated information is correct." cancelLabel="Cancel" confirmLabel="Save Changes" busy={saving} onCancel={() => setConfirmSave(false)} onConfirm={saveProfile} />
      <ConfirmActionDialog
        open={confirmPasswordChange}
        title="Change Your Password?"
        message="You will use the new password the next time you sign in."
        cancelLabel="Cancel"
        confirmLabel="Change Password"
        busy={changingPassword}
        onCancel={() => setConfirmPasswordChange(false)}
        onConfirm={changePassword}
      />
    </CustomerShell>
  );
}
