import SuperAdminAccountsPage from '../page';

export default function CustomerAccountsPage() {
  return (
    <SuperAdminAccountsPage
      defaultRoleFilter="customer"
      pageTitle="Customer Accounts"
      pageDescription="Review and manage customer profiles across active villages."
    />
  );
}
