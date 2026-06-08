import SuperAdminAccountsPage from '../page';

export default function AdminAccountsPage() {
  return (
    <SuperAdminAccountsPage
      defaultRoleFilter="village_admin"
      pageTitle="Admin Accounts"
      pageDescription="Manage village admin access, assignments, and operating scopes."
    />
  );
}
