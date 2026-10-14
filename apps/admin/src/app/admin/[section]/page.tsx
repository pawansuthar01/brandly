import { AdminSectionPage } from '@/components/admin-pages';

export default function AdminSectionRoute({ params }: { params: { section: string } }) {
  return <AdminSectionPage section={params.section} />;
}
