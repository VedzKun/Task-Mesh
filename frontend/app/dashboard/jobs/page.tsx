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
  QUEUED: 'badge-queued', RUNNING: 'badge-running', COMPLETED: 'badge-completed',
  FAILED: 'badge-failed', DLQ: 'badge-dlq', SCHEDULED: 'badge-scheduled',
  CLAIMED: 'badge-claimed', CANCELLED: 'badge-cancelled',
};

const STATUSES = ['', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DLQ', 'SCHEDULED', 'CLAIMED', 'CANCELLED'];

function JobDetailPanel({ jobId, token, onClose, onRetry }: { jobId: string; token: string | null; onClose: () => void; onRetry: () => void }) {
  const [job, setJob] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get<ApiResponse<any>>(`/api/jobs/${jobId}`, token).then((r) => setJob(r.data)).catch(() => {});
  }, [jobId, token]);

  const retry = async () => {
    try {
      await api.post(`/api/jobs/${jobId}/retry`, {}, token);
      toast('Job queued for retry', 'success');
      onRetry();
      onClose();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const cancel = async () => {
    try {
      await api.post(`/api/jobs/${jobId}/cancel`, {}, token);
      toast('Job cancelled', 'success');
      onRetry();
      onClose();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  if (!job) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title font-headline text-[20px]">{job.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }} className="text-mono">{job.id}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['FAILED', 'DLQ', 'CANCELLED'].includes(job.status) && (
              <button className="btn btn-success btn-sm shadow-glow" onClick={retry}>
                <span className="material-symbols-outlined text-[16px] mr-1">refresh</span> Retry
              </button>
            )}
            {['QUEUED', 'SCHEDULED'].includes(job.status) && (
              <button className="btn btn-danger btn-sm" onClick={cancel}>
                <span className="material-symbols-outlined text-[16px] mr-1">cancel</span> Cancel
              </button>
            )}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Status & Info */}
          <div className="grid-2" style={{ gap: '12px' }}>
            {[
              ['Status', <span key="s" className={`badge ${STATUS_BADGE[job.status] || ''}`}>{job.status}</span>],
              ['Type', <span key="t" className="text-mono">{job.jobType}</span>],
              ['Priority', job.priority],
              ['Attempts', `${job.attempts} / ${job.maxRetries}`],
              ['Queue', job.queue?.name],
              ['Run At', new Date(job.runAt).toLocaleString()],
            ].map(([label, val]) => (
              <div key={label as string} style={{ fontSize: '13px' }}>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>{label as string}</div>
                <div style={{ fontWeight: 500 }}>{val as any}</div>
              </div>
            ))}
          </div>

          {/* Payload */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 8 }}>Payload</div>
            <pre style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '12px', overflowX: 'auto', border: '1px solid var(--color-border)' }}>
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>

          {/* Error */}
          {job.lastError && (
            <div style={{ background: 'var(--color-danger-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600, marginBottom: 4 }}>Last Error</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{job.lastError}</div>
            </div>
          )}

          {/* Executions */}
          {job.executions?.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 8 }}>Execution History ({job.executions.length})</div>
              {job.executions.slice(0, 5).map((ex: any) => (
                <div key={ex.id} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '12px', marginBottom: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Attempt {ex.attempt}</span>
                    <span className={`badge badge-${ex.status.toLowerCase()}`}>{ex.status}</span>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(ex.startedAt).toLocaleString()} · {ex.durationMs ? `${ex.durationMs}ms` : 'In progress'}
                  </div>
                  {ex.errorMessage && <div style={{ color: 'var(--color-danger)', marginTop: 4 }}>{ex.errorMessage}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Logs */}
          {job.logs?.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 8 }}>Logs</div>
              <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', maxHeight: 200, overflowY: 'auto' }}>
                {job.logs.map((log: any) => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '6px 12px', borderBottom: '1px solid var(--color-border)', fontSize: '12px' }}>
                    <span style={{ color: log.level === 'ERROR' ? 'var(--color-danger)' : log.level === 'WARN' ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: 600, minWidth: 40 }}>{log.level}</span>
                    <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>{log.message}</span>
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
      <div className="page-header">
        <h1 className="page-title">Job Explorer</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="form-input glass-panel"
            style={{ width: 200, padding: '8px 12px' }}
            placeholder="Search jobs..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            id="input-job-search"
          />
          <select
            className="form-select glass-panel"
            style={{ width: 150, padding: '8px 12px' }}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            id="select-job-status"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Status'}</option>)}
          </select>
        </div>
      </div>

      <div className="page-container" style={{ paddingTop: 0 }}>
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : (
          <>
            <div className="table-wrapper glass-panel">
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
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                        No jobs found
                      </td>
                    </tr>
                  ) : jobs.map((job) => (
                    <tr key={job.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedJob(job.id)} id={`job-row-${job.id}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{job.name}</div>
                        <div className="text-mono" style={{ color: 'var(--color-text-muted)' }}>{job.id.slice(0, 8)}…</div>
                      </td>
                      <td><span style={{ fontSize: '12px' }}>{job.queue?.name || '—'}</span></td>
                      <td><span className={`badge ${STATUS_BADGE[job.status] || ''}`}>{job.status}</span></td>
                      <td><span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{job.jobType}</span></td>
                      <td>
                        <span style={{ fontWeight: 600, color: job.priority >= 8 ? 'var(--color-danger)' : job.priority >= 5 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                          P{job.priority}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: job.attempts >= job.maxRetries ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                          {job.attempts}/{job.maxRetries}
                        </span>
                      </td>
                      <td className="td-mono">{new Date(job.runAt).toLocaleString()}</td>
                      <td className="td-mono">{new Date(job.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-ghost btn-sm" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>← Prev</button>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </span>
                <button className="btn btn-ghost btn-sm" disabled={filters.page >= pagination.pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedJob && (
        <JobDetailPanel
          jobId={selectedJob}
          token={token}
          onClose={() => setSelectedJob(null)}
          onRetry={fetchJobs}
        />
      )}
    </>
  );
}
