'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiResponse } from '@/lib/api';

interface Worker {
  id: string;
  hostname: string;
  pid: number;
  status: string;
  concurrency: number;
  currentJobs: number;
  lastHeartbeat: string;
  registeredAt: string;
  isStale: boolean;
  _count?: { executions: number };
}

const STATUS_BADGE: Record<string, string> = {
  IDLE: 'badge-idle', BUSY: 'badge-running', DRAINING: 'badge-scheduled', OFFLINE: 'badge-offline',
};

export default function WorkersPage() {
  const { token } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<Worker[]>>('/api/workers', token);
      setWorkers(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, 10000);
    return () => clearInterval(iv);
  }, [fetch]);

  const activeCount = workers.filter((w) => w.status !== 'OFFLINE').length;
  const busyCount = workers.filter((w) => w.status === 'BUSY').length;
  const totalRunning = workers.reduce((a, w) => a + w.currentJobs, 0);

  return (
    <>
      <header className="header">
        <h1 className="header-title">Workers</h1>
        <div className="header-live-indicator">
          <span className="live-dot" />
          Auto-refreshes every 10s
        </div>
      </header>

      <div className="page-container">
        <div className="grid-3" style={{ marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Active Workers', value: activeCount, color: 'var(--color-success)' },
            { label: 'Busy Workers', value: busyCount, color: 'var(--color-primary)' },
            { label: 'Jobs Running', value: totalRunning, color: 'var(--color-info)' },
          ].map((s) => (
            <div key={s.label} className="stat-card" style={{ '--stat-accent': s.color } as any}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : workers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◉</div>
            <div className="empty-state-title">No workers registered</div>
            <div className="empty-state-desc">Start a worker process to begin processing jobs</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Worker ID</th>
                  <th>Host / PID</th>
                  <th>Status</th>
                  <th>Load</th>
                  <th>Total Executions</th>
                  <th>Last Heartbeat</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => {
                  const loadPct = (w.currentJobs / w.concurrency) * 100;
                  const secAgo = Math.round((Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000);
                  return (
                    <tr key={w.id} id={`worker-row-${w.id}`} style={{ opacity: w.isStale ? 0.6 : 1 }}>
                      <td>
                        <div className="text-mono">{w.id.slice(0, 8)}…</div>
                        {w.isStale && <div style={{ fontSize: '11px', color: 'var(--color-warning)' }}>⚠ Stale</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{w.hostname}</div>
                        <div className="text-mono" style={{ color: 'var(--color-text-muted)' }}>PID {w.pid}</div>
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[w.status] || ''}`}>{w.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="progress" style={{ width: 80 }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${loadPct}%`,
                                background: loadPct > 80 ? 'var(--color-danger)' : loadPct > 50 ? 'var(--color-warning)' : 'var(--color-success)',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '12px' }}>{w.currentJobs}/{w.concurrency}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{w._count?.executions ?? 0}</td>
                      <td>
                        <span style={{ fontSize: '12px', color: secAgo > 30 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {secAgo}s ago
                        </span>
                      </td>
                      <td className="td-mono">{new Date(w.registeredAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
