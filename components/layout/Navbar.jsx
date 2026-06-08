'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Bell, LogOut, User, Menu, X } from 'lucide-react';
import Link from 'next/link';
import BrandLogo from '@/components/brand/BrandLogo';
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog';

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'village_admin': return 'Village Admin';
      case 'accounting': return 'Accounting';
      case 'architect': return 'Architect';
      default: return 'Customer';
    }
  };

  return (
    <>
    <header className="fixed left-0 top-0 z-40 flex h-[61px] w-full items-center justify-between border-b border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        {toggleSidebar && (
          <button
            onClick={toggleSidebar}
            className="rounded-lg border border-[#e2e8f0] bg-white p-1.5 text-[#272727] outline-none transition hover:bg-[#f8fafc]"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <Link href="/" aria-label="iReserve home"><BrandLogo compact /></Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Button */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition relative outline-none cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 text-slate-950 font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} Unread
                    </span>
                  )}
                </div>
                <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkAsRead(notif.id)}
                        className={`p-3 text-xs transition cursor-pointer hover:bg-slate-800/30 ${!notif.is_read ? 'bg-slate-800/10' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-semibold text-slate-200">{notif.title}</span>
                          {!notif.is_read && (
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-slate-400 leading-relaxed">{notif.message}</p>
                        <span className="text-[9px] text-slate-600 block mt-1.5">
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

        {/* Profile Card & Log Out */}
        {user ? (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800/80">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-200">{user.profile?.full_name}</span>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase">
                {getRoleLabel(user.profile?.role)}
              </span>
            </div>
            
            {user.profile?.avatar_url ? (
              <Image
                src={user.profile.avatar_url}
                alt="Avatar"
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover border border-slate-800"
              />
            ) : (
              <Link href={user.profile?.role === 'customer' ? '/customer/account' : '#'} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold select-none shadow" aria-label="Account settings">
                <User className="w-4 h-4" />
              </Link>
            )}

            <button
              onClick={() => setConfirmLogout(true)}
              title="Log Out"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition outline-none cursor-pointer"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
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
    <div className="h-[61px] flex-shrink-0" aria-hidden="true" />
    <ConfirmActionDialog
      open={confirmLogout}
      title="Log Out?"
      message="Are you sure you want to log out of your account?"
      cancelLabel="Stay Logged In"
      confirmLabel="Log Out"
      destructive
      onCancel={() => setConfirmLogout(false)}
      onConfirm={handleLogout}
    />
    </>
  );
}
