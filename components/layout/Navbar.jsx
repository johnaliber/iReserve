'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Building, Bell, LogOut, User, Menu, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
  const router = useRouter();
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
    <header className="sticky top-0 z-40 w-full glass-card border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        {toggleSidebar && (
          <button
            onClick={toggleSidebar}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition outline-none cursor-pointer"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <Link href="/" className="flex items-center gap-2 text-emerald-400 font-bold text-xl tracking-wide select-none">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
            <Building className="w-4.5 h-4.5" />
          </div>
          <span className="bg-gradient-to-r from-slate-900 to-emerald-600 bg-clip-text text-transparent">iReserve</span>
        </Link>
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
              <img
                src={user.profile.avatar_url}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border border-slate-800"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold select-none shadow">
                <User className="w-4 h-4" />
              </div>
            )}

            <button
              onClick={handleLogout}
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
  );
}
