'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async (userId) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }, [supabase]);

  useEffect(() => {
    async function fetchSession() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        setUser({ ...currentUser, profile });
        fetchNotifications(currentUser.id);
      }
    }
    fetchSession();
  }, [supabase, fetchNotifications]);

  useEffect(() => {
    const openNotifications = () => setShowNotifications(true);
    window.addEventListener('ireserve:open-notifications', openNotifications);
    return () => window.removeEventListener('ireserve:open-notifications', openNotifications);
  }, []);

  async function handleMarkAsRead(notifId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);

    if (!error) {
      setNotifications(notifications.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-40 flex h-[58px] w-full items-center justify-between border-b border-[#e3e9e6] bg-white/95 px-3.5 py-2.5 backdrop-blur">
      <div className="flex items-center gap-3">
        {toggleSidebar && (
          <button
            onClick={toggleSidebar}
            className="rounded-lg border border-[#dce4e0] bg-white p-1.5 text-[#52635b] outline-none transition hover:bg-[#f4f7f5] hover:text-[#223129] md:hidden"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Button */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative cursor-pointer rounded-xl p-2 text-[#66756e] outline-none transition hover:bg-[#f1f5f3] hover:text-[#223129]"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#16835f] px-1 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-[#dce4e0] bg-white shadow-[0_18px_50px_rgba(26,52,40,0.14)]">
                <div className="flex items-center justify-between border-b border-[#e5ebe8] p-4">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#34443d]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-[#eef8f4] px-2 py-1 text-[10px] font-bold text-[#13795b]">
                      {unreadCount} Unread
                    </span>
                  )}
                </div>
                <div className="max-h-64 divide-y divide-[#edf1ef] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-5 text-center text-xs text-[#7c8983]">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkAsRead(notif.id)}
                        className={`cursor-pointer p-4 text-xs transition hover:bg-[#f8faf9] ${!notif.is_read ? 'bg-[#f2faf7]' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-bold text-[#223129]">{notif.title}</span>
                          {!notif.is_read && (
                            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#16835f]" />
                          )}
                        </div>
                        <p className="leading-relaxed text-[#66756e]">{notif.message}</p>
                        <span className="mt-1.5 block text-[11px] font-medium text-[#5f7068]">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <Link href="/customer/notifications" onClick={() => setShowNotifications(false)} className="flex min-h-11 items-center justify-center border-t border-[#e2e8f0] bg-[#f8fafc] text-xs font-extrabold text-emerald-700">
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        )}

        {!user && (
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs px-4 py-2 rounded-xl transition shadow shadow-emerald-500/10"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
    <div className="h-[58px] flex-shrink-0" aria-hidden="true" />
    </>
  );
}
