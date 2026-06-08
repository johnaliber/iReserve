'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8fafc] text-[#272727]">
      <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} isCollapsed={isSidebarCollapsed} onClose={() => setIsSidebarOpen(false)} />
        <main className={`w-full flex-1 overflow-y-auto px-4 pb-24 pt-6 transition-[margin] duration-300 md:px-8 md:pb-8 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
        }`}>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <CustomerMobileNav />
    </div>
  );
}
