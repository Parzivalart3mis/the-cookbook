'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export function useOwnerAccess() {
  const { userId } = useAuth();
  const [access, setAccess] = useState<{ userId: string; canEditImages: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetch('/api/account/access', { cache: 'no-store', signal: controller.signal })
      .then(r => r.ok ? r.json() : { canEditImages: false })
      .then(data => setAccess({ userId, canEditImages: data.canEditImages === true }))
      .catch(() => {});
    return () => controller.abort();
  }, [userId]);
  return { canEditImages: !!userId && access?.userId === userId && access.canEditImages };
}
