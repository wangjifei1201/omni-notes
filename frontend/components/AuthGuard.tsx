'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { authApi } from '@/lib/api';

const publicPaths = ['/login', '/register'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setUser, setLoading } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const isPublic = publicPaths.includes(pathname);

        if (isAuthenticated) {
          // Already authenticated
          if (isPublic) {
            router.push('/');
          }
          setIsChecking(false);
          setLoading(false);
          return;
        }

        // Try to get current user (validates session)
        try {
          const user = await authApi.getCurrentUser();
          setUser(user);
          if (isPublic) {
            router.push('/');
          }
        } catch {
          // Not authenticated
          setUser(null);
          if (!isPublic) {
            router.push('/login');
          }
        }
      } finally {
        setIsChecking(false);
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, isAuthenticated, router, setUser, setLoading]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
