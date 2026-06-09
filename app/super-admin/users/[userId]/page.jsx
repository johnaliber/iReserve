import UserDetailPage from '@/components/admin/UserDetailPage';

export default async function SuperAdminUserDetailPage({ params }) {
  const { userId } = await params;
  return <UserDetailPage userId={userId} />;
}
