'use client';

import { useEffect, useState } from 'react';
import { readAdminSession, type AdminSession } from '@/lib/admin-auth';

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readAdminSession());
    setReady(true);
  }, []);

  return { session, ready, role: session?.role ?? null };
}
