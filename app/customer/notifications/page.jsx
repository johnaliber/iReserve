'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import CustomerShell from '@/components/customer/CustomerShell';
import EmptyState from '@/components/shared/EmptyState';
import DelayedLoadingState from '@/components/shared/DelayedLoadingState';
import { createClient } from '@/lib/supabase/client';

export default function CustomerNotificationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    Promise.resolve().then(loadNotifications);
  }, [loadNotifications]);

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  };

  if (loading) return <CustomerShell><DelayedLoadingState loading message="Loading your notifications..." /></CustomerShell>;

  return (
    <CustomerShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Updates</p>
            <h1 className="mt-1 text-3xl font-extrabold text-[#272727]">Notifications</h1>
            <p className="mt-1 text-sm font-medium text-[#475b52]">Important updates about your reservation, payments, documents, and site viewing.</p>
          </div>
          {notifications.some((item) => !item.is_read) && (
            <button type="button" onClick={markAllRead} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dbe4ee] bg-white px-4 text-sm font-bold text-[#272727]">
              <CheckCheck className="h-4 w-4 text-emerald-600" /> Mark all as read
            </button>
          )}
        </header>

        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" description="Updates from the village admin and Accounting will appear here." />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={async () => {
                  if (notification.is_read) return;
                  await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
                  setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
                }}
                className={`w-full rounded-2xl border p-5 text-left shadow-sm transition ${notification.is_read ? 'border-[#e2e8f0] bg-white' : 'border-emerald-200 bg-emerald-50/60'}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-[#cbd5e1]' : 'bg-emerald-500'}`} />
                  <div>
                    <h2 className="font-extrabold text-[#272727]">{notification.title}</h2>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#33443c]">{notification.message}</p>
                    <p className="mt-2 text-xs font-medium text-[#5f7068]">{new Date(notification.created_at).toLocaleString('en-PH')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
