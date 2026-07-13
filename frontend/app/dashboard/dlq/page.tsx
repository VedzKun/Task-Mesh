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

  const fetchEntries = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<DLQEntry[]>>('/api/metrics/dlq', token);
      setEntries(res.data);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const retryJob = async (jobId: string) => {
    try {
      await api.post(`/api/jobs/${jobId}/retry`, {}, token);
      toast('Job requeued from DLQ', 'success');
      fetchEntries();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-h1">Dead Letter Queue</div>
          <div className="page-sub">{entries.length} unresolved entr{entries.length !== 1 ? 'ies' : 'y'}</div>
        </div>
        {entries.length > 0 && (
          <span className="badge badge-red">
            <span className="badge-dot" style={{ background: 'var(--red)' }} />
            {entries.length} failed
          </span>
        )}
      </div>

      {entries.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <ErrorIcon />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{entries.length} jobs permanently failed</div>
            <div style={{ fontSize: 12 }}>These jobs exhausted all retry attempts. Review errors and retry or discard them.</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state"><div className="spinner spinner-lg" /></div>
      ) : entries.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <div className="empty-icon" style={{ color: 'var(--green)' }}><CheckIcon /></div>
          <div className="empty-title">Dead Letter Queue is empty</div>
          <div className="empty-sub">All jobs are healthy — no permanent failures.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Failure reason</th>
                <th>Attempts</th>
                <th>Failed at</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} id={`dlq-row-${e.id}`}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.job?.name ?? 'Unknown'}</div>
                    <div className="mono text-xs" style={{ color: 'var(--tx-3)' }}>{e.jobId.slice(0, 8)}…</div>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div className="mono text-xs" style={{ color: 'var(--red)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {e.reason}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--red)' }}>{e.attempts}</td>
                  <td className="mono text-xs muted">{new Date(e.failedAt).toLocaleString()}</td>
                  <td>
                    <button
                      id={`btn-retry-dlq-${e.id}`}
                      className="btn btn-success btn-sm"
                      onClick={() => retryJob(e.jobId)}
                    >
                      <RetryIcon /> Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RetryIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8a6 6 0 1010.7-3.7M12 4V1l3 3-3 3" /></svg>; }
function CheckIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>; }
function ErrorIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M8 2l6 10H2L8 2z" /><path d="M8 6v3M8 11v.5" /></svg>; }
