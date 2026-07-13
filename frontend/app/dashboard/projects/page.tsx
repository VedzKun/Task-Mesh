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

/* ─── Create Modal ─────────────────────────────────────── */
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project, key: string) => void }) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-heading">New project</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body-inner">
            <div className="form-group">
              <label className="form-label">Project name *</label>
              <input id="input-project-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-service" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button id="btn-create-project-submit" type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating…</> : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── API Key Modal ────────────────────────────────────── */
function ApiKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-heading">Save your API key</span>
        </div>
        <div className="modal-body-inner">
          <div className="alert alert-warn">
            <WarnIcon />
            <span>This key won't be shown again. Store it somewhere safe.</span>
          </div>
          <div className="code-block">{apiKey}</div>
          <button className="btn btn-primary w-full" onClick={copy}>
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>I've saved it</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────── */
export default function ProjectsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

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
    setNewKey(apiKey);
  };

  const deleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? All queues and jobs will be removed.`)) return;
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
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-h1">Projects</div>
          <div className="page-sub">{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
        </div>
        <button id="btn-new-project" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <PlusIcon /> New project
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="loading-state"><div className="spinner spinner-lg" /><span>Loading projects…</span></div>
      ) : projects.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-icon"><FolderIcon /></div>
          <div className="empty-title">No projects yet</div>
          <div className="empty-sub">Create a project to start managing job queues and scheduling work.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            <PlusIcon /> Create project
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {projects.map((p) => (
            <div key={p.id} className="project-card" id={`project-card-${p.id}`}>
              <div className="project-card-head">
                <div>
                  <div className="project-name">{p.name}</div>
                  {p.description && <div className="project-desc" style={{ marginTop: 4 }}>{p.description}</div>}
                </div>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ color: 'var(--tx-3)' }}
                  onClick={() => deleteProject(p.id, p.name)}
                  title="Delete project"
                >
                  <TrashIcon />
                </button>
              </div>

              <div className="project-meta">
                <div className="meta-row">
                  <span className="meta-key">API key</span>
                  <span className="meta-val">{p.apiKeyPrefix}…</span>
                </div>
                <div className="meta-row">
                  <span className="meta-key">Queues</span>
                  <span className="meta-val" style={{ fontFamily: 'Inter', fontSize: 12 }}>{p._count?.queues ?? 0}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-key">Created</span>
                  <span className="meta-val" style={{ fontFamily: 'Inter', fontSize: 12 }}>
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {newKey && <ApiKeyModal apiKey={newKey} onClose={() => setNewKey(null)} />}
    </>
  );
}

/* ── Icons ── */
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2v12M2 8h12" /></svg>;
}
function CloseIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>;
}
function WarnIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M8 2l6 10H2L8 2z" /><path d="M8 6v3M8 11v.5" /></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M5 4V3h6v1M6 7v5M10 7v5M3 4l1 10h8l1-10" /></svg>;
}
function FolderIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>;
}
