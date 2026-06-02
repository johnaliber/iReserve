'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function RoleGuard({ allowedRoles, children }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role;
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Super admin can access all panels
      if (role === 'super_admin' || rolesArray.includes(role)) {
        setAuthorized(true);
      }
      setLoading(false);
    }

    checkRole();
  }, [allowedRoles, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8 bg-slate-900/40 border border-slate-800 rounded-2xl max-w-sm mx-auto my-8 glass-card">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-200">Access Restricted</h3>
        <p className="text-slate-400 text-xs mt-2 leading-relaxed">
          Your profile doesn&apos;t hold the permission credentials required to inspect this control panel.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
