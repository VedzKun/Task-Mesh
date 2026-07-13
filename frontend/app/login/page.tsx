'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider, useToast } from '@/lib/toast-context';

function LoginForm() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="auth-wrap">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-mark">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" opacity=".6" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" opacity=".6" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" opacity=".3" />
            </svg>
          </div>
          <span className="logo-name">TaskMesh</span>
        </div>

        <h1 className="auth-heading">
          {isRegister ? 'Create an account' : 'Sign in'}
        </h1>
        <p className="auth-sub">
          {isRegister
            ? 'Get started with TaskMesh'
            : 'Welcome back — sign in to your workspace'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                id="input-register-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="input-email"
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="input-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <button
            id="btn-auth-submit"
            type="submit"
            className="btn btn-primary w-full"
            style={{ marginTop: 4, height: 38, fontSize: 13.5 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Please wait…
              </>
            ) : isRegister ? (
              'Create account'
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button id="btn-toggle-auth-mode" onClick={() => setIsRegister(!isRegister)}>
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
