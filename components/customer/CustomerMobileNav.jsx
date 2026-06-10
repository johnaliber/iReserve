'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Inbox, CreditCard, Calendar, User } from 'lucide-react';

const links = [
  { label: 'Home', href: '/customer/dashboard', icon: Home },
  { label: 'Reservations', href: '/customer/reservations', icon: Inbox },
  { label: 'Payments', href: '/customer/payments', icon: CreditCard },
  { label: 'Viewing', href: '/customer/site-viewing', icon: Calendar },
  { label: 'Account', href: '/customer/account', icon: User }
];

export default function CustomerMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#e2e8f0] bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      {links.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-extrabold ${active ? 'bg-emerald-100 text-emerald-800' : 'text-[#475b52]'}`}>
            <Icon className="h-4.5 w-4.5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
