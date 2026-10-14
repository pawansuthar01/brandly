'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import styles from '@/components/admin-shell.module.css';
import { readAdminSession } from '@/lib/admin-auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const [ready, setReady] = useState(isLogin);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    const session = readAdminSession();
    if (!session) router.replace('/admin/login');
    else setReady(true);
  }, [isLogin, router]);

  if (!ready) return <div className={styles.shell} />;
  return isLogin ? <>{children}</> : <AdminShell>{children}</AdminShell>;
}
