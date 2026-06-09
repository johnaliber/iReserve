'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart,
  BookOpen,
  Building,
  Calendar,
  ChevronDown,
  CreditCard,
  Bell,
  FileCheck,
  FileClock,
  Home,
  Inbox,
  LayoutDashboard,
  Map,
  PencilRuler,
  ReceiptText,
  RotateCcw,
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

const linksByRole = {
  super_admin: [
    { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
    { name: 'Villages', href: '/village-admin/properties', icon: Building },
    { name: 'Users', href: '/super-admin/users', icon: Users },
    { name: 'Reservations', href: '/village-admin/reservations', icon: Inbox },
    { name: 'Payments', href: '/accounting/ledger/customer-accounts', icon: CreditCard },
    { name: 'Reports', href: '/village-admin/reports', icon: BarChart },
    { name: 'Blueprints', href: '/architect/dashboard', icon: PencilRuler },
    { name: 'Audit Logs', href: '/super-admin/audit-logs', icon: FileClock },
    { name: 'Settings', href: '/super-admin/settings', icon: Settings }
  ],
  village_admin: [
    { name: 'Dashboard', href: '/village-admin/dashboard', icon: LayoutDashboard },
    { name: 'Properties', href: '/village-admin/properties', icon: Building },
    { name: 'Reservations', href: '/village-admin/reservations', icon: Inbox },
    { name: 'Site Viewings', href: '/village-admin/site-viewings', icon: Calendar },
    { name: 'Customers', href: '/village-admin/users', icon: Users },
    { name: 'Reports', href: '/village-admin/reports', icon: BarChart },
    { name: 'Blueprint Preview', href: '/village-admin/blueprint-preview', icon: Map },
    { name: 'Audit Logs', href: '/village-admin/audit-logs', icon: FileClock }
  ],
  accounting: [
    { name: 'Dashboard', href: '/accounting/dashboard', icon: LayoutDashboard },
    { name: 'Reports', href: '/accounting/reports', icon: BarChart },
    { name: 'Refunds', href: '/accounting/refunds', icon: RotateCcw },
    { name: 'Settings', href: '/accounting/settings', icon: Settings }
  ],
  architect: [
    { name: 'Dashboard', href: '/architect/dashboard', icon: Home },
    { name: 'Map Canvas Editor', href: '/architect/dashboard', icon: PencilRuler }
  ],
  customer: [
    { name: 'Home', href: '/customer/dashboard', icon: Home },
    { name: 'My Reservations', href: '/customer/reservations', icon: Inbox },
    { name: 'My Payments', href: '/customer/payments', icon: CreditCard },
    { name: 'My Documents', href: '/customer/documents', icon: Shield },
    { name: 'Site Viewing', href: '/customer/site-viewing', icon: Calendar },
    { name: 'Notifications', href: '/customer/notifications', icon: Bell },
    { name: 'Account', href: '/customer/account', icon: User }
  ]
};

const ledgerLinks = [
  { name: 'Customer Account Ledger', href: '/accounting/ledger/customer-accounts', icon: Users },
  { name: 'Receipts Audit Ledger', href: '/accounting/ledger/receipts', icon: ReceiptText },
  { name: 'Customer Documents', href: '/accounting/ledger/customer-documents', icon: FileCheck }
];

export default function Sidebar({ isOpen, isCollapsed = false, onClose }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data || null);
    }
    fetchProfile();
  }, [supabase]);

  const role = profile?.role;
  const links = linksByRole[role] || [];
  const ledgerRouteActive = pathname.startsWith('/accounting/ledger/');
  const ledgerExpanded = ledgerOpen || ledgerRouteActive;

  const renderNavigationLink = (link) => {
    const Icon = link.icon;
    const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
    return (
      <Link
        key={link.name}
        href={link.href}
        onClick={onClose}
        title={isCollapsed ? link.name : undefined}
        className={`flex min-h-11 items-center gap-3 border-b-2 px-3 text-sm font-bold transition ${
          isActive
            ? 'border-b-[#16835f] text-[#13795b]'
            : 'border-b-transparent text-[#66756e] hover:border-b-[#c8d3ce] hover:text-[#223129]'
        } ${isCollapsed ? 'justify-center' : ''}`}
      >
        <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-[#16835f]' : 'text-[#8b9992]'}`} />
        {!isCollapsed && <span>{link.name}</span>}
      </Link>
    );
  };

  const renderLedger = () => (
    <div className="space-y-1">
      {isCollapsed ? (
        <Link
          href="/accounting/ledger/customer-accounts"
          onClick={onClose}
          title="Manage Ledger"
          className={`flex min-h-11 items-center justify-center border-b-2 px-3 transition ${
            ledgerRouteActive
              ? 'border-b-[#16835f] text-[#13795b]'
              : 'border-b-transparent text-[#66756e] hover:border-b-[#c8d3ce]'
          }`}
        >
          <BookOpen className="h-4.5 w-4.5" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setLedgerOpen((open) => !open)}
          className={`flex min-h-11 w-full items-center gap-3 border-b-2 px-3 text-left text-sm font-bold transition ${
            ledgerRouteActive
              ? 'border-b-[#16835f] text-[#13795b]'
              : 'border-b-transparent text-[#66756e] hover:border-b-[#c8d3ce] hover:text-[#223129]'
          }`}
        >
          <BookOpen className="h-4.5 w-4.5 flex-shrink-0" />
          <span className="flex-1">Manage Ledger</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${ledgerExpanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {!isCollapsed && ledgerExpanded && (
        <div className="ml-4 space-y-1 border-l border-[#e2e8f0] pl-3">
          {ledgerLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={onClose}
                className={`flex min-h-9 items-center gap-2 border-b-2 px-3 text-xs font-bold transition ${
                  isActive
                    ? 'border-b-[#16835f] text-[#13795b]'
                    : 'border-b-transparent text-[#718078] hover:border-b-[#c8d3ce] hover:text-[#34443d]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 z-30 bg-[#272727]/45 backdrop-blur-sm md:hidden" />}
      <aside className={`fixed left-0 top-[61px] z-35 flex h-[calc(100vh-61px)] flex-col border-r border-[#e3e9e6] bg-[#fcfdfc] transition-all duration-300 ${isCollapsed ? 'md:w-20' : 'md:w-72'} w-72 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          {!isCollapsed && (
            <span className="mb-4 block px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94a3b8]">
              Navigation
            </span>
          )}
          <nav className="space-y-1.5">
            {role === 'accounting' ? (
              <>
                {renderNavigationLink(links[0])}
                {renderLedger()}
                {links.slice(1).map(renderNavigationLink)}
              </>
            ) : links.map(renderNavigationLink)}
          </nav>
        </div>
        {profile && (
          <div className="border-t border-[#e2e8f0] p-3">
            <div className={`flex items-center gap-3 rounded-xl border border-[#e5ebe8] bg-[#f7f9f8] p-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#dff3eb] text-sm font-extrabold text-[#13795b]">
                {initials(profile.full_name)}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#223129]">{profile.full_name}</p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#16835f]">
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
