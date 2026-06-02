import DashboardShell from '@/components/layout/DashboardShell';

export default function AdminPlaceholderPage({ title, description }) {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="border-b border-[#e2e8f0] pb-5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#272727]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#64748b]">{description}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-extrabold text-[#272727]">Workspace ready</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[#64748b]">
            This section is connected to the admin navigation and ready for the next production workflow.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
