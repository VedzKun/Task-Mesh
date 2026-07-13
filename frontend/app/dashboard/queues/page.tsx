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

const STATUS_BADGE: Record<string, string> = {
  QUEUED: 'badge-queued', RUNNING: 'badge-running', COMPLETED: 'badge-completed',
  FAILED: 'badge-failed', DLQ: 'badge-dlq', SCHEDULED: 'badge-scheduled',
};

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

  const togglePause = async (queue: Queue) => {
    const action = queue.isPaused ? 'resume' : 'pause';
    try {
      await api.post(`/api/projects/${selectedProject}/queues/${queue.id}/${action}`, {}, token);
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

  const PriorityBar = ({ value }: { value: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="progress" style={{ width: 64 }}>
        <div className="progress-bar" style={{ width: `${value * 10}%`, background: value >= 7 ? 'var(--color-danger)' : value >= 4 ? 'var(--color-warning)' : 'var(--color-success)' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600 }}>{value}</span>
    </div>
  );

  return (
    <>
      <header className="header">
        <h1 className="header-title">Queues</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 200 }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            id="select-project"
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button id="btn-new-queue" className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!selectedProject}>
            + New Queue
          </button>
        </div>
      </header>

      <div className="page-container">
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : queues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">≡</div>
            <div className="empty-state-title">No queues yet</div>
            <div className="empty-state-desc">Create a queue to start scheduling jobs</div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Queue</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Concurrency</th>
                  <th>Jobs</th>
                  <th>Failed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{q.name}</div>
                      {q.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{q.description}</div>}
                    </td>
                    <td>
                      <span className={`badge ${q.isPaused ? 'badge-paused' : 'badge-active'}`}>
                        {q.isPaused ? '⏸ Paused' : '▶ Active'}
                      </span>
                    </td>
                    <td><PriorityBar value={q.priority} /></td>
                    <td>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                        {q.concurrencyLimit} max
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{q._count?.jobs ?? 0}</span>
                    </td>
                    <td>
                      <span style={{ color: (q.statusCounts?.FAILED || 0) > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        {q.statusCounts?.FAILED ?? 0}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className={`btn btn-sm ${q.isPaused ? 'btn-success' : 'btn-ghost'}`}
                          onClick={() => togglePause(q)}
                          title={q.isPaused ? 'Resume' : 'Pause'}
                        >
                          {q.isPaused ? '▶' : '⏸'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => deleteQueue(q)}
                          title="Delete"
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Create Queue</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createQueue}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Queue Name *</label>
                  <input id="input-queue-name" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="email-notifications" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Priority (1-10)</label>
                    <input className="form-input" type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Concurrency Limit</label>
                    <input className="form-input" type="number" min={1} max={100} value={form.concurrencyLimit} onChange={(e) => setForm({ ...form, concurrencyLimit: +e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button id="btn-create-queue-submit" type="submit" className="btn btn-primary">Create Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
