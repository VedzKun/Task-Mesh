'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiResponse } from '@/lib/api';

interface Metrics {
  totalJobs: number;
  jobsByStatus: Record<string, number>;
  activeWorkers: number;
  throughput: { lastHour: number; lastDay: number };
  avgDurationMs: number | null;
  failureRatePercent: number;
}

interface ThroughputPoint { time: string; succeeded: number; failed: number; }

const STATUS_COLORS: Record<string, string> = {
  QUEUED: '#38bdf8', RUNNING: '#6c8cff', COMPLETED: '#22d3a0',
  FAILED: '#f87171', DLQ: '#ef4444', SCHEDULED: '#fbbf24',
  CLAIMED: '#a855f7', CANCELLED: '#7d8590',
};

function MiniBarChart({ data }: { data: ThroughputPoint[] }) {
  if (!data.length) return <div className="chart-container flex-center text-muted">No data</div>;
  const maxVal = Math.max(...data.map((d) => d.succeeded + d.failed), 1);
  const last24 = data.slice(-24);

  return (
    <div className="chart-container" style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', padding: '0 4px' }}>
      {last24.map((d, i) => {
        const total = d.succeeded + d.failed;
        const heightPct = (total / maxVal) * 100;
        const failRatio = total > 0 ? d.failed / total : 0;
        return (
          <div
            key={i}
            title={`${new Date(d.time).toLocaleTimeString()}\nSucceeded: ${d.succeeded} Failed: ${d.failed}`}
            style={{
              flex: 1,
              height: `${Math.max(heightPct, 4)}%`,
              background: failRatio > 0.3
                ? 'var(--color-danger)'
                : failRatio > 0
                ? 'var(--color-warning)'
                : 'var(--color-success)',
              borderRadius: '3px 3px 0 0',
              opacity: 0.85,
              transition: 'height 0.3s ease',
            }}
          />
        );
      })}
    </div>
  );
}

function StatusDonut({ statusCounts }: { statusCounts: Record<string, number> }) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (!total) return <div className="flex-center" style={{ height: 160, color: 'var(--color-text-muted)' }}>No jobs yet</div>;

  let offset = 0;
  const circumference = 2 * Math.PI * 60;
  const segments = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([status, count]) => {
      const pct = count / total;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const seg = { status, count, dash, gap, offset };
      offset += dash;
      return seg;
    });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx="70" cy="70" r="60"
            fill="none"
            stroke={STATUS_COLORS[seg.status] || '#7d8590'}
            strokeWidth="16"
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-seg.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px', transition: 'all 0.5s ease' }}
          />
        ))}
        <text x="70" y="70" textAnchor="middle" dy=".35em" fill="var(--color-text)" fontSize="20" fontWeight="800" fontFamily="Inter">
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle" fill="var(--color-text-muted)" fontSize="10" fontFamily="Inter">
          TOTAL
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {segments.map((seg) => (
          <div key={seg.status} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[seg.status] || '#7d8590', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-muted)', minWidth: 80 }}>{seg.status}</span>
            <span style={{ fontWeight: 600 }}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [throughput, setThroughput] = useState<ThroughputPoint[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchMetrics = async () => {
    try {
      const [m, t] = await Promise.all([
        api.get<ApiResponse<Metrics>>('/api/metrics/overview', token),
        api.get<ApiResponse<ThroughputPoint[]>>('/api/metrics/throughput', token),
      ]);
      setMetrics(m.data);
      setThroughput(t.data);
    } catch {}
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);

    // WebSocket for live updates
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'METRICS_UPDATE') setLiveMetrics(msg.data);
        } catch {}
      };
    } catch {}

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [token]);

  const active = liveMetrics?.activeWorkers ?? metrics?.activeWorkers ?? 0;
  const queued = liveMetrics?.queuedJobs ?? metrics?.jobsByStatus?.QUEUED ?? 0;
  const running = liveMetrics?.runningJobs ?? metrics?.jobsByStatus?.RUNNING ?? 0;

  const STAT_CARDS = [
    {
      icon: '⬡', label: 'Total Jobs', value: metrics?.totalJobs ?? 0,
      accent: 'var(--color-primary)', accentDim: 'var(--color-primary-dim)',
    },
    {
      icon: '◉', label: 'Active Workers', value: active,
      accent: 'var(--color-success)', accentDim: 'var(--color-success-dim)',
    },
    {
      icon: '≡', label: 'Jobs (Last Hour)', value: metrics?.throughput.lastHour ?? 0,
      accent: 'var(--color-info)', accentDim: 'var(--color-info-dim)',
    },
    {
      icon: '⚠', label: 'Failure Rate', value: `${metrics?.failureRatePercent ?? 0}%`,
      accent: 'var(--color-danger)', accentDim: 'var(--color-danger-dim)',
    },
  ];

  return (
    <>
      <header className="header">
        <h1 className="header-title">Overview</h1>
        {wsConnected && (
          <div className="header-live-indicator">
            <span className="live-dot" />
            Live
          </div>
        )}
      </header>

      <div className="page-container">
        {/* Stat Cards */}
        <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
          {STAT_CARDS.map((s) => (
            <div
              key={s.label}
              className="stat-card"
              style={{ '--stat-accent': s.accent, '--stat-accent-dim': s.accentDim } as any}
            >
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid-2-3">
          {/* Throughput Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">↗ Throughput (last 6h)</span>
              <span className="text-muted text-sm">{throughput.length} buckets</span>
            </div>
            <div className="card-body">
              <MiniBarChart data={throughput} />
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-success)' }}>■ Succeeded</span>
                <span style={{ color: 'var(--color-danger)' }}>■ Failed</span>
                <span style={{ color: 'var(--color-warning)' }}>■ Mixed</span>
              </div>
            </div>
          </div>

          {/* Status Donut */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">◫ Jobs by Status</span>
            </div>
            <div className="card-body">
              <StatusDonut statusCounts={metrics?.jobsByStatus ?? {}} />
            </div>
          </div>
        </div>

        {/* Live counters */}
        <div className="grid-3" style={{ marginTop: 'var(--space-5)' }}>
          {[
            { label: 'Queued', value: queued, color: 'var(--color-info)' },
            { label: 'Running', value: running, color: 'var(--color-primary)' },
            { label: 'Avg Duration', value: metrics?.avgDurationMs ? `${Math.round(metrics.avgDurationMs)}ms` : '—', color: 'var(--color-success)' },
          ].map((item) => (
            <div key={item.label} className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '36px', fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
