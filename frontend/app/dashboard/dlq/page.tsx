'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, type ApiResponse } from '@/lib/api';

interface DLQEntry {
  id: string;
  jobId: string;
  queueId: string;
  reason: string;
  attempts: number;
  failedAt: string;
  resolvedAt?: string;
  job?: { name: string; queueId: string };
}

export default function DLQPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DLQEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<DLQEntry[]>>('/api/metrics/dlq', token);
      setEntries(res.data);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  const retryJob = async (jobId: string) => {
    try {
      await api.post(`/api/jobs/${jobId}/retry`, {}, token);
      toast('Job requeued from DLQ', 'success');
      fetch();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <header className="header">
        <h1 className="header-title">Dead Letter Queue</h1>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {entries.length} unresolved entries
        </span>
      </header>

      <div className="page-container">
        {entries.length > 0 && (
          <div style={{ background: 'var(--color-danger-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{entries.length} jobs have permanently failed</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>These jobs exhausted all retry attempts. Review the errors and retry or discard them.</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--color-success)' }}>✓</div>
            <div className="empty-state-title">Dead Letter Queue is empty</div>
            <div className="empty-state-desc">All jobs are healthy — no permanent failures.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Failure Reason</th>
                  <th>Attempts</th>
                  <th>Failed At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} id={`dlq-row-${e.id}`}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.job?.name || 'Unknown'}</div>
                      <div className="text-mono" style={{ color: 'var(--color-text-muted)' }}>{e.jobId.slice(0, 8)}…</div>
                    </td>
                    <td>
                      <div style={{ maxWidth: 300, fontSize: '12px', color: 'var(--color-danger)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {e.reason}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{e.attempts}</td>
                    <td className="td-mono">{new Date(e.failedAt).toLocaleString()}</td>
                    <td>
                      <button
                        id={`btn-retry-dlq-${e.id}`}
                        className="btn btn-success btn-sm"
                        onClick={() => retryJob(e.jobId)}
                      >
                        ↺ Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
