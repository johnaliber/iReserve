import SuperAdminAccountsPage from '../page';

export default function AccountingAccountsPage() {
  return (
    <SuperAdminAccountsPage
      defaultRoleFilter="accounting"
      pageTitle="Accounting Accounts"
      pageDescription="Manage accounting users responsible for payment verification and booking audit."
    />
  );
}
