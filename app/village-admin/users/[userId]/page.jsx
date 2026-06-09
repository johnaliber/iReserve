import UserDetailPage from '@/components/admin/UserDetailPage';

export default async function VillageAdminUserDetailPage({ params }) {
  const { userId } = await params;
  return <UserDetailPage userId={userId} backHref="/village-admin/users" limitedMode />;
}
