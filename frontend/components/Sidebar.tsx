'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard',         label: 'Overview',  icon: OverviewIcon },
      { href: '/dashboard/queues',  label: 'Queues',    icon: QueueIcon },
      { href: '/dashboard/jobs',    label: 'Jobs',      icon: JobIcon },
      { href: '/dashboard/workers', label: 'Workers',   icon: WorkerIcon },
      { href: '/dashboard/dlq',     label: 'DLQ',       icon: DLQIcon, badge: true },
    ],
  },
  {
    label: 'CONFIG',
    items: [
      { href: '/dashboard/projects', label: 'Projects', icon: ProjectIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <LogoIcon />
        </div>
        <span className="logo-name">TaskMesh</span>
      </div>

      {/* Nav */}
      <div className="sidebar-body">
        {NAV.map((section) => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${active ? ' active' : ''}`}
                  id={`nav-${item.label.toLowerCase()}`}
                >
                  <span className="nav-item-icon">
                    <Icon />
                  </span>
                  {item.label}
                  {item.badge && <DLQBadge />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-row">
          <div className="user-avatar">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="user-name">{user?.name ?? 'User'}</div>
            <div className="user-role">{user?.role ?? 'member'}</div>
          </div>
          <button
            className="btn-logout"
            onClick={logout}
            title="Sign out"
            id="btn-logout"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Badge for DLQ (loaded dynamically later) ── */
function DLQBadge() {
  return <span className="nav-badge">!</span>;
}

/* ── Icons (inline SVG, 16×16) ───────────────── */
function LogoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" opacity=".6" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" opacity=".6" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" opacity=".3" />
    </svg>
  );
}

function OverviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M2 8h9M2 12h6" />
    </svg>
  );
}

function JobIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8h6M5 5h3M5 11h4" />
    </svg>
  );
}

function WorkerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  );
}

function DLQIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l6 10H2L8 2z" />
      <path d="M8 6v3M8 11v.5" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4a2 2 0 012-2h2l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 8H2M6 4l-4 4 4 4" />
      <path d="M10 2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2" />
    </svg>
  );
}
