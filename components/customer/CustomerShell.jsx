'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import CustomerMobileNav from './CustomerMobileNav';

export default function CustomerShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setIsSidebarCollapsed((current) => !current);
      return;
    }
    setIsSidebarOpen((current) => !current);
  };

  return (
    <div className="customer-accessible dashboard-compact relative flex min-h-screen flex-col overflow-hidden bg-[#f8fafc] text-[#272727]">
      <Navbar
        toggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <div className="relative z-10 flex flex-1 overflow-visible">
        <AdminSidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
        <main className={`w-full flex-1 overflow-y-auto px-4 pb-20 pt-4 transition-[margin] duration-300 md:px-5 md:pb-5 md:pt-5 ${
          isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'
        }`}>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <CustomerMobileNav />
    </div>
  );
}
