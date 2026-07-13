'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, type ApiResponse } from '@/lib/api';

interface Queue {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  priority: number;
  concurrencyLimit: number;
  rateLimitPerMin?: number;
  isPaused: boolean;
  createdAt: string;
  _count?: { jobs: number };
  statusCounts?: Record<string, number>;
}

interface Project { id: string; name: string; }

export default function QueuesPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', priority: 5, concurrencyLimit: 5 });

  useEffect(() => {
    api.get<ApiResponse<Project[]>>('/api/projects', token).then((r) => {
      setProjects(r.data);
      if (r.data.length) setSelectedProject(r.data[0].id);
    }).catch(() => {});
  }, [token]);

  const fetchQueues = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Queue[]>>(`/api/projects/${selectedProject}/queues`, token);
      setQueues(res.data);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, token]);

  useEffect(() => { fetchQueues(); }, [fetchQueues]);

  const createQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/projects/${selectedProject}/queues`, form, token);
      toast('Queue created', 'success');
      setShowCreate(false);
      setForm({ name: '', description: '', priority: 5, concurrencyLimit: 5 });
      fetchQueues();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const togglePause = async (q: Queue) => {
    const action = q.isPaused ? 'resume' : 'pause';
    try {
      await api.post(`/api/projects/${selectedProject}/queues/${q.id}/${action}`, {}, token);
      toast(`Queue ${action}d`, 'success');
      fetchQueues();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const deleteQueue = async (q: Queue) => {
    if (!confirm(`Delete queue "${q.name}"?`)) return;
    try {
      await api.delete(`/api/projects/${selectedProject}/queues/${q.id}`, token);
      toast('Queue deleted', 'success');
      fetchQueues();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const priorityColor = (v: number) =>
    v >= 8 ? 'var(--red)' : v >= 5 ? 'var(--amber)' : 'var(--green)';

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-h1">Queues</div>
          <div className="page-sub">Manage job queues per project</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="form-select"
            style={{ width: 180 }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            id="select-project"
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button id="btn-new-queue" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)} disabled={!selectedProject}>
            <PlusIcon /> New queue
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state"><div className="spinner spinner-lg" /></div>
      ) : queues.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-icon"><ListIcon /></div>
          <div className="empty-title">No queues yet</div>
          <div className="empty-sub">Create a queue to start scheduling jobs in this project.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            <PlusIcon /> Create queue
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Queue</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Concurrency</th>
                <th>Jobs</th>
                <th>Failed</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.id} id={`queue-row-${q.id}`}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{q.name}</div>
                    {q.description && <div className="text-sm" style={{ color: 'var(--tx-3)', marginTop: 2 }}>{q.description}</div>}
                  </td>
                  <td>
                    <span className={`badge ${q.isPaused ? 'badge-amber' : 'badge-green'}`}>
                      <span className="badge-dot" style={{ background: q.isPaused ? 'var(--amber)' : 'var(--green)' }} />
                      {q.isPaused ? 'Paused' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="progress-track" style={{ width: 52 }}>
                        <div className="progress-fill" style={{ width: `${q.priority * 10}%`, background: priorityColor(q.priority) }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600 }}>{q.priority}</span>
                    </div>
                  </td>
                  <td className="mono">{q.concurrencyLimit}</td>
                  <td style={{ fontWeight: 600 }}>{q._count?.jobs ?? 0}</td>
                  <td style={{ color: (q.statusCounts?.FAILED ?? 0) > 0 ? 'var(--red)' : 'var(--tx-3)', fontWeight: (q.statusCounts?.FAILED ?? 0) > 0 ? 600 : 400 }}>
                    {q.statusCounts?.FAILED ?? 0}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className={`btn btn-sm ${q.isPaused ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => togglePause(q)}
                        title={q.isPaused ? 'Resume' : 'Pause'}
                      >
                        {q.isPaused ? <PlayIcon /> : <PauseIcon />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ color: 'var(--tx-3)' }}
                        onClick={() => deleteQueue(q)}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-heading">Create queue</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowCreate(false)}><CloseIcon /></button>
            </div>
            <form onSubmit={createQueue}>
              <div className="modal-body-inner">
                <div className="form-group">
                  <label className="form-label">Queue name *</label>
                  <input id="input-queue-name" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="email-notifications" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
                </div>
                <div className="two-col">
                  <div className="form-group">
                    <label className="form-label">Priority (1–10)</label>
                    <input className="form-input" type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Concurrency limit</label>
                    <input className="form-input" type="number" min={1} max={100} value={form.concurrencyLimit} onChange={(e) => setForm({ ...form, concurrencyLimit: +e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
                <button id="btn-create-queue-submit" type="submit" className="btn btn-primary btn-sm">Create queue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2v12M2 8h12" /></svg>; }
function CloseIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>; }
function TrashIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M5 4V3h6v1M6 7v5M10 7v5M3 4l1 10h8l1-10" /></svg>; }
function PlayIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 3l10 5-10 5V3z" /></svg>; }
function PauseIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>; }
function ListIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6h18M3 12h12M3 18h8" /></svg>; }
