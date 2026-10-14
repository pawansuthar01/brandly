import { AdminUserWorkspacePage } from '@/components/admin-pages';

export default function AdminUserCampaignsRoute({ params }: { params: { id: string } }) {
  return <AdminUserWorkspacePage id={params.id} section="campaigns" />;
}
