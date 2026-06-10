'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  CreditCard,
  FileCheck,
  FileClock,
  Home,
  LayoutDashboard,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  PencilRuler,
  ReceiptText,
  RotateCcw,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  UserRound,
  UserRoundPlus,
  Users,
  UsersRound,
  WalletCards
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import SidebarLogoHeader from './SidebarLogoHeader';
import AdminSidebarNav from './AdminSidebarNav';
import UserProfileSidebarFooter from './UserProfileSidebarFooter';

const superAdminNav = [
  { title: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { title: 'Villages', href: '/village-admin/properties', icon: Building2 },
  {
    title: 'Manage Users',
    icon: Users,
    match: (pathname) => pathname.startsWith('/super-admin/users'),
    children: [
      { title: 'Super Admins', href: '/super-admin/users?role=super_admin', icon: ShieldCheck, roleFilter: 'super_admin' },
      { title: 'Village Admins', href: '/super-admin/users?role=village_admin', icon: UserCog, roleFilter: 'village_admin' },
      { title: 'Accounting', href: '/super-admin/users?role=accounting', icon: WalletCards, roleFilter: 'accounting' },
      { title: 'Architects', href: '/super-admin/users?role=architect', icon: PencilRuler, roleFilter: 'architect' },
      { title: 'Customers', href: '/super-admin/users?role=customer', icon: UserRound, roleFilter: 'customer' },
      { title: 'Guests', href: '/super-admin/users?role=guest', icon: UserRoundPlus, roleFilter: 'guest' }
    ]
  },
  { title: 'Reservations', href: '/village-admin/reservations', icon: CalendarCheck },
  { title: 'Payments', href: '/accounting/ledger/customer-accounts', icon: CreditCard },
  { title: 'Reports', href: '/village-admin/reports', icon: BarChart3 },
  { title: 'Blueprints', href: '/architect/dashboard', icon: PencilRuler },
  { title: 'Audit Logs', href: '/super-admin/audit-logs', icon: FileClock },
  { title: 'Settings', href: '/super-admin/settings', icon: Settings }
];

const villageAdminNav = [
  { title: 'Dashboard', href: '/village-admin/dashboard', icon: LayoutDashboard },
  { title: 'Properties', href: '/village-admin/properties', icon: Building2 },
  { title: 'Reservations', href: '/village-admin/reservations', icon: CalendarCheck },
  { title: 'Site Viewings', href: '/village-admin/site-viewings', icon: CalendarCheck },
  { title: 'Customers', href: '/village-admin/users', icon: Users },
  { title: 'Reports', href: '/village-admin/reports', icon: BarChart3 },
  { title: 'Blueprint Preview', href: '/village-admin/blueprint-preview', icon: Map },
  { title: 'Audit Logs', href: '/village-admin/audit-logs', icon: FileClock },
  { title: 'Settings', href: '/village-admin/settings', icon: Settings }
];

const accountingNav = [
  { title: 'Dashboard', href: '/accounting/dashboard', icon: LayoutDashboard },
  {
    title: 'Manage Ledger',
    icon: BookOpen,
    children: [
      { title: 'Customer Account Ledger', href: '/accounting/ledger/customer-accounts', icon: UsersRound },
      { title: 'Receipts Audit Ledger', href: '/accounting/ledger/receipts', icon: ReceiptText },
      { title: 'Customer Documents', href: '/accounting/ledger/customer-documents', icon: FileCheck }
    ]
  },
  { title: 'Reports', href: '/accounting/reports', icon: BarChart3 },
  { title: 'Refunds', href: '/accounting/refunds', icon: RotateCcw },
  { title: 'Settings', href: '/accounting/settings', icon: Settings }
];

const architectNav = [
  { title: 'Dashboard', href: '/architect/dashboard', icon: Home },
  { title: 'Map Canvas Editor', href: '/architect/dashboard', icon: PencilRuler }
];

const customerNav = [
  { title: 'Home', href: '/customer/dashboard', icon: Home },
  { title: 'My Reservations', href: '/customer/reservations', icon: CalendarCheck },
  { title: 'My Payments', href: '/customer/payments', icon: CreditCard },
  { title: 'My Documents', href: '/customer/documents', icon: Shield },
  { title: 'Site Viewing', href: '/customer/site-viewing', icon: CalendarCheck },
  { title: 'Notifications', href: '/customer/notifications', icon: Bell },
  { title: 'Account', href: '/customer/account', icon: UserRound }
];

const navByRole = {
  super_admin: superAdminNav,
  village_admin: villageAdminNav,
  accounting: accountingNav,
  architect: architectNav,
  customer: customerNav
};

const settingsByRole = {
  super_admin: '/super-admin/settings',
  village_admin: '/village-admin/settings',
  accounting: '/accounting/settings',
  architect: '/architect/dashboard',
  customer: '/customer/account'
};

function readRoleFilter() {
  if (typeof window === 'undefined') return '';
  const role = new URLSearchParams(window.location.search).get('role') || '';
  return ['super_admin', 'village_admin', 'accounting', 'architect', 'customer', 'guest'].includes(role)
    ? role
    : '';
}

function subscribeToLocation(callback) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}

export default function AdminSidebar({
  isOpen,
  isCollapsed = false,
  onClose,
  onToggleCollapse
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState(null);
  const roleFilter = useSyncExternalStore(subscribeToLocation, readRoleFilter, () => '');

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data ? { ...data, email: user.email } : null);
    }
    fetchProfile();
  }, [supabase]);

  const role = profile?.role;
  const items = navByRole[role] || [];
  const settingsHref = settingsByRole[role] || '/';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-[#17211d]/35 backdrop-blur-[1px] md:hidden"
        />
      )}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`fixed top-4 z-[100] hidden h-8 w-8 items-center justify-center rounded-full border border-[#dbe4ee] bg-white text-[#52635b] shadow-md transition-[left,background-color,color] duration-300 hover:bg-[#f1f5f3] hover:text-[#17211d] md:inline-flex ${
          isCollapsed ? 'left-[56px]' : 'left-[244px]'
        }`}
      >
        {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
      <aside className={`fixed left-0 top-0 z-50 flex h-screen overflow-visible flex-col border-r border-[#dbe4ee] bg-white transition-[width,transform] duration-300 ${
        isCollapsed ? 'md:w-[72px]' : 'md:w-[260px]'
      } w-[260px] ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <SidebarLogoHeader collapsed={isCollapsed} />
        <div className={`relative z-10 flex-1 py-3 ${
          isCollapsed ? 'overflow-visible px-0' : 'overflow-y-auto px-2'
        }`}>
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5f7068]">
              Navigation
            </p>
          )}
          <AdminSidebarNav
            items={items}
            pathname={pathname}
            roleFilter={roleFilter}
            collapsed={isCollapsed}
            onNavigate={onClose}
            onRoleFilterChange={() => {}}
          />
        </div>
        <UserProfileSidebarFooter
          profile={profile}
          collapsed={isCollapsed}
          settingsHref={settingsHref}
          notificationsHref={role === 'customer' ? '/customer/notifications' : null}
          onNotifications={() => window.dispatchEvent(new CustomEvent('ireserve:open-notifications'))}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}
