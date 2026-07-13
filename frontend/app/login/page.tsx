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
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon" style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6c8cff, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 0 20px rgba(108,140,255,0.3)' }}>⬡</div>
          <span className="logo-text" style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(90deg, #6c8cff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Task-Mesh</span>
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

          <button id="btn-auth-submit" type="submit" className="btn btn-primary btn-lg" style={{ marginTop: '8px', justifyContent: 'center' }} disabled={loading}>
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
