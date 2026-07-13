'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-context';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const TITLE_MAP: Record<string, string> = {
  dashboard: 'Overview',
  queues: 'Queues',
  jobs: 'Jobs',
  workers: 'Workers',
  dlq: 'Dead Letter Queue',
  projects: 'Projects',
};

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) return null;

  const segment = pathname.split('/').pop() ?? 'dashboard';
  const pageTitle = TITLE_MAP[segment] ?? segment;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title">{pageTitle}</span>
          <div className="status-pill">
            <span className="status-dot" />
            All systems operational
          </div>
        </header>
        {/* Page content */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <DashboardGuard>{children}</DashboardGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
