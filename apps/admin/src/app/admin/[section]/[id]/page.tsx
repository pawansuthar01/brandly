import { AdminDetailPage } from '@/components/admin-pages';

export default function AdminEntityRoute({ params }: { params: { section: string; id: string } }) {
  return <AdminDetailPage section={params.section} id={params.id} />;
}
