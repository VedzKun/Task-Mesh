'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '⬡' },
  { href: '/dashboard/queues', label: 'Queues', icon: '≡' },
  { href: '/dashboard/jobs', label: 'Jobs', icon: '◫' },
  { href: '/dashboard/workers', label: 'Workers', icon: '◉' },
  { href: '/dashboard/dlq', label: 'Dead Letter Queue', icon: '⚠', badge: true },
  { href: '/dashboard/metrics', label: 'Metrics', icon: '↗' },
];

const BOTTOM_ITEMS = [
  { href: '/dashboard/projects', label: 'Projects', icon: '⊞' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">⬡</div>
        <span className="logo-text">Task-Mesh</span>
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
            <span>{item.icon}</span>
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
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-avatar">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.name || 'User'}</div>
          <div className="user-role">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost btn-sm btn-icon"
          title="Logout"
          id="btn-logout"
        >
          ⏻
        </button>
      </div>
    </nav>
  );
}
