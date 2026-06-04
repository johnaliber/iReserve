'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart,
  Building,
  Calendar,
  CreditCard,
  Home,
  Inbox,
  LayoutDashboard,
  Map,
  PencilRuler,
  Settings,
  Shield,
  User,
  Users
} from 'lucide-react';

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function Sidebar({ isOpen, isCollapsed = false, onClose }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(data || null);
    }

    fetchProfile();
  }, [supabase]);

  const role = profile?.role;

  const linksByRole = {
    super_admin: [
      { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
      { name: 'Villages / Properties', href: '/village-admin/properties', icon: Building },
      { name: 'Reservations / Siteviewings', href: '/village-admin/reservations', icon: Calendar },
      { name: 'Payments / Booking Audit', href: '/accounting/dashboard', icon: CreditCard },
      { name: 'Reports', href: '/village-admin/reports', icon: BarChart },
      { name: 'Map Canvas Editor', href: '/architect/dashboard', icon: PencilRuler },
      { name: 'Customer View Hub', href: '/super-admin/customer-view-hub', icon: Users },
      { name: 'Settings', href: '/super-admin/settings', icon: Settings }
    ],
    village_admin: [
      { name: 'Dashboard', href: '/village-admin/dashboard', icon: LayoutDashboard },
      { name: 'Villages / Properties', href: '/village-admin/properties', icon: Building },
      { name: 'Reservations / Siteviewings', href: '/village-admin/reservations', icon: Calendar },
      { name: 'Payments / Booking Audit', href: '/village-admin/payments-booking-audit', icon: CreditCard },
      { name: 'Reports', href: '/village-admin/reports', icon: BarChart },
      { name: 'Map Canvas Editor', href: '/village-admin/blueprint-preview', icon: Map },
      { name: 'Customer View Hub', href: '/village-admin/customer-view-hub', icon: Users },
      { name: 'Settings', href: '/village-admin/settings', icon: Settings }
    ],
    accounting: [
      { name: 'Dashboard', href: '/accounting/dashboard', icon: Home },
      { name: 'Payments / Booking Audit', href: '/accounting/dashboard', icon: CreditCard },
      { name: 'Reports', href: '/accounting/reports', icon: BarChart }
    ],
    architect: [
      { name: 'Dashboard', href: '/architect/dashboard', icon: Home },
      { name: 'Map Canvas Editor', href: '/architect/dashboard', icon: PencilRuler }
    ],
    customer: [
      { name: 'Overview', href: '/customer/dashboard', icon: Home },
      { name: 'My Reservations', href: '/customer/reservations', icon: Inbox },
      { name: 'Payments Ledger', href: '/customer/payments', icon: CreditCard },
      { name: 'My Documents', href: '/customer/documents', icon: Shield },
      { name: 'Site Viewings', href: '/customer/site-viewing', icon: Calendar }
    ]
  };

  const links = linksByRole[role] || [];

  const canManageAccounts = role === 'super_admin' || role === 'village_admin';
  const accountsHref = role === 'super_admin' ? '/super-admin/accounts' : '/village-admin/accounts';
  const superAdminAccountLinks = [
    { name: 'Customer', href: '/super-admin/accounts/customers', icon: User },
    { name: 'Admin', href: '/super-admin/accounts/admins', icon: Building },
    { name: 'Architect', href: '/super-admin/accounts/architects', icon: PencilRuler },
    { name: 'Accounting', href: '/super-admin/accounts/accounting', icon: CreditCard },
    { name: 'Superadmin', href: '/super-admin/accounts/superadmin', icon: Shield }
  ];

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-[#272727]/45 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-[61px] z-35 flex h-[calc(100vh-61px)] flex-col border-r border-[#e2e8f0] bg-white shadow-sm transition-all duration-300 ${
          isCollapsed ? 'md:w-20' : 'md:w-72'
        } w-72 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-3 py-5">
          {!isCollapsed && (
            <span className="mb-4 block px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94a3b8]">
              Navigation Menu
            </span>
          )}

          <nav className="space-y-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={onClose}
                  title={isCollapsed ? link.name : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-bold transition ${
                    isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#272727]'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-[#94a3b8]'}`} />
                  {!isCollapsed && <span>{link.name}</span>}
                </Link>
              );
            })}

            {canManageAccounts && (
              role === 'super_admin' ? (
                <div className="space-y-1">
                  <Link
                    href={accountsHref}
                    onClick={onClose}
                    title={isCollapsed ? 'Manage Accounts' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-bold transition ${
                      pathname === accountsHref
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#272727]'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                  >
                    <Users className={`h-4.5 w-4.5 flex-shrink-0 ${
                      pathname === accountsHref || pathname.startsWith(`${accountsHref}/`)
                        ? 'text-emerald-600'
                        : 'text-[#94a3b8]'
                    }`} />
                    {!isCollapsed && <span>Manage Accounts</span>}
                  </Link>

                  {!isCollapsed && (
                    <div className="ml-4 space-y-1 border-l border-[#e2e8f0] pl-3">
                      {superAdminAccountLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

                        return (
                          <Link
                            key={link.name}
                            href={link.href}
                            onClick={onClose}
                            className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#272727]'
                            }`}
                          >
                            <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-[#94a3b8]'}`} />
                            <span>{link.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={accountsHref}
                  onClick={onClose}
                  title={isCollapsed ? 'Manage Accounts' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-bold transition ${
                    pathname === accountsHref || pathname.startsWith(`${accountsHref}/`)
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#272727]'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <Users className={`h-4.5 w-4.5 flex-shrink-0 ${
                    pathname === accountsHref || pathname.startsWith(`${accountsHref}/`)
                      ? 'text-emerald-600'
                      : 'text-[#94a3b8]'
                  }`} />
                  {!isCollapsed && <span>Manage Accounts</span>}
                </Link>
              )
            )}
          </nav>
        </div>

        {profile && (
          <div className="border-t border-[#e2e8f0] p-3">
            <div className={`flex items-center gap-3 rounded-xl bg-[#f8fafc] p-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700">
                {initials(profile.full_name)}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#272727]">{profile.full_name}</p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    {profile.role?.replaceAll('_', ' ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
