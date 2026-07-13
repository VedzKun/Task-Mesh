'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, type ApiResponse } from '@/lib/api';
import Link from 'next/link';

interface Metrics {
  totalJobs: number;
  jobsByStatus: Record<string, number>;
  activeWorkers: number;
  throughput: { lastHour: number; lastDay: number };
  avgDurationMs: number | null;
  failureRatePercent: number;
}

interface ThroughputPoint { time: string; succeeded: number; failed: number; }

interface RecentJob {
  id: string;
  name: string;
  status: string;
  jobType: string;
  createdAt: string;
  queue?: { name: string };
}

interface Queue { id: string; name: string; projectId: string; }
interface Project { id: string; name: string; }

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#22c55e', RUNNING: '#5865f2', QUEUED: '#3b82f6',
  FAILED: '#ef4444', DLQ: '#dc2626', SCHEDULED: '#f59e0b',
  CLAIMED: '#a855f7', CANCELLED: '#6b7280',
};

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'badge-green', RUNNING: 'badge-purple', QUEUED: 'badge-blue',
  FAILED: 'badge-red', DLQ: 'badge-red', SCHEDULED: 'badge-amber',
  CLAIMED: 'badge-purple', CANCELLED: 'badge-gray',
};

/* ── Throughput chart ─────────────────────── */
function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  if (!data.length) {
    return <div className="empty-state" style={{ padding: 24 }}><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>No throughput data yet</span></div>;
  }
  const last = data.slice(-24);
  const maxVal = Math.max(...last.map((d) => d.succeeded + d.failed), 1);
  return (
    <div>
      <div className="chart-wrap">
        {last.map((d, i) => {
          const total = d.succeeded + d.failed;
          const hPct = (total / maxVal) * 100;
          const failRatio = total > 0 ? d.failed / total : 0;
          const color = failRatio > 0.3 ? 'var(--red)' : failRatio > 0 ? 'var(--amber)' : 'var(--green)';
          return (
            <div key={i} className="chart-bar" title={`${new Date(d.time).toLocaleTimeString()} · ✓${d.succeeded} ✗${d.failed}`}
              style={{ height: `${Math.max(hPct, 5)}%`, background: color }} />
          );
        })}
      </div>
      <div className="flex gap-3" style={{ marginTop: 12, fontSize: 11.5, color: 'var(--tx-3)' }}>
        <span style={{ color: 'var(--green)' }}>● Succeeded</span>
        <span style={{ color: 'var(--amber)' }}>● Mixed</span>
        <span style={{ color: 'var(--red)' }}>● Failed</span>
      </div>
    </div>
  );
}

/* ── Donut chart ──────────────────────────── */
function DonutChart({ statusCounts }: { statusCounts: Record<string, number> }) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (!total) return <div className="empty-state" style={{ padding: 24 }}><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>No jobs yet</span></div>;

  let offset = 0;
  const C = 2 * Math.PI * 52;
  const segments = Object.entries(statusCounts).filter(([, v]) => v > 0).map(([status, count]) => {
    const pct = count / total;
    const dash = pct * C;
    const seg = { status, count, dash, gap: C - dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center" style={{ gap: 20 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="12" />
        {segments.map((s) => (
          <circle key={s.status} cx="60" cy="60" r="52" fill="none"
            stroke={STATUS_COLORS[s.status] ?? '#6b7280'} strokeWidth="12"
            strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'all 500ms ease' }} />
        ))}
        <text x="60" y="56" textAnchor="middle" fill="var(--tx-1)" fontSize="18" fontWeight="700" fontFamily="Inter">{total}</text>
        <text x="60" y="70" textAnchor="middle" fill="var(--tx-3)" fontSize="9" fontFamily="Inter">TOTAL</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {segments.slice(0, 6).map((s) => (
          <div key={s.status} className="flex items-center gap-2" style={{ fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[s.status] ?? '#6b7280', flexShrink: 0 }} />
            <span style={{ color: 'var(--tx-3)', flex: 1 }}>{s.status}</span>
            <span style={{ color: 'var(--tx-2)', fontWeight: 600 }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Quick Submit Modal ───────────────────── */
function QuickSubmitModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [form, setForm] = useState({ queueId: '', name: '', jobType: 'DEFAULT', priority: 5, payload: '{}' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Project[]>>('/api/projects', token).then((r) => {
      setProjects(r.data);
      if (r.data[0]) setSelectedProject(r.data[0].id);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!selectedProject) return;
    api.get<ApiResponse<Queue[]>>(`/api/projects/${selectedProject}/queues`, token).then((r) => {
      setQueues(r.data);
      if (r.data[0]) setForm((f) => ({ ...f, queueId: r.data[0].id }));
    }).catch(() => {});
  }, [selectedProject, token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let payload: any;
    try { payload = JSON.parse(form.payload); } catch { toast('Invalid JSON payload', 'error'); return; }
    setLoading(true);
    try {
      await api.post('/api/jobs', { ...form, payload }, token);
      toast('Job submitted successfully', 'success');
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-heading">Submit a job</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body-inner">
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Project</label>
                <select className="form-select" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Queue</label>
                <select className="form-select" value={form.queueId} onChange={(e) => setForm({ ...form, queueId: e.target.value })}>
                  {queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Job name *</label>
              <input className="form-input" id="input-quick-job-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="send-welcome-email" required />
            </div>
            <div className="two-col">
              <div className="form-group">
                <label className="form-label">Job type</label>
                <input className="form-input" value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })} placeholder="DEFAULT" />
              </div>
              <div className="form-group">
                <label className="form-label">Priority (1–10)</label>
                <input className="form-input" type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Payload (JSON)</label>
              <textarea
                className="form-input"
                rows={4}
                value={form.payload}
                onChange={(e) => setForm({ ...form, payload: e.target.value })}
                style={{ resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !form.queueId || !form.name}>
              {loading ? <><span className="spinner" /> Submitting…</> : 'Submit job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────── */
export default function DashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [throughput, setThroughput] = useState<ThroughputPoint[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<any>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [m, t, j] = await Promise.all([
        api.get<ApiResponse<Metrics>>('/api/metrics/overview', token),
        api.get<ApiResponse<ThroughputPoint[]>>('/api/metrics/throughput', token),
        api.get<any>(`/api/jobs?limit=8&page=1`, token),
      ]);
      setMetrics(m.data);
      setThroughput(t.data);
      setRecentJobs(j.data ?? []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';
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
    return () => { clearInterval(interval); wsRef.current?.close(); };
  }, [fetchData]);

  const active  = liveMetrics?.activeWorkers ?? metrics?.activeWorkers ?? 0;
  const queued  = liveMetrics?.queuedJobs   ?? metrics?.jobsByStatus?.QUEUED  ?? 0;
  const running = liveMetrics?.runningJobs  ?? metrics?.jobsByStatus?.RUNNING ?? 0;

  const statCards = [
    { label: 'Total jobs',    value: metrics?.totalJobs ?? 0 },
    { label: 'Active workers', value: active },
    { label: 'Jobs / hr',     value: metrics?.throughput.lastHour ?? 0 },
    { label: 'Failure rate',  value: `${(metrics?.failureRatePercent ?? 0).toFixed(1)}%` },
    { label: 'Avg duration',  value: metrics?.avgDurationMs ? `${Math.round(metrics.avgDurationMs)}ms` : '—' },
    { label: 'Jobs today',    value: metrics?.throughput.lastDay ?? 0 },
  ];

  return (
    <>
      {/* Stat row */}
      <div className="stat-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts + Recent jobs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Throughput — last 24h</span>
            <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{throughput.length} buckets</span>
          </div>
          <div className="card-body"><ThroughputChart data={throughput} /></div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Jobs by status</span>
          </div>
          <div className="card-body"><DonutChart statusCounts={metrics?.jobsByStatus ?? {}} /></div>
        </div>
      </div>

      {/* Recent jobs + Quick submit side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* Recent jobs feed */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent jobs</span>
            <Link href="/dashboard/jobs" style={{ fontSize: 12, color: 'var(--brand)' }}>View all →</Link>
          </div>
          <div style={{ overflow: 'hidden' }}>
            {recentJobs.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 20px' }}>
                <div className="empty-title" style={{ fontSize: 13 }}>No jobs yet</div>
                <div className="empty-sub">Submit your first job to get started.</div>
              </div>
            ) : (
              recentJobs.map((job, i) => (
                <div
                  key={job.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 20px',
                    borderBottom: i < recentJobs.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 100ms',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: STATUS_COLORS[job.status] ?? '#6b7280',
                  }} />
                  {/* Name + queue */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 1 }}>
                      {job.queue?.name ?? '—'} · {job.jobType}
                    </div>
                  </div>
                  {/* Badge */}
                  <span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-gray'}`}>{job.status}</span>
                  {/* Time */}
                  <div style={{ fontSize: 11.5, color: 'var(--tx-3)', flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
                    {timeAgo(job.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Live snapshot + Quick submit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Live snapshot */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live snapshot</span>
              {wsConnected && (
                <span className="badge badge-green" style={{ fontSize: 10 }}>
                  <span className="badge-dot" style={{ background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
                  WS live
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Queued',  value: queued,  color: 'var(--blue)'  },
                { label: 'Running', value: running, color: 'var(--brand)' },
                { label: 'Workers', value: active,  color: 'var(--green)' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick submit */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick submit</span>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--tx-2)', marginBottom: 14, lineHeight: 1.5 }}>
                Submit a one-off job to any queue without leaving the dashboard.
              </p>
              <button
                className="btn btn-primary w-full"
                style={{ height: 36, fontSize: 13 }}
                onClick={() => setShowSubmit(true)}
                id="btn-quick-submit"
              >
                <PlusIcon /> Submit job
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSubmit && (
        <QuickSubmitModal onClose={() => setShowSubmit(false)} onSubmitted={fetchData} />
      )}
    </>
  );
}

/* ── Helpers ──────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

function PlusIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 2v12M2 8h12" /></svg>;
}
function CloseIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>;
}
