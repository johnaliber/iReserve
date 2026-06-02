'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  Shield, 
  Building, 
  Users, 
  CreditCard, 
  Activity, 
  Plus, 
  Save, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  UserCheck,
  Link as LinkIcon
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Village CRUD form state
  const [showVillageForm, setShowVillageForm] = useState(false);
  const [vName, setVName] = useState('');
  const [vSlug, setVSlug] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vAddress, setVAddress] = useState('');
  const [vCity, setVCity] = useState('');
  const [vProvince, setVProvince] = useState('');
  const [vPrice, setVPrice] = useState(3000000);
  const [creatingVillage, setCreatingVillage] = useState(false);

  // Assignment form state
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('village_admin');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  const fetchSuperAdminData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Villages
      const { data: v } = await supabase
        .from('villages')
        .select('*')
        .order('name');
      setVillages(v || []);
      if (v && v.length > 0) {
        setSelectedVillage(v[0].id);
      }

      // 2. Fetch User Profiles
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .order('email');
      setProfiles(profs || []);
      if (profs && profs.length > 0) {
        setSelectedUser(profs[0].id);
      }

      // 3. Fetch Audit Logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setAuditLogs(logs || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuperAdminData();
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSuperAdminData]);

  // CREATE VILLAGE CRUD ACTION
  const handleCreateVillage = async (e) => {
    e.preventDefault();
    if (!vName || !vSlug || !vAddress) {
      alert('Please fill in required fields.');
      return;
    }
    setCreatingVillage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: newV, error } = await supabase
        .from('villages')
        .insert({
          name: vName,
          slug: vSlug.toLowerCase().replace(/\s+/g, '-'),
          description: vDesc,
          address: vAddress,
          city: vCity || 'Tagaytay',
          province: vProvince || 'Cavite',
          starting_price: vPrice,
          status: 'active',
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Seed a default blueprint for the new village
      const { data: newBp } = await supabase
        .from('blueprints')
        .insert({
          village_id: newV.id,
          name: `${vName} Master Blueprint`,
          status: 'draft',
          version: 1,
          canvas_width: 2000,
          canvas_height: 2000,
          created_by: user.id
        })
        .select()
        .single();

      // Seed sample properties
      await supabase.from('properties').insert([
        { village_id: newV.id, property_code: `${vName.substring(0, 3).toUpperCase()}-B1L1`, block_number: '1', lot_number: '1', price: vPrice, lot_size: 120, status: 'available', flood_risk: 'low', sunlight_exposure: 'balanced' },
        { village_id: newV.id, property_code: `${vName.substring(0, 3).toUpperCase()}-B1L2`, block_number: '1', lot_number: '2', price: vPrice + 200000, lot_size: 130, status: 'available', flood_risk: 'low', sunlight_exposure: 'morning' }
      ]);

      // Seed audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE_VILLAGE',
        entity_type: 'village',
        entity_id: newV.id,
        metadata: { name: vName }
      });

      setSuccessMsg('Village community created successfully with default master blueprint!');
      setVName('');
      setVSlug('');
      setVDesc('');
      setVAddress('');
      setShowVillageForm(false);
      fetchSuperAdminData();
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Village creation failed.');
    } finally {
      setCreatingVillage(false);
    }
  };

  // ROLE AND VILLAGE ASSIGNMENT ACTION
  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedVillage) return;

    setAssigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Update user overall role inside profiles
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: selectedRole })
        .eq('id', selectedUser);

      if (roleError) throw roleError;

      // 2. Insert into user_villages mapping
      const { error: assignError } = await supabase
        .from('user_villages')
        .insert({
          user_id: selectedUser,
          village_id: selectedVillage,
          role: selectedRole === 'super_admin' ? 'village_admin' : selectedRole // fallback map
        });

      if (assignError && !assignError.message.includes('duplicate key')) {
        throw assignError;
      }

      // 3. Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'ASSIGN_USER_ROLE',
        entity_type: 'profile',
        entity_id: selectedUser,
        metadata: { role: selectedRole, village_id: selectedVillage }
      });

      setSuccessMsg('User roles and village assignments updated successfully!');
      fetchSuperAdminData();
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  const getMockLogs = () => [
    { id: '1', action: 'VERIFY_PAYMENT', entity_type: 'payment', created_at: new Date().toISOString(), metadata: { or_number: 'OR-892104' } },
    { id: '2', action: 'PUBLISH_BLUEPRINT', entity_type: 'blueprint', created_at: new Date().toISOString(), metadata: { blueprint_id: 'bp-901' } },
    { id: '3', action: 'CREATE_VILLAGE', entity_type: 'village', created_at: new Date().toISOString(), metadata: { name: 'Emerald Ridge Heights' } }
  ];

  const displayedLogs = auditLogs.length > 0 ? auditLogs : getMockLogs();

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <Shield className="w-8 h-8 text-emerald-400" />
              Global Admin Center
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Complete administrative access. Create villages, manage user roles, map assignments, and review security audit logs.
            </p>
          </div>

          <button
            onClick={() => setShowVillageForm(!showVillageForm)}
            className="self-start md:self-auto flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Village Community
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4.5 h-4.5" />
            {successMsg}
          </div>
        )}

        {/* Village Creation CRUD Box */}
        {showVillageForm && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 glass-card space-y-4 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Setup New Smart Village Community
            </h3>

            <form onSubmit={handleCreateVillage} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Village Name</label>
                  <input
                    type="text"
                    required
                    value={vName}
                    onChange={(e) => setVName(e.target.value)}
                    placeholder="e.g. Platinum Valleys Subdivision"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={vSlug}
                    onChange={(e) => setVSlug(e.target.value)}
                    placeholder="e.g. platinum-valleys"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Description Summary</label>
                <textarea
                  rows={2}
                  value={vDesc}
                  onChange={(e) => setVDesc(e.target.value)}
                  placeholder="Experience eco-friendly living complete with T-junction snaped road designs, custom layouts..."
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Street Address</label>
                  <input
                    type="text"
                    required
                    value={vAddress}
                    onChange={(e) => setVAddress(e.target.value)}
                    placeholder="KM 45 Highway Ave"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                  <input
                    type="text"
                    value={vCity}
                    onChange={(e) => setVCity(e.target.value)}
                    placeholder="Tagaytay"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Province</label>
                  <input
                    type="text"
                    value={vProvince}
                    onChange={(e) => setVProvince(e.target.value)}
                    placeholder="Cavite"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Starting Lot Price (₱)</label>
                <input
                  type="number"
                  value={vPrice}
                  onChange={(e) => setVPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-slate-200 outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowVillageForm(false)}
                  className="py-2 px-4 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold outline-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVillage}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 px-5 rounded-xl transition outline-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingVillage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Community
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Content Section: Split user assignment and audit logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* User Assignments Manager Panel */}
          <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 mb-2 border-b border-slate-850 pb-2">
                <UserCheck className="w-4.5 h-4.5 text-emerald-400" />
                Staff Roles & Assignments
              </h3>
              <p className="text-[11px] text-slate-500 leading-normal">
                Elevate customer accounts to professional staffing roles (Village Admin, accounting, architect) and bind them to village scopes.
              </p>
            </div>

            <form onSubmit={handleAssignUser} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Select User Profile</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2 outline-none text-slate-200 cursor-pointer"
                >
                  {profiles.length === 0 ? (
                    <option value="">No users registered</option>
                  ) : (
                    profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Elevate Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2 outline-none text-slate-200 cursor-pointer"
                >
                  <option value="village_admin">Village Admin (Assigned Village Manager)</option>
                  <option value="accounting">Accounting (Payment Auditor)</option>
                  <option value="architect">Architect (Blueprint Canvas Sketcher)</option>
                  <option value="super_admin">Super Admin (Full System Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Assign Subdivision Scope</label>
                <select
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2 outline-none text-slate-200 cursor-pointer"
                >
                  {villages.length === 0 ? (
                    <>
                      <option value="mock-1">Emerald Ridge Heights (Demo scope)</option>
                      <option value="mock-2">Teal Lagoon Residences (Demo scope)</option>
                    </>
                  ) : (
                    villages.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="submit"
                disabled={assigning}
                className="w-full flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow transition duration-200 outline-none cursor-pointer disabled:opacity-50"
              >
                {assigning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5" />
                    Assign Role & Village
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Split: Security Audit logs */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-855 pb-2">
              <Activity className="w-4.5 h-4.5 text-emerald-400" />
              Security Audit Ledger
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 select-none">
                    <th className="py-2 px-1">Action logged</th>
                    <th className="py-2 px-1">Triggered Entity</th>
                    <th className="py-2 px-1">Ledger Timestamp</th>
                    <th className="py-2 px-1 text-right">Audit Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-350">
                  {displayedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-950/10 transition-colors">
                      <td className="py-3 px-1">
                        <span className="font-mono font-bold text-emerald-400 text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-1 uppercase text-slate-500 text-[10px]">{log.entity_type}</td>
                      <td className="py-3 px-1 text-slate-500">
                        {mounted ? new Date(log.created_at).toLocaleString() : ''}
                      </td>
                      <td className="py-3 px-1 text-right font-mono text-[10px] text-slate-400">
                        {JSON.stringify(log.metadata || '{}')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}
