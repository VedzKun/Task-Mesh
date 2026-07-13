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
  IDLE:     'badge-green',
  BUSY:     'badge-blue',
  DRAINING: 'badge-amber',
  OFFLINE:  'badge-gray',
};

export default function WorkersPage() {
  const { token } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<Worker[]>>('/api/workers', token);
      setWorkers(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWorkers();
    const iv = setInterval(fetchWorkers, 10000);
    return () => clearInterval(iv);
  }, [fetchWorkers]);

  const active  = workers.filter((w) => w.status !== 'OFFLINE').length;
  const busy    = workers.filter((w) => w.status === 'BUSY').length;
  const running = workers.reduce((a, w) => a + w.currentJobs, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-h1">Workers</div>
          <div className="page-sub">Auto-refreshes every 10s</div>
        </div>
        <span className="badge badge-green">
          <span className="badge-dot" style={{ background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
          Live
        </span>
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Active workers', value: active,  color: 'var(--green)' },
          { label: 'Busy workers',   value: busy,    color: 'var(--brand)' },
          { label: 'Jobs running',   value: running, color: 'var(--blue)'  },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state"><div className="spinner spinner-lg" /></div>
      ) : workers.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <div className="empty-icon"><WorkerIcon /></div>
          <div className="empty-title">No workers registered</div>
          <div className="empty-sub">Start a worker process to begin processing jobs.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Host / PID</th>
                <th>Status</th>
                <th>Load</th>
                <th>Executions</th>
                <th>Last heartbeat</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const loadPct = (w.currentJobs / w.concurrency) * 100;
                const secAgo = Math.round((Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000);
                const stale = secAgo > 30;
                return (
                  <tr key={w.id} id={`worker-row-${w.id}`} style={{ opacity: w.isStale ? 0.55 : 1 }}>
                    <td>
                      <div className="font-mono text-xs" style={{ color: 'var(--tx-2)' }}>{w.id.slice(0, 8)}…</div>
                      {w.isStale && <span className="badge badge-amber" style={{ marginTop: 4 }}>Stale</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{w.hostname}</div>
                      <div className="mono text-xs" style={{ color: 'var(--tx-3)' }}>PID {w.pid}</div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[w.status] ?? 'badge-gray'}`}>
                        <span className="badge-dot" style={{
                          background: w.status === 'BUSY' ? 'var(--blue)' : w.status === 'IDLE' ? 'var(--green)' : w.status === 'DRAINING' ? 'var(--amber)' : 'var(--tx-3)'
                        }} />
                        {w.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-track" style={{ width: 64 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${loadPct}%`,
                              background: loadPct > 80 ? 'var(--red)' : loadPct > 50 ? 'var(--amber)' : 'var(--green)',
                            }}
                          />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--tx-2)' }}>{w.currentJobs}/{w.concurrency}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{w._count?.executions ?? 0}</td>
                    <td>
                      <span className="text-xs" style={{ color: stale ? 'var(--red)' : 'var(--green)', fontWeight: 500 }}>
                        {secAgo}s ago
                      </span>
                    </td>
                    <td className="mono text-xs muted">{new Date(w.registeredAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function WorkerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
    </svg>
  );
}
