'use client';

import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen } = useUIStore();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main
          className={cn(
            'min-h-screen transition-all duration-300',
            // Mobile: add top padding for header, no left margin
            'pt-14 lg:pt-0',
            // Desktop: left margin based on sidebar state
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
          )}
        >
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
