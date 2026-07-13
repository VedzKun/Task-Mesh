'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider, useToast } from '@/lib/toast-context';

function LoginForm() {
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const { register } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel" style={{ padding: 'var(--space-8)' }}>
        <div className="auth-logo" style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', boxShadow: 'var(--shadow-glow)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>hub</span>
          </div>
          <span className="logo-text font-headline text-[24px]">Task-Mesh</span>
        </div>

        <h1 className="auth-title">{isRegister ? 'Create account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">{isRegister ? 'Sign up to start scheduling jobs' : 'Sign in to your Task-Mesh account'}</p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input id="input-register-name" className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="input-email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="input-password" className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
          </div>

          <button id="btn-auth-submit" type="submit" className="btn btn-primary btn-lg shadow-glow" style={{ marginTop: '16px', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            id="btn-toggle-auth-mode"
            onClick={() => setIsRegister(!isRegister)}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}
          >
            {isRegister ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoginForm />
      </ToastProvider>
    </AuthProvider>
  );
}
