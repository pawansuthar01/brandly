import { AdminUserWorkspacePage } from '@/components/admin-pages';

export default function AdminUserProposalsRoute({ params }: { params: { id: string } }) {
  return <AdminUserWorkspacePage id={params.id} section="proposals" />;
}
