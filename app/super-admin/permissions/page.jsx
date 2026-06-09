import { redirect } from 'next/navigation';

export default function SuperAdminPermissionsPage() {
  redirect('/super-admin/users');
}
