'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Home, 
  Map, 
  Users, 
  CreditCard, 
  FileText, 
  Calendar, 
  Building, 
  Shield, 
  BarChart, 
  PencilRuler, 
  Activity, 
  HelpCircle,
  Inbox
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [role, setRole] = useState(null);

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile) {
          setRole(profile.role);
        }
      }
    }
    fetchRole();
  }, [supabase]);

  const getLinks = () => {
    if (!role) return [];

    switch (role) {
      case 'super_admin':
        return [
          { name: 'Admin Dashboard', href: '/super-admin/dashboard', icon: Home },
          { name: 'Properties & Map Specs', href: '/village-admin/dashboard', icon: Building },
          { name: 'Payments & Booking Audit', href: '/accounting/dashboard', icon: CreditCard },
          { name: 'Blueprint Canvas Editors', href: '/architect/dashboard', icon: PencilRuler },
          { name: 'Customer View Hub', href: '/customer/dashboard', icon: Users },
        ];
      case 'village_admin':
        return [
          { name: 'Dashboard', href: '/village-admin/dashboard', icon: Home },
          { name: 'Properties', href: '/village-admin/properties', icon: Building },
          { name: 'Reservations', href: '/village-admin/reservations', icon: Inbox },
          { name: 'Site Viewings', href: '/village-admin/site-viewings', icon: Calendar },
          { name: 'Blueprint Preview', href: '/village-admin/blueprint-preview', icon: Map },
          { name: 'Village Reports', href: '/village-admin/reports', icon: BarChart },
        ];
      case 'accounting':
        return [
          { name: 'Dashboard', href: '/accounting/dashboard', icon: Home },
          { name: 'Verify Payments', href: '/accounting/payments', icon: CreditCard },
          { name: 'Refund Requests', href: '/accounting/refunds', icon: FileText },
          { name: 'Financial Reports', href: '/accounting/reports', icon: BarChart },
        ];
      case 'architect':
        return [
          { name: 'Dashboard', href: '/architect/dashboard', icon: Home },
          { name: 'Blueprint Editor', href: '/architect/blueprints', icon: PencilRuler },
        ];
      case 'customer':
      default:
        return [
          { name: 'Overview', href: '/customer/dashboard', icon: Home },
          { name: 'My Reservations', href: '/customer/reservations', icon: Inbox },
          { name: 'Payments Ledger', href: '/customer/payments', icon: CreditCard },
          { name: 'My Documents', href: '/customer/documents', icon: FileText },
          { name: 'Site Viewings', href: '/customer/site-viewing', icon: Calendar },
        ];
    }
  };

  const links = getLinks();

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-35 w-64 bg-slate-900 border-r border-slate-800/80 pt-16 flex flex-col transition-transform duration-300 md:translate-x-0 md:static md:pt-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 block mb-4 select-none">
            Navigation Menu
          </span>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 transition-transform group-hover:scale-110 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                {link.name}
              </Link>
            );
          })}
        </div>

        {role && (
          <div className="p-4 border-t border-slate-800/60 bg-slate-900/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 select-none">
              <Shield className="w-3.5 h-3.5 text-emerald-500/50" />
              <span>Security level: Active</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
