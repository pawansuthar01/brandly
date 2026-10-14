import { AdminUserWorkspacePage } from '@/components/admin-pages';

export default function AdminUserActivityRoute({ params }: { params: { id: string } }) {
  return <AdminUserWorkspacePage id={params.id} section="activity" />;
}
