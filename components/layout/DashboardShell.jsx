'use client';

import React, { useState } from 'react';
import Navbar from './Navbar';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function DashboardShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setIsSidebarCollapsed((current) => !current);
      return;
    }
    setIsSidebarOpen((current) => !current);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
                                                    <div className="dashboard-compact relative flex min-h-dvh flex-col overflow-hidden bg-[#f5f7f6] text-[#17211d]">
      <Navbar
        toggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      
      <div className="relative flex flex-1 overflow-visible">
        <AdminSidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={closeSidebar}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
        
        <main className={`w-full flex-1 overflow-y-auto px-4 py-4 transition-[margin] duration-300 md:px-5 md:py-5 ${
          isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
}
