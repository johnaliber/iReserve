import DashboardShell from '@/components/layout/DashboardShell';
import ReportCenter from '@/components/reports/ReportCenter';

export default function AccountingReportsPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1700px]">
        <ReportCenter accountingOnly />
      </div>
    </DashboardShell>
  );
}
