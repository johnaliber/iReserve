'use client';

import React, { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8fafc] text-[#272727]">
      <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} isCollapsed={isSidebarCollapsed} onClose={closeSidebar} />
        
        <main className={`w-full flex-1 overflow-y-auto px-4 py-6 transition-[margin] duration-300 md:px-8 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
}
