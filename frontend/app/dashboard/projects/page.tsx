'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, type ApiResponse } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  description?: string;
  apiKeyPrefix: string;
  createdAt: string;
  _count?: { queues: number };
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project, key: string) => void }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<Project & { apiKey: string }>>('/api/projects', { name, description: desc }, token);
      onCreated(res.data, res.data.apiKey);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title font-headline text-[20px]">Create New Project</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input id="input-project-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-service" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button id="btn-create-project-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApiKeyDisplay({ apiKey, prefix, onClose }: { apiKey: string; prefix: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🔑 Save Your API Key</span>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--color-warning-dim)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', color: 'var(--color-warning)' }}>
            ⚠ This key will only be shown once. Save it securely.
          </div>
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', wordBreak: 'break-all' }}>
            {apiKey}
          </div>
          <button className="btn btn-primary w-full" onClick={copy}>{copied ? '✓ Copied!' : 'Copy Key'}</button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>I've saved it</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; prefix: string } | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<Project[]>>('/api/projects', token);
      setProjects(res.data);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreated = (project: Project, apiKey: string) => {
    setProjects((prev) => [project, ...prev]);
    setShowCreate(false);
    setNewKey({ key: apiKey, prefix: project.apiKeyPrefix });
  };

  const deleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? All queues and jobs will be permanently deleted.`)) return;
    try {
      await api.delete(`/api/projects/${id}`, token);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast('Project deleted', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Projects Overview</h1>
        <button id="btn-new-project" className="btn btn-primary shadow-glow" onClick={() => setShowCreate(true)}>
          <span className="material-symbols-outlined text-[18px]">add</span> New Project
        </button>
      </div>

      <div className="page-container" style={{ paddingTop: 0 }}>
        {loading ? (
          <div className="loading-container"><div className="spinner" /><span>Loading projects...</span></div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⊞</div>
            <div className="empty-state-title">No projects yet</div>
            <div className="empty-state-desc">Create your first project to get started</div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Project</button>
          </div>
        ) : (
          <div className="bento-grid">
            {projects.map((p) => (
              <div key={p.id} className="col-span-12 md:col-span-6 xl:col-span-4 glass-panel p-6 flex flex-col transition-all hover:border-primary/50 group relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl transition-all group-hover:scale-150"></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
                  <span className="font-headline text-[20px] font-bold text-white">{p.name}</span>
                  <button
                    className="p-1 opacity-0 group-hover:opacity-100 text-danger hover:bg-danger/10 rounded transition-all"
                    onClick={() => deleteProject(p.id, p.name)}
                    title="Delete project"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
                {p.description && <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px', flex: 1, position: 'relative', zIndex: 1 }}>{p.description}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto', position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>API Key</span>
                    <span className="text-mono">{p.apiKeyPrefix}...</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Queues</span>
                    <span style={{ fontWeight: 600 }}>{p._count?.queues ?? 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Created</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {newKey && <ApiKeyDisplay apiKey={newKey.key} prefix={newKey.prefix} onClose={() => setNewKey(null)} />}
    </>
  );
}
