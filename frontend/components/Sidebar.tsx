'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  History,
  FolderOpen,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuthStore, useUIStore } from '@/stores';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { label: '首页', href: '/', icon: <Home className="h-5 w-5" /> },
  { label: '历史记录', href: '/history', icon: <History className="h-5 w-5" /> },
  { label: '分组管理', href: '/groups', icon: <FolderOpen className="h-5 w-5" /> },
];

const bottomNavItems: NavItem[] = [
  { label: '设置', href: '/settings', icon: <Settings className="h-5 w-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
      logout();
      toast.success('已退出登录');
      router.push('/login');
    } catch {
      toast.error('退出失败');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
    return (
      <Link
        href={item.href}
        onClick={() => {
          // Close sidebar on mobile after navigation
          if (window.innerWidth < 1024) {
            setSidebarOpen(false);
          }
        }}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        title={!sidebarOpen ? item.label : undefined}
      >
        {item.icon}
        <span className={cn('transition-opacity', sidebarOpen ? 'opacity-100' : 'lg:opacity-0 lg:w-0')}>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold">Omni-Notes</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 z-50 flex h-screen flex-col border-r bg-card transition-all duration-300',
          // Mobile: slide from left, hidden by default
          'left-0 -translate-x-full lg:translate-x-0',
          sidebarOpen && 'translate-x-0',
          // Desktop: always visible, width changes
          sidebarOpen ? 'w-64' : 'lg:w-16'
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          {sidebarOpen ? (
            <>
              <Link href="/" className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-bold">Omni-Notes</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="hidden lg:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="relative w-full flex justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border bg-background shadow-sm"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {mainNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="border-t p-3">
          <nav className="flex flex-col gap-1 mb-3">
            {bottomNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          <Separator className="my-3" />

          {/* User info and logout */}
          {user && (
            <div className={cn('flex items-center gap-3', !sidebarOpen && 'lg:justify-center')}>
              {sidebarOpen ? (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.is_guest ? '访客用户' : '注册用户'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    title="退出登录"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  title="退出登录"
                  className="hidden lg:flex"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
