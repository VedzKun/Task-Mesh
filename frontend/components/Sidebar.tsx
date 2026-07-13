'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { href: '/dashboard/queues', label: 'Queues', icon: 'queue' },
  { href: '/dashboard/jobs', label: 'Jobs', icon: 'search_insights' },
  { href: '/dashboard/workers', label: 'Workers', icon: 'engineering' },
  { href: '/dashboard/dlq', label: 'Dead Letter Queue', icon: 'report_problem', badge: true },
];

const BOTTOM_ITEMS = [
  { href: '/dashboard/projects', label: 'Projects', icon: 'folder_open' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }}>
          <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>hub</span>
        </div>
        <span className="logo-text font-headline text-[18px]">Task-Mesh</span>
      </div>

      <div className="sidebar-nav">
        <span className="nav-section-label">Main</span>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: pathname === item.href ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <span className="nav-section-label" style={{ marginTop: '8px' }}>Config</span>
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: pathname === item.href ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
        <div className="user-avatar">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.name || 'User'}</div>
          <div className="user-role font-label">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost btn-sm btn-icon"
          title="Logout"
          id="btn-logout"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
        </button>
      </div>
    </nav>
  );
}
