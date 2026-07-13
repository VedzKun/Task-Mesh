'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, type ApiResponse, type Pagination } from '@/lib/api';

interface Job {
  id: string;
  name: string;
  status: string;
  jobType: string;
  priority: number;
  attempts: number;
  maxRetries: number;
  runAt: string;
  createdAt: string;
  completedAt?: string;
  lastError?: string;
  queue?: { name: string; projectId: string };
}

const STATUS_BADGE: Record<string, string> = {
  QUEUED: 'badge-blue', RUNNING: 'badge-purple', COMPLETED: 'badge-green',
  FAILED: 'badge-red', DLQ: 'badge-red', SCHEDULED: 'badge-amber',
  CLAIMED: 'badge-purple', CANCELLED: 'badge-gray',
};

const STATUSES = ['', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DLQ', 'SCHEDULED', 'CLAIMED', 'CANCELLED'];

/* ─── Job Detail Modal ─────────────────────────────── */
function JobDetailModal({ jobId, token, onClose, onRetry }: { jobId: string; token: string | null; onClose: () => void; onRetry: () => void }) {
  const [job, setJob] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get<ApiResponse<any>>(`/api/jobs/${jobId}`, token).then((r) => setJob(r.data)).catch(() => {});
  }, [jobId, token]);

  const retry = async () => {
    try { await api.post(`/api/jobs/${jobId}/retry`, {}, token); toast('Job queued for retry', 'success'); onRetry(); onClose(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  const cancel = async () => {
    try { await api.post(`/api/jobs/${jobId}/cancel`, {}, token); toast('Job cancelled', 'success'); onRetry(); onClose(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  if (!job) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="loading-state" style={{ padding: 48 }}><div className="spinner spinner-lg" /></div>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-heading">{job.name}</div>
            <div className="font-mono text-xs" style={{ color: 'var(--tx-3)', marginTop: 3 }}>{job.id}</div>
          </div>
          <div className="flex items-center gap-2">
            {['FAILED', 'DLQ', 'CANCELLED'].includes(job.status) && (
              <button className="btn btn-success btn-sm" onClick={retry}><RetryIcon /> Retry</button>
            )}
            {['QUEUED', 'SCHEDULED'].includes(job.status) && (
              <button className="btn btn-danger btn-sm" onClick={cancel}><CloseIcon /> Cancel</button>
            )}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
          </div>
        </div>
        <div className="modal-body-inner">
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {[
              ['Status', <span key="s" className={`badge ${STATUS_BADGE[job.status] ?? 'badge-gray'}`}>{job.status}</span>],
              ['Type', <span key="t" className="font-mono text-xs">{job.jobType}</span>],
              ['Priority', `P${job.priority}`],
              ['Attempts', `${job.attempts} / ${job.maxRetries}`],
              ['Queue', job.queue?.name ?? '—'],
              ['Run At', new Date(job.runAt).toLocaleString()],
              ['Created', new Date(job.createdAt).toLocaleString()],
              ['Completed', job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'],
            ].map(([k, v]) => (
              <div key={k as string} style={{ background: 'var(--bg-elevated)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500, marginBottom: 4 }}>{k as string}</div>
                <div style={{ fontSize: 13, color: 'var(--tx-1)' }}>{v as any}</div>
              </div>
            ))}
          </div>

          {/* Payload */}
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 500, marginBottom: 8 }}>PAYLOAD</div>
            <div className="code-block">{JSON.stringify(job.payload, null, 2)}</div>
          </div>

          {/* Error */}
          {job.lastError && (
            <div className="alert alert-error">
              <ErrorIcon />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Last error</div>
                <div style={{ fontSize: 12 }}>{job.lastError}</div>
              </div>
            </div>
          )}

          {/* Execution history */}
          {job.executions?.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 500, marginBottom: 8 }}>EXECUTION HISTORY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {job.executions.slice(0, 5).map((ex: any) => (
                  <div key={ex.id} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Attempt {ex.attempt}</span>
                      <span className={`badge ${STATUS_BADGE[ex.status] ?? 'badge-gray'} text-xs`}>{ex.status}</span>
                      <span className="ml-auto text-xs" style={{ color: 'var(--tx-3)' }}>{ex.durationMs ? `${ex.durationMs}ms` : 'Running'}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--tx-3)' }}>{new Date(ex.startedAt).toLocaleString()}</div>
                    {ex.errorMessage && <div className="text-xs" style={{ color: 'var(--red)', marginTop: 4 }}>{ex.errorMessage}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {job.logs?.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 500, marginBottom: 8 }}>LOGS</div>
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', maxHeight: 180, overflowY: 'auto' }}>
                {job.logs.map((log: any) => (
                  <div key={log.id} className="flex gap-3" style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ color: log.level === 'ERROR' ? 'var(--red)' : log.level === 'WARN' ? 'var(--amber)' : 'var(--tx-3)', fontWeight: 600, width: 36 }}>{log.level}</span>
                    <span style={{ color: 'var(--tx-3)', flexShrink: 0 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span style={{ color: 'var(--tx-2)' }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────── */
export default function JobsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('page', String(filters.page));
      const res = await api.get<any>(`/api/jobs?${params}`, token);
      setJobs(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-h1">Jobs</div>
          <div className="page-sub">{pagination?.total ?? '–'} total jobs</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="form-input"
            style={{ width: 190 }}
            placeholder="Search jobs…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            id="input-job-search"
          />
          <select
            className="form-select"
            style={{ width: 140 }}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            id="select-job-status"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner spinner-lg" /></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Queue</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Attempts</th>
                  <th>Scheduled</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--tx-3)' }}>
                      No jobs found
                    </td>
                  </tr>
                ) : jobs.map((job) => (
                  <tr
                    key={job.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedJob(job.id)}
                    id={`job-row-${job.id}`}
                  >
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{job.name}</div>
                      <div className="mono text-xs" style={{ color: 'var(--tx-3)' }}>{job.id.slice(0, 8)}…</div>
                    </td>
                    <td className="muted">{job.queue?.name ?? '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-gray'}`}>{job.status}</span></td>
                    <td className="mono text-xs" style={{ color: 'var(--tx-2)' }}>{job.jobType}</td>
                    <td style={{ fontWeight: 600, color: job.priority >= 8 ? 'var(--red)' : job.priority >= 5 ? 'var(--amber)' : 'var(--tx-3)' }}>
                      P{job.priority}
                    </td>
                    <td className="muted" style={{ color: job.attempts >= job.maxRetries ? 'var(--red)' : undefined }}>
                      {job.attempts}/{job.maxRetries}
                    </td>
                    <td className="mono text-xs muted">{new Date(job.runAt).toLocaleString()}</td>
                    <td className="mono text-xs muted">{new Date(job.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center gap-2" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={filters.page >= pagination.pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {selectedJob && (
        <JobDetailModal jobId={selectedJob} token={token} onClose={() => setSelectedJob(null)} onRetry={fetchJobs} />
      )}
    </>
  );
}

function CloseIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>; }
function RetryIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8a6 6 0 1010.7-3.7M12 4V1l3 3-3 3" /></svg>; }
function ErrorIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="6" /><path d="M8 5v3M8 10v.5" /></svg>; }
