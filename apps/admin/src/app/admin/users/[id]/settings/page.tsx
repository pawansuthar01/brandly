import { AdminUserWorkspacePage } from '@/components/admin-pages';

export default function AdminUserSettingsRoute({ params }: { params: { id: string } }) {
  return <AdminUserWorkspacePage id={params.id} section="settings" />;
}
