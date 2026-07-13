'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-context';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <header className="header" style={{ height: '64px', backgroundColor: 'rgba(5, 20, 36, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 var(--space-8)', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div className="flex items-center gap-4">
            <h2 className="font-headline text-[20px] font-bold tracking-tight text-white capitalize">
              {pathname.split('/').pop() === 'dashboard' ? 'Overview' : pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} />
              <span className="font-label text-[12px] text-white">System Online</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-white/70 hover:bg-white/5 rounded-lg transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>search</span>
              </button>
              <div className="w-[1px] h-6 bg-white/10" />
              <button className="flex items-center gap-2 px-3 py-1.5 text-white font-label text-[14px] rounded-lg shadow-sm transition-transform" style={{ backgroundColor: 'var(--color-primary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                New Job
              </button>
            </div>
          </div>
        </header>
        {children}
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
